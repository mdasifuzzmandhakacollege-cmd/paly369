/**
 * @file walletLedgerService.ts
 * @description Core Wallet Ledger Engine implementing PostgreSQL ACID transactions,
 * Row-Level Locking (SELECT ... FOR UPDATE), and strict Idempotency Protection.
 * 
 * [SECURITY & ARCHITECTURAL INVARIANTS]:
 * 1. Parameterized SQL only (zero string interpolation).
 * 2. Integer Minor Units (zero floating-point math for balances or transactions).
 * 3. Immutable Append-Only Ledger entries for every financial state transition.
 * 4. Idempotency Guard: Identical transaction IDs return the committed outcome without re-executing balance mutations.
 * 5. Overdraft Protection: Debits strictly rejected if available balance < debit amount.
 * 6. Audit Trail: Correlation IDs and safe masked metadata logged with every transaction.
 */

import { ILedgerDbPool, ILedgerDbClient, InMemoryPostgresLedgerEngine } from './db';
import {
  BalanceTargetReconciliationSummary,
  BonusToRealTransferRequest,
  BonusToRealTransferResult,
  deriveWithdrawalTransactionId,
  IdempotencyConflictError,
  InsufficientFundsError,
  LedgerBalanceTarget,
  LedgerTransactionRequest,
  LedgerTransactionResult,
  LedgerValidationError,
  SupportedCurrency,
  WalletAuditReconciliationResult,
  WalletFrozenError,
  WalletNotFoundError,
  WalletRecord,
  WithdrawalReservationFingerprint,
  WithdrawalReservationRequest,
  WithdrawalReservationResult
} from './types';
import { formatMinorUnits, parseToMinorUnits, validateCurrency } from './money';
import { maskSensitiveData, safeLog } from '../gateway/masking';

export class WalletLedgerService {
  private db: ILedgerDbPool;

  constructor(dbPool: ILedgerDbPool) {
    this.db = dbPool;
  }

  /**
   * Generates a deterministic idempotency key for transactions
   */
  private generateIdempotencyKey(userId: string | number, currency: string, transactionId: string): string {
    return `idemp:${String(userId).trim()}:${currency}:${transactionId.trim()}`;
  }

  /**
   * Retrieves user wallet balance (non-blocking read)
   */
  public async getWallet(userId: string | number, currency: string): Promise<WalletRecord> {
    if (userId === undefined || userId === null || String(userId).trim() === '') {
      throw new LedgerValidationError("Valid userId is required", { userId });
    }
    const normalizedUserId = String(userId).trim();
    const validatedCurrency = validateCurrency(currency);

    const res = await this.db.query<{
      id: string | number;
      user_id: string | number;
      currency: SupportedCurrency;
      real_balance?: string | number;
      bonus_balance?: string | number;
      locked_balance?: string | number;
      balance_minor?: string | number | bigint;
      version: string | number;
      status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, user_id, currency, real_balance, bonus_balance, locked_balance, balance_minor, version, status, created_at, updated_at
       FROM wallets
       WHERE user_id = $1 AND currency = $2
       LIMIT 1`,
      [normalizedUserId, validatedCurrency]
    );

    if (res.rows.length === 0) {
      throw new WalletNotFoundError(normalizedUserId, validatedCurrency);
    }

    const row = res.rows[0];
    let balanceMinor: bigint;
    if (row.balance_minor !== undefined && row.balance_minor !== null && row.balance_minor !== '') {
      balanceMinor = BigInt(row.balance_minor.toString());
    } else if (row.real_balance !== undefined && row.real_balance !== null) {
      balanceMinor = parseToMinorUnits(row.real_balance.toString(), validatedCurrency, true);
    } else {
      balanceMinor = 0n;
    }

    return {
      id: row.id,
      userId: row.user_id,
      currency: row.currency,
      balanceMinor,
      realBalance: row.real_balance !== undefined && row.real_balance !== null ? row.real_balance.toString() : formatMinorUnits(balanceMinor, row.currency),
      bonusBalance: row.bonus_balance !== undefined && row.bonus_balance !== null ? row.bonus_balance.toString() : '0.0000',
      lockedBalance: row.locked_balance !== undefined && row.locked_balance !== null ? row.locked_balance.toString() : '0.0000',
      version: BigInt(row.version),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Ensures wallet exists or creates a new one inside an isolated operation
   */
  public async ensureWallet(
    userId: string | number,
    currency: string,
    initialBalanceMinor: bigint = 0n
  ): Promise<WalletRecord> {
    if (userId === undefined || userId === null || String(userId).trim() === '') {
      throw new LedgerValidationError("Valid userId is required", { userId });
    }
    const normalizedUserId = String(userId).trim();
    const validatedCurrency = validateCurrency(currency);

    try {
      return await this.getWallet(normalizedUserId, validatedCurrency);
    } catch (err) {
      if (err instanceof WalletNotFoundError) {
        const initialRealBalance = formatMinorUnits(initialBalanceMinor, validatedCurrency);
        await this.db.query(
          `INSERT INTO wallets (user_id, currency, real_balance, balance_minor, status)
           VALUES ($1, $2, $3, $4, 'ACTIVE')
           ON CONFLICT (user_id, currency) DO NOTHING`,
          [normalizedUserId, validatedCurrency, initialRealBalance, initialBalanceMinor.toString()]
        );
        return await this.getWallet(normalizedUserId, validatedCurrency);
      }
      throw err;
    }
  }

  /**
   * Executes a strict ACID financial ledger transaction:
   * 1. Validates inputs & sanitizes metadata.
   * 2. Opens transaction: `BEGIN`.
   * 3. Checks idempotency: returns cached outcome if already executed.
   * 4. Acquires row lock: `SELECT ... FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE`.
   * 5. Enforces balance invariants & status guards.
   * 6. Updates balance: `UPDATE wallets SET real_balance = ..., balance_minor = ...`.
   * 7. Inserts immutable record: `INSERT INTO ledger_entries (...)`.
   * 8. Records idempotency state: `INSERT INTO idempotency_records (...)`.
   * 9. Commits transaction: `COMMIT`.
   */
  public async executeTransaction(req: LedgerTransactionRequest): Promise<LedgerTransactionResult> {
    // 1. Validation & Input Sanitization
    if (req.userId === undefined || req.userId === null || String(req.userId).trim() === '') {
      throw new LedgerValidationError("userId is required", { userId: req.userId });
    }
    const normalizedUserId = String(req.userId).trim();

    if (!req.transactionId || typeof req.transactionId !== 'string' || req.transactionId.trim().length === 0) {
      throw new LedgerValidationError("transactionId is required and must be a non-empty string", { transactionId: req.transactionId });
    }

    const currency = validateCurrency(req.currency);
    const targetBalance = req.targetBalance || 'REAL';
    const allowZero = req.type === 'CREDIT' || req.type === 'ADJUSTMENT';
    const rawAmount = req.amountMinor !== undefined ? req.amountMinor : req.amountMajor;
    const amountMinor = parseToMinorUnits(rawAmount, currency, allowZero);
    const correlationId = req.correlationId || `cid-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const idempotencyKey = this.generateIdempotencyKey(normalizedUserId, currency, req.transactionId);
    const sanitizedAudit = req.auditMetadata ? maskSensitiveData(req.auditMetadata) : {};
    sanitizedAudit.targetBalance = targetBalance;
    if (targetBalance === 'BONUS' && !sanitizedAudit.category) {
      sanitizedAudit.category = 'BONUS_CASH';
    } else if (targetBalance === 'REAL' && !sanitizedAudit.category) {
      sanitizedAudit.category = 'REAL_CASH';
    }

    safeLog('info', correlationId, `[Ledger] Initiating ${req.type} (${targetBalance}) of ${formatMinorUnits(amountMinor, currency)} ${currency}`, {
      userId: normalizedUserId,
      transactionId: req.transactionId,
      type: req.type,
      targetBalance
    });

    const client: ILedgerDbClient = await this.db.connect();

    try {
      // 2. BEGIN PostgreSQL ACID Transaction
      await client.query('BEGIN');

      // 3. Idempotency Check within transaction
      const existingIdemp = await client.query<{
        idempotency_key: string;
        transaction_id: string;
        status_code: number;
        response_payload: LedgerTransactionResult;
      }>(
        `SELECT idempotency_key, transaction_id, status_code, response_payload
         FROM idempotency_records
         WHERE idempotency_key = $1
         LIMIT 1`,
        [idempotencyKey]
      );

      if (existingIdemp.rows.length > 0) {
        await client.query('COMMIT');
        safeLog('info', correlationId, `[Ledger] Idempotent hit for transactionId: ${req.transactionId}`);
        const rawPayload = existingIdemp.rows[0].response_payload;
        const cached = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
        return {
          ...cached,
          isIdempotent: true
        };
      }

      // 4. Row-Level Locking (SELECT ... FOR UPDATE)
      let walletRes = await client.query<{
        id: string | number;
        user_id: string | number;
        currency: SupportedCurrency;
        real_balance?: string | number;
        bonus_balance?: string | number;
        balance_minor?: string | number | bigint;
        version: string | number;
        status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
      }>(
        `SELECT id, user_id, currency, real_balance, bonus_balance, balance_minor, version, status
         FROM wallets
         WHERE user_id = $1 AND currency = $2
         FOR UPDATE`,
        [normalizedUserId, currency]
      );

      if (walletRes.rows.length === 0) {
        // Auto-initialize canonical player wallet
        await client.query(
          `INSERT INTO wallets (user_id, currency, real_balance, bonus_balance, balance_minor, status)
           VALUES ($1, $2, $3, '0.0000', $4, 'ACTIVE')
           ON CONFLICT (user_id, currency) DO NOTHING`,
          [normalizedUserId, currency, '0.0000', '0']
        );
        walletRes = await client.query<{
          id: string | number;
          user_id: string | number;
          currency: SupportedCurrency;
          real_balance?: string | number;
          bonus_balance?: string | number;
          balance_minor?: string | number | bigint;
          version: string | number;
          status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
        }>(
          `SELECT id, user_id, currency, real_balance, bonus_balance, balance_minor, version, status
           FROM wallets
           WHERE user_id = $1 AND currency = $2
           FOR UPDATE`,
          [normalizedUserId, currency]
        );
        if (walletRes.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new WalletNotFoundError(normalizedUserId, currency);
        }
      }

      const wallet = walletRes.rows[0];

      // 5. Invariant Checks
      if (wallet.status !== 'ACTIVE') {
        await client.query('ROLLBACK');
        throw new WalletFrozenError(normalizedUserId, wallet.status);
      }

      let beforeBalanceMinor: bigint;
      if (targetBalance === 'BONUS') {
        const bonusStr = wallet.bonus_balance !== undefined && wallet.bonus_balance !== null ? wallet.bonus_balance.toString() : '0.0000';
        beforeBalanceMinor = parseToMinorUnits(bonusStr, currency, true);
      } else {
        if (wallet.balance_minor !== undefined && wallet.balance_minor !== null && wallet.balance_minor !== '') {
          beforeBalanceMinor = BigInt(wallet.balance_minor.toString());
        } else if (wallet.real_balance !== undefined && wallet.real_balance !== null) {
          beforeBalanceMinor = parseToMinorUnits(wallet.real_balance.toString(), currency, true);
        } else {
          beforeBalanceMinor = 0n;
        }
      }

      let afterBalanceMinor: bigint;

      if (req.type === 'DEBIT') {
        if (beforeBalanceMinor < amountMinor) {
          await client.query('ROLLBACK');
          safeLog('warn', correlationId, `[Ledger] Insufficient funds: available=${beforeBalanceMinor}, required=${amountMinor}`);
          throw new InsufficientFundsError(beforeBalanceMinor, amountMinor, currency);
        }
        afterBalanceMinor = beforeBalanceMinor - amountMinor;
      } else if (req.type === 'CREDIT' || req.type === 'REVERSAL') {
        afterBalanceMinor = beforeBalanceMinor + amountMinor;
      } else if (req.type === 'ADJUSTMENT') {
        // Adjustments can be positive or negative
        afterBalanceMinor = beforeBalanceMinor + amountMinor;
        if (afterBalanceMinor < 0n) {
          await client.query('ROLLBACK');
          throw new InsufficientFundsError(beforeBalanceMinor, amountMinor, currency);
        }
      } else {
        await client.query('ROLLBACK');
        throw new LedgerValidationError(`Unsupported ledger transaction type: ${req.type}`);
      }

      // 6. Update Canonical Wallet Balance (real_balance or bonus_balance)
      const formattedBalance = formatMinorUnits(afterBalanceMinor, currency);
      if (targetBalance === 'BONUS') {
        await client.query(
          `UPDATE wallets
           SET bonus_balance = $1,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $2`,
          [formattedBalance, wallet.id]
        );
      } else {
        await client.query(
          `UPDATE wallets
           SET real_balance = $1,
               balance_minor = $2,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $3`,
          [formattedBalance, afterBalanceMinor.toString(), wallet.id]
        );
      }

      // 7. Insert Immutable Ledger Entry
      const entryId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await client.query(
        `INSERT INTO ledger_entries (
           id, wallet_id, user_id, transaction_id, reference_transaction_id,
           type, balance_target, amount_minor, currency, before_balance_minor, after_balance_minor,
           status, correlation_id, audit_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          entryId,
          wallet.id,
          normalizedUserId,
          req.transactionId.trim(),
          req.referenceTransactionId?.trim() || null,
          req.type,
          targetBalance,
          amountMinor.toString(),
          currency,
          beforeBalanceMinor.toString(),
          afterBalanceMinor.toString(),
          'COMMITTED',
          correlationId,
          JSON.stringify(sanitizedAudit)
        ]
      );

      // 8. Construct Result & Record Idempotency
      const result: LedgerTransactionResult = {
        success: true,
        isIdempotent: false,
        ledgerEntryId: entryId,
        transactionId: req.transactionId.trim(),
        referenceTransactionId: req.referenceTransactionId?.trim() || null,
        userId: normalizedUserId,
        currency,
        type: req.type,
        targetBalance,
        amountMinor: amountMinor.toString(),
        amountMajor: formatMinorUnits(amountMinor, currency),
        beforeBalanceMinor: beforeBalanceMinor.toString(),
        afterBalanceMinor: afterBalanceMinor.toString(),
        afterBalanceMajor: formatMinorUnits(afterBalanceMinor, currency),
        correlationId,
        timestamp: new Date().toISOString()
      };

      await client.query(
        `INSERT INTO idempotency_records (
           idempotency_key, transaction_id, status_code, response_payload
         )
         VALUES ($1, $2, $3, $4)`,
        [idempotencyKey, req.transactionId.trim(), 200, JSON.stringify(result)]
      );

      // 9. COMMIT Transaction
      await client.query('COMMIT');

      safeLog('info', correlationId, `[Ledger] Transaction committed successfully: ${req.transactionId}`, {
        entryId,
        afterBalance: result.afterBalanceMajor
      });

      return result;
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});

      // If race condition created idempotency or ledger record concurrently, recover it
      if (err.code === '23505') {
        const recovery = await this.db.query<{ response_payload: LedgerTransactionResult }>(
          `SELECT response_payload FROM idempotency_records WHERE idempotency_key = $1 LIMIT 1`,
          [idempotencyKey]
        );
        if (recovery.rows.length > 0) {
          const rawRec = recovery.rows[0].response_payload;
          const cachedRec = typeof rawRec === 'string' ? JSON.parse(rawRec) : rawRec;
          return {
            ...cachedRec,
            isIdempotent: true
          };
        }
      }

      safeLog('error', correlationId, `[Ledger] Transaction failed: ${err.message}`, {
        code: err.code,
        name: err.name
      });

      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Executes an authoritative atomic balance conversion from BONUS to REAL:
   * 1. Validates inputs & sanitizes metadata.
   * 2. Opens transaction: `BEGIN`.
   * 3. Checks idempotency using root transactionId: `WAGERING_RELEASE_<userId>_<requirementId>`.
   * 4. Acquires row lock: `SELECT ... FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE`.
   * 5. Enforces balance invariants & status guards:
   *    - Verifies wallet is ACTIVE.
   *    - Verifies sufficient BONUS balance (bonusBalanceMinor >= amountMinor).
   * 6. Atomically debits BONUS balance and credits REAL balance in a single database update:
   *    `UPDATE wallets SET bonus_balance = $1, real_balance = $2, balance_minor = $3 ...`
   * 7. Inserts 2 immutable ledger entries:
   *    - Leg 1: DEBIT (targetBalance: 'BONUS')
   *    - Leg 2: CREDIT (targetBalance: 'REAL')
   *    Both entries reference the root transactionId as reference_transaction_id.
   * 8. Records single idempotency record under the root idempotency key.
   * 9. Commits transaction: `COMMIT`.
   */
  public async executeBonusToRealTransfer(req: BonusToRealTransferRequest): Promise<BonusToRealTransferResult> {
    // 1. Input Validation
    if (req.userId === undefined || req.userId === null || String(req.userId).trim() === '') {
      throw new LedgerValidationError("userId is required", { userId: req.userId });
    }
    const normalizedUserId = String(req.userId).trim();

    if (!req.transactionId || typeof req.transactionId !== 'string' || req.transactionId.trim().length === 0) {
      throw new LedgerValidationError("transactionId is required and must be a non-empty string", { transactionId: req.transactionId });
    }

    if (req.wageringRequirementId === undefined || req.wageringRequirementId === null || isNaN(Number(req.wageringRequirementId))) {
      throw new LedgerValidationError("wageringRequirementId is required and must be a valid number", { wageringRequirementId: req.wageringRequirementId });
    }

    const currency = validateCurrency(req.currency);
    const rawAmount = req.amountMinor !== undefined ? req.amountMinor : req.amountMajor;
    const amountMinor = parseToMinorUnits(rawAmount, currency, false);
    const correlationId = req.correlationId || `cid-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const rootTxId = req.transactionId.trim();
    const idempotencyKey = this.generateIdempotencyKey(normalizedUserId, currency, rootTxId);
    const sanitizedAudit = req.auditMetadata ? maskSensitiveData(req.auditMetadata) : {};
    sanitizedAudit.operation = 'BONUS_TO_REAL_CONVERSION';
    sanitizedAudit.wageringRequirementId = req.wageringRequirementId;

    safeLog('info', correlationId, `[Ledger] Initiating atomic BONUS -> REAL transfer of ${formatMinorUnits(amountMinor, currency)} ${currency}`, {
      userId: normalizedUserId,
      transactionId: rootTxId,
      amountMinor: amountMinor.toString(),
      wageringRequirementId: req.wageringRequirementId
    });

    const client: ILedgerDbClient = await this.db.connect();

    try {
      // 2. BEGIN PostgreSQL ACID Transaction
      await client.query('BEGIN');

      // 3. Idempotency Check within transaction
      const existingIdemp = await client.query<{
        idempotency_key: string;
        transaction_id: string;
        status_code: number;
        response_payload: BonusToRealTransferResult;
      }>(
        `SELECT idempotency_key, transaction_id, status_code, response_payload
         FROM idempotency_records
         WHERE idempotency_key = $1
         LIMIT 1`,
        [idempotencyKey]
      );

      if (existingIdemp.rows.length > 0) {
        await client.query('COMMIT');
        safeLog('info', correlationId, `[Ledger] Idempotent hit for bonus transfer: ${rootTxId}`);
        const rawPayload = existingIdemp.rows[0].response_payload;
        const cached = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
        return {
          ...cached,
          isIdempotent: true
        };
      }

      // 4. Row-Level Locking (SELECT ... FOR UPDATE)
      let walletRes = await client.query<{
        id: string | number;
        user_id: string | number;
        currency: SupportedCurrency;
        real_balance?: string | number;
        bonus_balance?: string | number;
        balance_minor?: string | number | bigint;
        version: string | number;
        status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
      }>(
        `SELECT id, user_id, currency, real_balance, bonus_balance, balance_minor, version, status
         FROM wallets
         WHERE user_id = $1 AND currency = $2
         FOR UPDATE`,
        [normalizedUserId, currency]
      );

      // 4b. Re-check idempotency under row lock (handles concurrent serialized attempts)
      const postLockIdemp = await client.query<{
        idempotency_key: string;
        transaction_id: string;
        status_code: number;
        response_payload: BonusToRealTransferResult;
      }>(
        `SELECT idempotency_key, transaction_id, status_code, response_payload
         FROM idempotency_records
         WHERE idempotency_key = $1
         LIMIT 1`,
        [idempotencyKey]
      );

      if (postLockIdemp.rows.length > 0) {
        await client.query('COMMIT');
        safeLog('info', correlationId, `[Ledger] Idempotent hit (post-lock) for bonus transfer: ${rootTxId}`);
        const rawPayload = postLockIdemp.rows[0].response_payload;
        const cached = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
        return {
          ...cached,
          isIdempotent: true
        };
      }

      if (walletRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new WalletNotFoundError(normalizedUserId, currency);
      }

      const wallet = walletRes.rows[0];

      // 5. Invariant Checks
      if (wallet.status !== 'ACTIVE') {
        await client.query('ROLLBACK');
        throw new WalletFrozenError(normalizedUserId, wallet.status);
      }

      const beforeBonusStr = wallet.bonus_balance !== undefined && wallet.bonus_balance !== null ? wallet.bonus_balance.toString() : '0.0000';
      const beforeBonusMinor = parseToMinorUnits(beforeBonusStr, currency, true);

      let beforeRealMinor: bigint;
      if (wallet.balance_minor !== undefined && wallet.balance_minor !== null && wallet.balance_minor !== '') {
        beforeRealMinor = BigInt(wallet.balance_minor.toString());
      } else if (wallet.real_balance !== undefined && wallet.real_balance !== null) {
        beforeRealMinor = parseToMinorUnits(wallet.real_balance.toString(), currency, true);
      } else {
        beforeRealMinor = 0n;
      }

      // Verify sufficient BONUS balance before conversion. Never create REAL value from nothing.
      if (beforeBonusMinor < amountMinor) {
        await client.query('ROLLBACK');
        safeLog('warn', correlationId, `[Ledger] Insufficient bonus funds for conversion: available=${beforeBonusMinor}, required=${amountMinor}`);
        throw new InsufficientFundsError(beforeBonusMinor, amountMinor, currency);
      }

      const afterBonusMinor = beforeBonusMinor - amountMinor;
      const afterRealMinor = beforeRealMinor + amountMinor;

      const formattedAfterBonus = formatMinorUnits(afterBonusMinor, currency);
      const formattedAfterReal = formatMinorUnits(afterRealMinor, currency);

      // 6. Update Canonical Wallet Balances (Atomic Update of both bonus_balance and real_balance/balance_minor)
      await client.query(
        `UPDATE wallets
         SET bonus_balance = $1,
             real_balance = $2,
             balance_minor = $3,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $4`,
        [formattedAfterBonus, formattedAfterReal, afterRealMinor.toString(), wallet.id]
      );

      // 7. Insert Immutable Ledger Entries for BOTH Legs
      const debitEntryId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_deb`;
      const creditEntryId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_cred`;

      const debitTxId = `${rootTxId}:BONUS_DEBIT`;
      const creditTxId = `${rootTxId}:REAL_CREDIT`;

      // Leg 1: BONUS DEBIT
      await client.query(
        `INSERT INTO ledger_entries (
           id, wallet_id, user_id, transaction_id, reference_transaction_id,
           type, balance_target, amount_minor, currency, before_balance_minor, after_balance_minor,
           status, correlation_id, audit_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          debitEntryId,
          wallet.id,
          normalizedUserId,
          debitTxId,
          rootTxId,
          'DEBIT',
          'BONUS',
          amountMinor.toString(),
          currency,
          beforeBonusMinor.toString(),
          afterBonusMinor.toString(),
          'COMMITTED',
          correlationId,
          JSON.stringify({
            ...sanitizedAudit,
            leg: 'BONUS_DEBIT',
            targetBalance: 'BONUS',
            transferType: 'BONUS_TO_REAL',
            wageringRequirementId: req.wageringRequirementId
          })
        ]
      );

      // Leg 2: REAL CREDIT
      await client.query(
        `INSERT INTO ledger_entries (
           id, wallet_id, user_id, transaction_id, reference_transaction_id,
           type, balance_target, amount_minor, currency, before_balance_minor, after_balance_minor,
           status, correlation_id, audit_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          creditEntryId,
          wallet.id,
          normalizedUserId,
          creditTxId,
          rootTxId,
          'CREDIT',
          'REAL',
          amountMinor.toString(),
          currency,
          beforeRealMinor.toString(),
          afterRealMinor.toString(),
          'COMMITTED',
          correlationId,
          JSON.stringify({
            ...sanitizedAudit,
            leg: 'REAL_CREDIT',
            targetBalance: 'REAL',
            transferType: 'BONUS_TO_REAL',
            wageringRequirementId: req.wageringRequirementId
          })
        ]
      );

      // 8. Construct Result & Record Single Idempotency Authority
      const result: BonusToRealTransferResult = {
        success: true,
        isIdempotent: false,
        transactionId: rootTxId,
        userId: normalizedUserId,
        currency,
        amountMinor: amountMinor.toString(),
        amountMajor: formatMinorUnits(amountMinor, currency),
        debitEntryId,
        creditEntryId,
        beforeBonusBalanceMinor: beforeBonusMinor.toString(),
        afterBonusBalanceMinor: afterBonusMinor.toString(),
        beforeRealBalanceMinor: beforeRealMinor.toString(),
        afterRealBalanceMinor: afterRealMinor.toString(),
        bonusBalanceMajor: formattedAfterBonus,
        realBalanceMajor: formattedAfterReal,
        correlationId,
        timestamp: new Date().toISOString()
      };

      await client.query(
        `INSERT INTO idempotency_records (
           idempotency_key, transaction_id, status_code, response_payload
         )
         VALUES ($1, $2, $3, $4)`,
        [idempotencyKey, rootTxId, 200, JSON.stringify(result)]
      );

      // 9. COMMIT Transaction
      await client.query('COMMIT');

      safeLog('info', correlationId, `[Ledger] Bonus-to-real transfer committed successfully: ${rootTxId}`, {
        debitEntryId,
        creditEntryId,
        bonusAfter: formattedAfterBonus,
        realAfter: formattedAfterReal
      });

      return result;
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});

      if (err.code === '23505') {
        const recovery = await this.db.query<{ response_payload: BonusToRealTransferResult }>(
          `SELECT response_payload FROM idempotency_records WHERE idempotency_key = $1 LIMIT 1`,
          [idempotencyKey]
        );
        if (recovery.rows.length > 0) {
          const rawRec = recovery.rows[0].response_payload;
          const cachedRec = typeof rawRec === 'string' ? JSON.parse(rawRec) : rawRec;
          return {
            ...cachedRec,
            isIdempotent: true
          };
        }
      }

      safeLog('error', correlationId, `[Ledger] Bonus-to-real transfer failed: ${err.message}`, {
        code: err.code,
        name: err.name
      });

      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Validates that an existing cached idempotency payload strictly matches the authoritative request fingerprint.
   * Throws IdempotencyConflictError if ANY canonical field differs.
   */
  private validateWithdrawalFingerprint(
    idempotencyKey: string,
    cachedPayload: any,
    currentFingerprint: WithdrawalReservationFingerprint
  ): void {
    const cachedFp: Partial<WithdrawalReservationFingerprint> = cachedPayload.fingerprint || {
      userId: String(cachedPayload.userId || '').trim(),
      currency: cachedPayload.currency,
      amount: cachedPayload.amount,
      paymentMethod: String(cachedPayload.paymentMethod || cachedPayload.method || '').trim().toUpperCase(),
      receiverAccount: String(cachedPayload.receiverNumber || cachedPayload.recipientAccount || '').trim(),
      operationType: 'WITHDRAWAL_RESERVATION'
    };

    const matches = (
      String(cachedFp.userId).trim() === currentFingerprint.userId &&
      cachedFp.currency === currentFingerprint.currency &&
      cachedFp.amount === currentFingerprint.amount &&
      String(cachedFp.paymentMethod || '').trim().toUpperCase() === currentFingerprint.paymentMethod &&
      String(cachedFp.receiverAccount || '').trim() === currentFingerprint.receiverAccount &&
      (cachedFp.operationType === undefined || cachedFp.operationType === 'WITHDRAWAL_RESERVATION')
    );

    if (!matches) {
      throw new IdempotencyConflictError(idempotencyKey, {
        expected: cachedFp,
        provided: currentFingerprint
      });
    }
  }

  /**
   * PLAY369 Task 6.1.6 & 6.1.6.1: Atomic Withdrawal Funds Reservation & Strict Idempotency Contract
   * Atomically transfers funds: REAL BALANCE -> LOCKED BALANCE within a single PostgreSQL transaction.
   * 
   * Invariants:
   * 1. Acquires row lock on wallet: `SELECT ... FOR UPDATE`
   * 2. Integer Minor Units (zero floating-point math)
   * 3. Atomically debits REAL balance and credits LOCKED balance
   * 4. Inserts 2 immutable ledger entries (REAL DEBIT and LOCKED CREDIT)
   * 5. Inserts the PENDING payment_requests record
   * 6. Records and enforces strict authoritative idempotency fingerprint
   * 7. Commits or rolls back atomically
   */
  public async reserveWithdrawalFunds(req: WithdrawalReservationRequest): Promise<WithdrawalReservationResult> {
    // 1. Validation & Input Sanitization
    if (req.userId === undefined || req.userId === null || String(req.userId).trim() === '') {
      throw new LedgerValidationError("Valid userId is required for withdrawal reservation", { userId: req.userId });
    }
    if (!req.amount || String(req.amount).trim() === '') {
      throw new LedgerValidationError("Withdrawal amount is required", { amount: req.amount });
    }
    if (!req.paymentMethod && !req.method) {
      throw new LedgerValidationError("Payment method is required", { paymentMethod: req.paymentMethod });
    }

    const normalizedUserId = String(req.userId).trim();
    const currency = validateCurrency(req.currency);
    const amountMinor = parseToMinorUnits(req.amount, currency, false);
    const normalizedAmount = req.amount.trim();
    const normalizedPaymentMethod = String(req.paymentMethod || req.method || '').trim().toUpperCase();
    const normalizedReceiverAccount = String(req.receiverNumber || req.recipientAccount || '').trim();

    if (amountMinor <= 0n) {
      throw new LedgerValidationError("Withdrawal amount must be strictly greater than zero", { amount: req.amount });
    }

    const correlationId = req.correlationId || `corr_wdraw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Canonical Idempotency Fingerprint
    const canonicalFingerprint: WithdrawalReservationFingerprint = {
      userId: normalizedUserId,
      currency,
      amount: normalizedAmount,
      paymentMethod: normalizedPaymentMethod,
      receiverAccount: normalizedReceiverAccount,
      operationType: 'WITHDRAWAL_RESERVATION'
    };

    // Validate idempotencyKey length if explicitly provided
    if (req.idempotencyKey !== undefined && req.idempotencyKey !== null) {
      if (typeof req.idempotencyKey !== 'string') {
        throw new LedgerValidationError("Idempotency key must be a string", { code: 'INVALID_IDEMPOTENCY_KEY' });
      }
      const trimmedKey = req.idempotencyKey.trim();
      if (trimmedKey.length < 8 || trimmedKey.length > 128) {
        throw new LedgerValidationError("Idempotency key must be between 8 and 128 characters", { code: 'INVALID_IDEMPOTENCY_KEY' });
      }
    }

    const idempotencyKey = (
      req.idempotencyKey && req.idempotencyKey.trim() !== ''
        ? req.idempotencyKey.trim()
        : this.generateIdempotencyKey(
            normalizedUserId,
            currency,
            `wdraw_res:${req.withdrawalId || normalizedAmount + ':' + normalizedPaymentMethod}`
          )
    );

    // Derive deterministic transaction ID using cryptographic SHA-256 (PLAY369 Task 6.1.6.2)
    const rootTxId = (
      req.withdrawalId && String(req.withdrawalId).trim() !== ''
        ? String(req.withdrawalId).trim()
        : deriveWithdrawalTransactionId(normalizedUserId, idempotencyKey)
    );

    const sanitizedAudit = maskSensitiveData(req.metadata || {});

    // 2. Pre-transaction Idempotency Check (Fast Path)
    const existingIdemp = await this.db.query<{ response_payload: WithdrawalReservationResult }>(
      `SELECT idempotency_key, response_payload 
       FROM idempotency_records 
       WHERE idempotency_key = $1 
       LIMIT 1`,
      [idempotencyKey]
    );

    if (existingIdemp.rows.length > 0) {
      const rawPayload = existingIdemp.rows[0].response_payload;
      const cached = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;

      // Verify that idempotency key matches all canonical fields
      this.validateWithdrawalFingerprint(idempotencyKey, cached, canonicalFingerprint);

      safeLog('info', correlationId, `[Ledger] Idempotent withdrawal reservation returned cached payload: ${rootTxId}`);
      return {
        ...cached,
        isIdempotent: true
      };
    }

    // 3. Connect & Begin ACID Transaction
    const client: ILedgerDbClient = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 4. Row-Level Locking (SELECT ... FOR UPDATE)
      const walletRes = await client.query<{
        id: string | number;
        user_id: string | number;
        currency: SupportedCurrency;
        real_balance?: string | number;
        bonus_balance?: string | number;
        locked_balance?: string | number;
        balance_minor?: string | number | bigint;
        version: string | number;
        status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
      }>(
        `SELECT id, user_id, currency, real_balance, bonus_balance, locked_balance, balance_minor, version, status
         FROM wallets
         WHERE user_id = $1 AND currency = $2
         FOR UPDATE`,
        [normalizedUserId, currency]
      );

      if (walletRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new WalletNotFoundError(normalizedUserId, currency);
      }

      const wallet = walletRes.rows[0];

      // 5. Invariant Checks
      if (wallet.status !== 'ACTIVE') {
        await client.query('ROLLBACK');
        throw new WalletFrozenError(normalizedUserId, wallet.status);
      }

      let beforeRealMinor: bigint;
      if (wallet.balance_minor !== undefined && wallet.balance_minor !== null && wallet.balance_minor !== '') {
        beforeRealMinor = BigInt(wallet.balance_minor.toString());
      } else if (wallet.real_balance !== undefined && wallet.real_balance !== null) {
        beforeRealMinor = parseToMinorUnits(wallet.real_balance.toString(), currency, true);
      } else {
        beforeRealMinor = 0n;
      }

      const beforeLockedStr = wallet.locked_balance !== undefined && wallet.locked_balance !== null ? wallet.locked_balance.toString() : '0.0000';
      const beforeLockedMinor = parseToMinorUnits(beforeLockedStr, currency, true);

      // Verify sufficient REAL balance before reservation
      if (beforeRealMinor < amountMinor) {
        await client.query('ROLLBACK');
        safeLog('warn', correlationId, `[Ledger] Insufficient funds for withdrawal reservation: available=${beforeRealMinor}, required=${amountMinor}`);
        throw new InsufficientFundsError(beforeRealMinor, amountMinor, currency);
      }

      const afterRealMinor = beforeRealMinor - amountMinor;
      const afterLockedMinor = beforeLockedMinor + amountMinor;

      const formattedBeforeReal = formatMinorUnits(beforeRealMinor, currency);
      const formattedAfterReal = formatMinorUnits(afterRealMinor, currency);
      const formattedBeforeLocked = formatMinorUnits(beforeLockedMinor, currency);
      const formattedAfterLocked = formatMinorUnits(afterLockedMinor, currency);

      // 6. Update Canonical Wallet Balances (Atomic Update of real_balance, locked_balance, balance_minor)
      await client.query(
        `UPDATE wallets
         SET real_balance = $1,
             locked_balance = $2,
             balance_minor = $3,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $4`,
        [formattedAfterReal, formattedAfterLocked, afterRealMinor.toString(), wallet.id]
      );

      // 7. Insert Immutable Ledger Entries for BOTH Legs
      const debitEntryId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_wdeb`;
      const lockEntryId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_wlock`;

      const debitTxId = `${rootTxId}:WITHDRAWAL_DEBIT`;
      const lockTxId = `${rootTxId}:WITHDRAWAL_LOCK`;

      // Leg 1: REAL DEBIT
      await client.query(
        `INSERT INTO ledger_entries (
           id, wallet_id, user_id, transaction_id, reference_transaction_id,
           type, balance_target, amount_minor, currency, before_balance_minor, after_balance_minor,
           status, correlation_id, audit_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          debitEntryId,
          wallet.id,
          normalizedUserId,
          debitTxId,
          rootTxId,
          'DEBIT',
          'REAL',
          amountMinor.toString(),
          currency,
          beforeRealMinor.toString(),
          afterRealMinor.toString(),
          'COMMITTED',
          correlationId,
          JSON.stringify({
            ...sanitizedAudit,
            leg: 'REAL_DEBIT',
            targetBalance: 'REAL',
            category: 'WITHDRAWAL_RESERVATION',
            withdrawalId: rootTxId,
            paymentMethod: normalizedPaymentMethod
          })
        ]
      );

      // Leg 2: LOCKED CREDIT
      await client.query(
        `INSERT INTO ledger_entries (
           id, wallet_id, user_id, transaction_id, reference_transaction_id,
           type, balance_target, amount_minor, currency, before_balance_minor, after_balance_minor,
           status, correlation_id, audit_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          lockEntryId,
          wallet.id,
          normalizedUserId,
          lockTxId,
          rootTxId,
          'CREDIT',
          'LOCKED',
          amountMinor.toString(),
          currency,
          beforeLockedMinor.toString(),
          afterLockedMinor.toString(),
          'COMMITTED',
          correlationId,
          JSON.stringify({
            ...sanitizedAudit,
            leg: 'LOCKED_CREDIT',
            targetBalance: 'LOCKED',
            category: 'WITHDRAWAL_RESERVATION',
            withdrawalId: rootTxId,
            paymentMethod: normalizedPaymentMethod
          })
        ]
      );

      // 8. Insert Payment Request Record atomically
      const paymentReqRes = await client.query<{ id: string | number }>(
        `INSERT INTO payment_requests (
           user_id, wallet_id, type, method, amount, currency,
           receiver_number, trx_id, status, admin_note, metadata, created_at, updated_at
         )
         VALUES ($1, $2, 'WITHDRAWAL', $3, $4, $5, $6, $7, 'PENDING', $8, $9, NOW(), NOW())
         RETURNING id`,
        [
          normalizedUserId,
          wallet.id,
          normalizedPaymentMethod,
          normalizedAmount,
          currency,
          normalizedReceiverAccount || null,
          rootTxId,
          req.adminNote || null,
          JSON.stringify({
            ...sanitizedAudit,
            withdrawalId: rootTxId,
            debitLedgerEntryId: debitEntryId,
            lockLedgerEntryId: lockEntryId,
            correlationId
          })
        ]
      );

      const paymentRequestId = paymentReqRes.rows[0]?.id ?? `pr_${Date.now()}`;

      // 9. Construct Result & Record Single Idempotency Authority
      const result: WithdrawalReservationResult = {
        withdrawalId: rootTxId,
        paymentRequestId,
        transactionId: rootTxId,
        status: 'PENDING',
        amount: normalizedAmount,
        currency,
        userId: normalizedUserId,
        walletId: wallet.id,
        paymentMethod: normalizedPaymentMethod,
        receiverNumber: normalizedReceiverAccount,
        recipientAccount: normalizedReceiverAccount,
        beforeRealBalance: formattedBeforeReal,
        afterRealBalance: formattedAfterReal,
        beforeLockedBalance: formattedBeforeLocked,
        afterLockedBalance: formattedAfterLocked,
        debitLedgerEntryId: debitEntryId,
        lockLedgerEntryId: lockEntryId,
        isIdempotent: false,
        fingerprint: canonicalFingerprint,
        executedAt: new Date().toISOString(),
        correlationId
      };

      await client.query(
        `INSERT INTO idempotency_records (
           idempotency_key, transaction_id, status_code, response_payload
         )
         VALUES ($1, $2, $3, $4)`,
        [idempotencyKey, rootTxId, 200, JSON.stringify(result)]
      );

      // 10. COMMIT Transaction
      await client.query('COMMIT');

      safeLog('info', correlationId, `[Ledger] Withdrawal funds reserved atomically: ${rootTxId}`, {
        debitEntryId,
        lockEntryId,
        paymentRequestId,
        realAfter: formattedAfterReal,
        lockedAfter: formattedAfterLocked
      });

      return result;
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});

      if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('idempotency') || err.message?.includes('payment_requests')) {
        const recovery = await this.db.query<{ response_payload: WithdrawalReservationResult }>(
          `SELECT response_payload FROM idempotency_records WHERE idempotency_key = $1 LIMIT 1`,
          [idempotencyKey]
        );
        if (recovery.rows.length > 0) {
          const rawRec = recovery.rows[0].response_payload;
          const cachedRec = typeof rawRec === 'string' ? JSON.parse(rawRec) : rawRec;
          this.validateWithdrawalFingerprint(idempotencyKey, cachedRec, canonicalFingerprint);
          return {
            ...cachedRec,
            isIdempotent: true
          };
        }
      }

      safeLog('error', correlationId, `[Ledger] Withdrawal funds reservation failed: ${err.message}`, {
        code: err.code,
        name: err.name
      });

      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Performs an audit reconciliation between the wallet balances (REAL, BONUS, LOCKED) and sum of ledger entries.
   * Invariants:
   * - REAL: wallet.balance_minor === initial_seed + SUM(REAL credits + reversals) - SUM(REAL debits)
   * - BONUS: toMinor(wallet.bonus_balance) === initial_seed + SUM(BONUS credits + reversals) - SUM(BONUS debits)
   * - LOCKED: toMinor(wallet.locked_balance) === initial_seed + SUM(LOCKED credits + reversals) - SUM(LOCKED debits)
   * REAL, BONUS, and LOCKED entries are strictly separated so rewards or reservations never cause false discrepancies.
   */
  public async auditReconciliation(
    userId: string | number,
    currency: string,
    targetBalance?: LedgerBalanceTarget
  ): Promise<WalletAuditReconciliationResult> {
    const wallet = await this.getWallet(userId, currency);

    // 1. Audit REAL ledger entries
    const realRes = await this.db.query<{
      total_credits: string;
      total_debits: string;
      net_minor: string;
      initial_seed_minor?: string | null;
      entry_count?: string | number;
    }>(
      `SELECT 
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE 0 END), 0) AS total_credits,
         COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount_minor ELSE 0 END), 0) AS total_debits,
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE -amount_minor END), 0) AS net_minor,
         (SELECT before_balance_minor FROM ledger_entries WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'REAL' AND status = 'COMMITTED' ORDER BY created_at ASC, id ASC LIMIT 1) AS initial_seed_minor,
         COUNT(*) AS entry_count
       FROM ledger_entries
       WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'REAL' AND status = 'COMMITTED'`,
      [wallet.id]
    );

    // 2. Audit BONUS ledger entries
    const bonusRes = await this.db.query<{
      total_credits: string;
      total_debits: string;
      net_minor: string;
      initial_seed_minor?: string | null;
      entry_count?: string | number;
    }>(
      `SELECT 
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE 0 END), 0) AS total_credits,
         COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount_minor ELSE 0 END), 0) AS total_debits,
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE -amount_minor END), 0) AS net_minor,
         (SELECT before_balance_minor FROM ledger_entries WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'BONUS' AND status = 'COMMITTED' ORDER BY created_at ASC, id ASC LIMIT 1) AS initial_seed_minor,
         COUNT(*) AS entry_count
       FROM ledger_entries
       WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'BONUS' AND status = 'COMMITTED'`,
      [wallet.id]
    );

    // 3. Audit LOCKED ledger entries
    const lockedRes = await this.db.query<{
      total_credits: string;
      total_debits: string;
      net_minor: string;
      initial_seed_minor?: string | null;
      entry_count?: string | number;
    }>(
      `SELECT 
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE 0 END), 0) AS total_credits,
         COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount_minor ELSE 0 END), 0) AS total_debits,
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE -amount_minor END), 0) AS net_minor,
         (SELECT before_balance_minor FROM ledger_entries WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'LOCKED' AND status = 'COMMITTED' ORDER BY created_at ASC, id ASC LIMIT 1) AS initial_seed_minor,
         COUNT(*) AS entry_count
       FROM ledger_entries
       WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'LOCKED' AND status = 'COMMITTED'`,
      [wallet.id]
    );

    const realWalletMinor = wallet.balanceMinor;
    const realRow = realRes.rows[0];
    const realEntryCount = Number(realRow?.entry_count || 0);
    const realNetLedgerMinor = BigInt(realRow?.net_minor || '0');
    const realSeedMinor = realEntryCount > 0 && realRow?.initial_seed_minor !== undefined && realRow?.initial_seed_minor !== null
      ? BigInt(realRow.initial_seed_minor)
      : realWalletMinor;
    const expectedRealMinor = realEntryCount > 0 ? realSeedMinor + realNetLedgerMinor : realWalletMinor;
    const realDiscrepancyMinor = (realWalletMinor - expectedRealMinor).toString();
    const realIsReconciled = realDiscrepancyMinor === '0';

    const bonusWalletStr = wallet.bonusBalance || '0.0000';
    const bonusWalletMinor = parseToMinorUnits(bonusWalletStr, wallet.currency, true);
    const bonusRow = bonusRes.rows[0];
    const bonusEntryCount = Number(bonusRow?.entry_count || 0);
    const bonusNetLedgerMinor = BigInt(bonusRow?.net_minor || '0');
    const bonusSeedMinor = bonusEntryCount > 0 && bonusRow?.initial_seed_minor !== undefined && bonusRow?.initial_seed_minor !== null
      ? BigInt(bonusRow.initial_seed_minor)
      : bonusWalletMinor;
    const expectedBonusMinor = bonusEntryCount > 0 ? bonusSeedMinor + bonusNetLedgerMinor : bonusWalletMinor;
    const bonusDiscrepancyMinor = (bonusWalletMinor - expectedBonusMinor).toString();
    const bonusIsReconciled = bonusDiscrepancyMinor === '0';

    const lockedWalletStr = wallet.lockedBalance || '0.0000';
    const lockedWalletMinor = parseToMinorUnits(lockedWalletStr, wallet.currency, true);
    const lockedRow = lockedRes.rows[0];
    const lockedEntryCount = Number(lockedRow?.entry_count || 0);
    const lockedNetLedgerMinor = BigInt(lockedRow?.net_minor || '0');
    const lockedSeedMinor = lockedEntryCount > 0 && lockedRow?.initial_seed_minor !== undefined && lockedRow?.initial_seed_minor !== null
      ? BigInt(lockedRow.initial_seed_minor)
      : lockedWalletMinor;
    const expectedLockedMinor = lockedEntryCount > 0 ? lockedSeedMinor + lockedNetLedgerMinor : lockedWalletMinor;
    const lockedDiscrepancyMinor = (lockedWalletMinor - expectedLockedMinor).toString();
    const lockedIsReconciled = lockedDiscrepancyMinor === '0';

    const realSummary: BalanceTargetReconciliationSummary = {
      isReconciled: realIsReconciled,
      walletBalanceMinor: realWalletMinor.toString(),
      walletBalanceMajor: wallet.realBalance || formatMinorUnits(realWalletMinor, wallet.currency),
      computedLedgerNetMinor: realNetLedgerMinor.toString(),
      discrepancyMinor: realDiscrepancyMinor
    };

    const bonusSummary: BalanceTargetReconciliationSummary = {
      isReconciled: bonusIsReconciled,
      walletBalanceMinor: bonusWalletMinor.toString(),
      walletBalanceMajor: bonusWalletStr,
      computedLedgerNetMinor: bonusNetLedgerMinor.toString(),
      discrepancyMinor: bonusDiscrepancyMinor
    };

    const lockedSummary: BalanceTargetReconciliationSummary = {
      isReconciled: lockedIsReconciled,
      walletBalanceMinor: lockedWalletMinor.toString(),
      walletBalanceMajor: lockedWalletStr,
      computedLedgerNetMinor: lockedNetLedgerMinor.toString(),
      discrepancyMinor: lockedDiscrepancyMinor
    };

    if (targetBalance === 'BONUS') {
      return {
        isReconciled: bonusIsReconciled,
        walletBalanceMinor: bonusSummary.walletBalanceMinor,
        walletBalanceMajor: bonusSummary.walletBalanceMajor,
        computedLedgerNetMinor: bonusSummary.computedLedgerNetMinor,
        discrepancyMinor: bonusSummary.discrepancyMinor,
        real: realSummary,
        bonus: bonusSummary,
        locked: lockedSummary
      };
    }

    if (targetBalance === 'LOCKED') {
      return {
        isReconciled: lockedIsReconciled,
        walletBalanceMinor: lockedSummary.walletBalanceMinor,
        walletBalanceMajor: lockedSummary.walletBalanceMajor,
        computedLedgerNetMinor: lockedSummary.computedLedgerNetMinor,
        discrepancyMinor: lockedSummary.discrepancyMinor,
        real: realSummary,
        bonus: bonusSummary,
        locked: lockedSummary
      };
    }

    return {
      isReconciled: realIsReconciled && bonusIsReconciled && lockedIsReconciled,
      walletBalanceMinor: realSummary.walletBalanceMinor,
      walletBalanceMajor: realSummary.walletBalanceMajor,
      computedLedgerNetMinor: realSummary.computedLedgerNetMinor,
      discrepancyMinor: realSummary.discrepancyMinor,
      real: realSummary,
      bonus: bonusSummary,
      locked: lockedSummary
    };
  }
}

// Global default in-memory instance for testing and runtime fallback
export const inMemoryLedgerDb = new InMemoryPostgresLedgerEngine();
export const walletLedgerService = new WalletLedgerService(inMemoryLedgerDb);
