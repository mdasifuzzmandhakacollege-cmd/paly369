/**
 * @file db.ts
 * @description Parameterized Database Client and In-Memory ACID Transactional Engine for testing/local verification.
 * 
 * [SECURITY RULE]:
 * - Parameterized SQL queries only ($1, $2, etc.).
 * - Enforces transactional isolation and atomic rollback on failures.
 * - Supports PostgreSQL row-level locking semantics (SELECT ... FOR UPDATE).
 */

import pg from 'pg';
import { maskSensitiveData } from '../gateway/masking';

export interface IDbResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface ILedgerDbClient {
  query<T = any>(sql: string, params?: any[]): Promise<IDbResult<T>>;
  release(): void | Promise<void>;
}

export interface ILedgerDbPool {
  connect(): Promise<ILedgerDbClient>;
  query<T = any>(sql: string, params?: any[]): Promise<IDbResult<T>>;
}

/**
 * Production-Grade PostgreSQL Connection Pool for Wallet Ledger.
 * Uses real pg.Pool connecting via DATABASE_URL or PoolConfig with robust connection lifecycle.
 */
export class PostgresLedgerPool implements ILedgerDbPool {
  private pool: pg.Pool;

  constructor(connectionStringOrConfig?: string | pg.PoolConfig) {
    if (typeof connectionStringOrConfig === 'string') {
      this.pool = new pg.Pool({ connectionString: connectionStringOrConfig });
    } else if (connectionStringOrConfig) {
      this.pool = new pg.Pool(connectionStringOrConfig);
    } else {
      this.pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL
      });
    }

    this.pool.on('error', (err) => {
      console.error('[PostgresLedgerPool] Unexpected idle client error:', err);
    });
  }

  public async connect(): Promise<ILedgerDbClient> {
    const client = await this.pool.connect();
    return {
      query: async <T = any>(sql: string, params?: any[]): Promise<IDbResult<T>> => {
        const result = await client.query(sql, params);
        return {
          rows: result.rows as T[],
          rowCount: result.rowCount ?? result.rows.length
        };
      },
      release: () => {
        client.release();
      }
    };
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<IDbResult<T>> {
    const result = await this.pool.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? result.rows.length
    };
  }

  public async end(): Promise<void> {
    await this.pool.end();
  }

  public getRawPool(): pg.Pool {
    return this.pool;
  }
}

/**
 * In-Memory ACID Ledger Database Engine for standalone testing and mock verification.
 * Simulates PostgreSQL row-level locks (SELECT ... FOR UPDATE), transactions (BEGIN/COMMIT/ROLLBACK),
 * table constraints, and unique indices with complete parameterization.
 */
export class InMemoryPostgresLedgerEngine implements ILedgerDbPool {
  private users: Map<string, any> = new Map();
  private wallets: Map<string, any> = new Map(); // key: `${userId}:${currency}`
  private ledgerEntries: Map<string, any> = new Map(); // key: id
  private idempotencyRecords: Map<string, any> = new Map(); // key: idempotencyKey
  private paymentRequests: Map<string | number, any> = new Map(); // key: id
  private walletLocks: Map<string, Promise<void>> = new Map(); // Mutex per wallet for row locks
  private lockResolvers: Map<string, () => void> = new Map();

  constructor() {
    this.seedDefaultUsers();
  }

  private seedDefaultUsers() {
    this.users.set('test_player_01', {
      id: 'test_player_01',
      username: 'player_one',
      status: 'ACTIVE',
      currency: 'BDT'
    });
    this.wallets.set('test_player_01:BDT', {
      id: 1,
      user_id: 'test_player_01',
      currency: 'BDT',
      real_balance: '500.0000',
      bonus_balance: '0.0000',
      locked_balance: '0.0000',
      balance_minor: 5000000n, // 500.0000 BDT (4-decimal precision = 5,000,000 minor units)
      version: 1n,
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  public async connect(): Promise<ILedgerDbClient> {
    const activeTxState = {
      inTransaction: false,
      acquiredLocks: new Set<string>(),
      stagedWallets: new Map<string, any>(),
      stagedEntries: new Map<string, any>(),
      stagedIdempotency: new Map<string, any>(),
      stagedPaymentRequests: new Map<string | number, any>()
    };

    const client: ILedgerDbClient = {
      query: async <T = any>(sql: string, params: any[] = []): Promise<IDbResult<T>> => {
        const cleanSql = sql.trim().replace(/\s+/g, ' ');

        // 1. BEGIN
        if (cleanSql.toUpperCase() === 'BEGIN') {
          activeTxState.inTransaction = true;
          return { rows: [], rowCount: 0 };
        }

        // 2. COMMIT
        if (cleanSql.toUpperCase() === 'COMMIT') {
          if (activeTxState.inTransaction) {
            // Apply staged mutations to master storage
            for (const [k, v] of activeTxState.stagedWallets.entries()) {
              this.wallets.set(k, { ...v });
            }
            for (const [k, v] of activeTxState.stagedEntries.entries()) {
              this.ledgerEntries.set(k, { ...v });
            }
            for (const [k, v] of activeTxState.stagedIdempotency.entries()) {
              this.idempotencyRecords.set(k, { ...v });
            }
            for (const [k, v] of activeTxState.stagedPaymentRequests.entries()) {
              this.paymentRequests.set(k, { ...v });
            }
          }
          this.releaseLocks(activeTxState);
          activeTxState.inTransaction = false;
          return { rows: [], rowCount: 0 };
        }

        // 3. ROLLBACK
        if (cleanSql.toUpperCase() === 'ROLLBACK') {
          activeTxState.stagedWallets.clear();
          activeTxState.stagedEntries.clear();
          activeTxState.stagedIdempotency.clear();
          activeTxState.stagedPaymentRequests.clear();
          this.releaseLocks(activeTxState);
          activeTxState.inTransaction = false;
          return { rows: [], rowCount: 0 };
        }

        // 4. SELECT FROM idempotency_records WHERE idempotency_key = $1
        if (cleanSql.includes('FROM idempotency_records') && cleanSql.includes('idempotency_key = $1')) {
          const key = params[0];
          const record = this.idempotencyRecords.get(key) || activeTxState.stagedIdempotency.get(key);
          if (record) {
            return {
              rows: [{
                idempotency_key: record.idempotency_key,
                transaction_id: record.transaction_id,
                status_code: record.status_code,
                response_payload: record.response_payload,
                created_at: record.created_at
              } as any],
              rowCount: 1
            };
          }
          return { rows: [], rowCount: 0 };
        }

        // 5. SELECT FROM wallets WHERE user_id = $1 (AND currency = $2) (FOR UPDATE)
        if (cleanSql.includes('FROM wallets') && (cleanSql.includes('user_id = $1') || cleanSql.includes('WHERE user_id = $1'))) {
          const userId = String(params[0]).trim();
          const currency = params[1] !== undefined ? String(params[1]).trim() : null;

          if (currency) {
            const walletKey = `${userId}:${currency}`;

            if (cleanSql.toUpperCase().includes('FOR UPDATE')) {
              // Acquire row-level lock
              await this.acquireRowLock(walletKey, activeTxState);
            }

            const existing = activeTxState.stagedWallets.get(walletKey) || this.wallets.get(walletKey);
            if (!existing) {
              return { rows: [], rowCount: 0 };
            }

            return {
              rows: [{
                id: existing.id,
                user_id: existing.user_id,
                currency: existing.currency,
                real_balance: existing.real_balance || (existing.balance_minor !== undefined ? (Number(existing.balance_minor) / 10000).toFixed(4) : '0.0000'),
                bonus_balance: existing.bonus_balance || '0.0000',
                locked_balance: existing.locked_balance || '0.0000',
                balance_minor: existing.balance_minor.toString(),
                version: existing.version.toString(),
                status: existing.status,
                created_at: existing.created_at,
                updated_at: existing.updated_at
              } as any],
              rowCount: 1
            };
          } else {
            // Find any wallet matching userId
            const matched: any[] = [];
            const source = activeTxState.inTransaction ? new Map([...this.wallets, ...activeTxState.stagedWallets]) : this.wallets;
            for (const existing of source.values()) {
              if (String(existing.user_id) === userId) {
                matched.push({
                  id: existing.id,
                  user_id: existing.user_id,
                  currency: existing.currency,
                  real_balance: existing.real_balance || (existing.balance_minor !== undefined ? (Number(existing.balance_minor) / 10000).toFixed(4) : '0.0000'),
                  bonus_balance: existing.bonus_balance || '0.0000',
                  locked_balance: existing.locked_balance || '0.0000',
                  balance_minor: existing.balance_minor.toString(),
                  version: existing.version.toString(),
                  status: existing.status,
                  created_at: existing.created_at,
                  updated_at: existing.updated_at
                });
              }
            }
            return { rows: matched as any[], rowCount: matched.length };
          }
        }

        // 6. INSERT INTO wallets
        if (cleanSql.startsWith('INSERT INTO wallets')) {
          let id: any = Math.floor(Math.random() * 100000) + 1;
          let userId: string = '';
          let currency: string = 'BDT';
          let realBalance: string = '0.0000';
          let bonusBalance: string = '0.0000';
          let lockedBalance: string = '0.0000';
          let balanceMinor: bigint = 0n;
          let status: string = 'ACTIVE';

          const colMatch = cleanSql.match(/INSERT INTO wallets\s*\(([^)]+)\)/i);
          if (colMatch) {
            const cols = colMatch[1].split(',').map((c) => c.trim().toLowerCase());
            const colMap: Record<string, any> = {};
            cols.forEach((col, idx) => {
              colMap[col] = params[idx];
            });

            if (colMap.id !== undefined) id = colMap.id;
            if (colMap.user_id !== undefined) userId = String(colMap.user_id).trim();
            if (colMap.currency !== undefined) currency = String(colMap.currency).trim();
            if (colMap.real_balance !== undefined) realBalance = String(colMap.real_balance);
            if (colMap.bonus_balance !== undefined) bonusBalance = String(colMap.bonus_balance);
            if (colMap.locked_balance !== undefined) lockedBalance = String(colMap.locked_balance);
            if (colMap.status !== undefined) status = colMap.status;

            if (colMap.balance_minor !== undefined && colMap.balance_minor !== null && colMap.balance_minor !== '') {
              balanceMinor = BigInt(colMap.balance_minor.toString());
            } else if (colMap.real_balance !== undefined) {
              const parsed = Math.round(parseFloat(String(colMap.real_balance)) * 10000);
              balanceMinor = BigInt(isNaN(parsed) ? 0 : parsed);
            }
          } else if (cleanSql.includes('real_balance') && cleanSql.includes('bonus_balance')) {
            userId = String(params[0] ?? '').trim();
            currency = String(params[1] ?? 'BDT').trim();
            realBalance = params[2] !== undefined ? String(params[2]) : '0.0000';
            bonusBalance = params[3] !== undefined ? String(params[3]) : '0.0000';
            balanceMinor = params[4] !== undefined ? BigInt(params[4]) : 0n;
            status = params[5] || 'ACTIVE';
          } else if (cleanSql.includes('real_balance')) {
            userId = String(params[0] ?? '').trim();
            currency = String(params[1] ?? 'BDT').trim();
            realBalance = params[2] !== undefined ? String(params[2]) : '0.0000';
            balanceMinor = params[3] !== undefined ? BigInt(params[3]) : 0n;
            status = params[4] || 'ACTIVE';
          } else {
            // Legacy 5 params: id, user_id, currency, balance_minor, status
            id = params[0] !== undefined ? params[0] : id;
            userId = String(params[1] ?? '').trim();
            currency = String(params[2] ?? 'BDT').trim();
            balanceMinor = params[3] !== undefined ? BigInt(params[3]) : 0n;
            realBalance = (Number(balanceMinor) / 10000).toFixed(4);
            status = params[4] || 'ACTIVE';
          }

          const walletKey = `${userId}:${currency}`;

          if (this.wallets.has(walletKey) || activeTxState.stagedWallets.has(walletKey)) {
            if (cleanSql.toUpperCase().includes('ON CONFLICT') && cleanSql.toUpperCase().includes('DO NOTHING')) {
              return { rows: [], rowCount: 0 };
            }
            const err: any = new Error(`duplicate key value violates unique constraint "uq_wallet_user_currency"`);
            err.code = '23505';
            throw err;
          }

          const newWallet = {
            id,
            user_id: userId,
            currency,
            real_balance: realBalance,
            bonus_balance: bonusBalance,
            locked_balance: lockedBalance,
            balance_minor: balanceMinor,
            version: 1n,
            status,
            created_at: new Date(),
            updated_at: new Date()
          };

          if (activeTxState.inTransaction) {
            activeTxState.stagedWallets.set(walletKey, newWallet);
          } else {
            this.wallets.set(walletKey, newWallet);
          }

          return { rows: [{ id } as any], rowCount: 1 };
        }

        // 7. UPDATE wallets SET ...
        if (cleanSql.startsWith('UPDATE wallets')) {
          let realBalance: string | null = null;
          let bonusBalance: string | null = null;
          let lockedBalance: string | null = null;
          let balanceMinor: bigint | null = null;
          let walletId: any;

          if (cleanSql.includes('real_balance = $1') && cleanSql.includes('locked_balance = $2') && cleanSql.includes('balance_minor = $3')) {
            realBalance = String(params[0]);
            lockedBalance = String(params[1]);
            balanceMinor = BigInt(params[2]);
            walletId = params[3];
          } else if (cleanSql.includes('bonus_balance = $1') && cleanSql.includes('real_balance = $2')) {
            bonusBalance = String(params[0]);
            realBalance = String(params[1]);
            balanceMinor = BigInt(params[2]);
            walletId = params[3];
          } else if (cleanSql.includes('bonus_balance = $1')) {
            bonusBalance = String(params[0]);
            walletId = params[1];
          } else if (cleanSql.includes('real_balance = $1') && cleanSql.includes('balance_minor = $2')) {
            realBalance = String(params[0]);
            balanceMinor = BigInt(params[1]);
            walletId = params[2];
          } else if (cleanSql.includes('locked_balance = $1')) {
            lockedBalance = String(params[0]);
            walletId = params[1];
          } else {
            balanceMinor = BigInt(params[0]);
            walletId = params[1];
            realBalance = (Number(balanceMinor) / 10000).toFixed(4);
          }

          // Find wallet
          let targetKey: string | null = null;
          let targetWallet: any = null;

          for (const [k, v] of (activeTxState.inTransaction ? activeTxState.stagedWallets : this.wallets).entries()) {
            if (v.id == walletId) {
              targetKey = k;
              targetWallet = v;
              break;
            }
          }

          if (!targetWallet) {
            for (const [k, v] of this.wallets.entries()) {
              if (v.id == walletId) {
                targetKey = k;
                targetWallet = v;
                break;
              }
            }
          }

          if (!targetWallet || !targetKey) {
            return { rows: [], rowCount: 0 };
          }

          // Check balance non-negative constraint
          if (balanceMinor !== null && balanceMinor < 0n) {
            const err: any = new Error(`check constraint "chk_wallet_balance_non_negative" failed`);
            err.code = '23514';
            throw err;
          }

          const updated = {
            ...targetWallet,
            real_balance: realBalance ?? targetWallet.real_balance,
            bonus_balance: bonusBalance ?? targetWallet.bonus_balance ?? '0.0000',
            locked_balance: lockedBalance ?? targetWallet.locked_balance ?? '0.0000',
            balance_minor: balanceMinor !== null ? balanceMinor : targetWallet.balance_minor,
            version: targetWallet.version + 1n,
            updated_at: new Date()
          };

          if (activeTxState.inTransaction) {
            activeTxState.stagedWallets.set(targetKey, updated);
          } else {
            this.wallets.set(targetKey, updated);
          }

          return { rows: [{ id: walletId } as any], rowCount: 1 };
        }

        // 8. INSERT INTO payment_requests
        if (cleanSql.startsWith('INSERT INTO payment_requests')) {
          const id = this.paymentRequests.size + activeTxState.stagedPaymentRequests.size + 1;
          let userId: any = '';
          let walletId: any = '';
          let type: string = 'WITHDRAWAL';
          let method: string = '';
          let amount: string = '0.0000';
          let currency: string = 'BDT';
          let receiverNumber: any = null;
          let trxId: string = '';
          let status: string = 'PENDING';
          let adminNote: any = null;
          let metadata: any = null;

          const colMatch = cleanSql.match(/INSERT INTO payment_requests\s*\(([^)]+)\)/i);
          if (colMatch) {
            const cols = colMatch[1].split(',').map((c) => c.trim().toLowerCase());
            const colMap: Record<string, any> = {};
            let paramIdx = 0;
            // Map parameters to columns, accounting for literal SQL values
            cols.forEach((col) => {
              // check if column is mapped to a parameter placeholder $x or literal in query
              if (col === 'type' && cleanSql.toUpperCase().includes("'WITHDRAWAL'")) {
                type = 'WITHDRAWAL';
              } else if (col === 'type' && cleanSql.toUpperCase().includes("'DEPOSIT'")) {
                type = 'DEPOSIT';
              } else if (col === 'status' && cleanSql.toUpperCase().includes("'PENDING'")) {
                status = 'PENDING';
              } else if (col === 'created_at' || col === 'updated_at') {
                // NOW()
              } else {
                colMap[col] = params[paramIdx++];
              }
            });

            if (colMap.user_id !== undefined) userId = colMap.user_id;
            if (colMap.wallet_id !== undefined) walletId = colMap.wallet_id;
            if (colMap.type !== undefined) type = colMap.type;
            if (colMap.method !== undefined) method = colMap.method;
            if (colMap.amount !== undefined) amount = String(colMap.amount);
            if (colMap.currency !== undefined) currency = colMap.currency;
            if (colMap.receiver_number !== undefined) receiverNumber = colMap.receiver_number;
            if (colMap.trx_id !== undefined) trxId = colMap.trx_id;
            if (colMap.status !== undefined) status = colMap.status;
            if (colMap.admin_note !== undefined) adminNote = colMap.admin_note;
            if (colMap.metadata !== undefined) metadata = colMap.metadata;
          } else {
            userId = params[0];
            walletId = params[1];
            type = params[2] || 'WITHDRAWAL';
            method = params[3];
            amount = params[4];
            currency = params[5] || 'BDT';
            receiverNumber = params[6] || null;
            trxId = params[7];
            status = params[8] || 'PENDING';
            adminNote = params[9] || null;
            metadata = params[10] || null;
          }

          const reqRec = {
            id,
            user_id: userId,
            wallet_id: walletId,
            type,
            method,
            amount: String(amount),
            currency,
            receiver_number: receiverNumber ? String(receiverNumber) : null,
            trx_id: trxId,
            status,
            admin_note: adminNote,
            metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
            created_at: new Date(),
            updated_at: new Date()
          };

          if (activeTxState.inTransaction) {
            activeTxState.stagedPaymentRequests.set(id, reqRec);
          } else {
            this.paymentRequests.set(id, reqRec);
          }

          return { rows: [reqRec as any], rowCount: 1 };
        }

        // 9. SELECT FROM payment_requests
        if (cleanSql.includes('FROM payment_requests')) {
          const allReqs = [...this.paymentRequests.values(), ...activeTxState.stagedPaymentRequests.values()];
          if (cleanSql.includes('user_id = $1')) {
            const uId = params[0];
            const filtered = allReqs.filter((r) => r.user_id == uId);
            return { rows: filtered as any[], rowCount: filtered.length };
          }
          if (cleanSql.includes('trx_id = $1')) {
            const tId = params[0];
            const filtered = allReqs.filter((r) => r.trx_id === tId);
            return { rows: filtered as any[], rowCount: filtered.length };
          }
          return { rows: allReqs as any[], rowCount: allReqs.length };
        }

        // 10. INSERT INTO ledger_entries
        if (cleanSql.startsWith('INSERT INTO ledger_entries')) {
          let id: any;
          let walletId: any;
          let userId: any;
          let transactionId: any;
          let refTxId: any;
          let type: any;
          let balanceTarget: string = 'REAL';
          let amountMinor: any;
          let currency: any;
          let beforeMinor: any;
          let afterMinor: any;
          let status: any;
          let correlationId: any;
          let auditMetadata: any;

          if (params.length >= 14) {
            [
              id,
              walletId,
              userId,
              transactionId,
              refTxId,
              type,
              balanceTarget,
              amountMinor,
              currency,
              beforeMinor,
              afterMinor,
              status,
              correlationId,
              auditMetadata
            ] = params;
          } else {
            [
              id,
              walletId,
              userId,
              transactionId,
              refTxId,
              type,
              amountMinor,
              currency,
              beforeMinor,
              afterMinor,
              status,
              correlationId,
              auditMetadata
            ] = params;
            const parsedAudit = typeof auditMetadata === 'string' ? JSON.parse(auditMetadata) : auditMetadata;
            if (parsedAudit?.targetBalance === 'BONUS' || parsedAudit?.category === 'BONUS_CASH') {
              balanceTarget = 'BONUS';
            } else if (parsedAudit?.targetBalance === 'LOCKED') {
              balanceTarget = 'LOCKED';
            }
          }

          // Check target constraint: REAL, BONUS, LOCKED
          if (balanceTarget !== 'REAL' && balanceTarget !== 'BONUS' && balanceTarget !== 'LOCKED') {
            const err: any = new Error(`check constraint "chk_ledger_balance_target" failed`);
            err.code = '23514';
            throw err;
          }

          // Check unique constraint on (user_id, transaction_id)
          for (const existingEntry of [...this.ledgerEntries.values(), ...activeTxState.stagedEntries.values()]) {
            if (existingEntry.user_id === userId && existingEntry.transaction_id === transactionId) {
              const err: any = new Error(`duplicate key value violates unique constraint "uq_ledger_user_transaction"`);
              err.code = '23505';
              throw err;
            }
          }

          const entry = {
            id,
            wallet_id: walletId,
            user_id: userId,
            transaction_id: transactionId,
            reference_transaction_id: refTxId || null,
            type,
            balance_target: balanceTarget || 'REAL',
            amount_minor: BigInt(amountMinor),
            currency,
            before_balance_minor: BigInt(beforeMinor),
            after_balance_minor: BigInt(afterMinor),
            status: status || 'COMMITTED',
            correlation_id: correlationId,
            audit_metadata: typeof auditMetadata === 'string' ? JSON.parse(auditMetadata) : auditMetadata,
            created_at: new Date()
          };

          if (activeTxState.inTransaction) {
            activeTxState.stagedEntries.set(id, entry);
          } else {
            this.ledgerEntries.set(id, entry);
          }

          return { rows: [{ id } as any], rowCount: 1 };
        }

        // 11. INSERT INTO idempotency_records
        if (cleanSql.startsWith('INSERT INTO idempotency_records')) {
          const [key, txId, statusCode, payloadJson] = params;

          if (this.idempotencyRecords.has(key) || activeTxState.stagedIdempotency.has(key)) {
            const err: any = new Error(`duplicate key value violates unique constraint "uq_idempotency_key"`);
            err.code = '23505';
            throw err;
          }

          const rec = {
            idempotency_key: key,
            transaction_id: txId,
            status_code: statusCode,
            response_payload: typeof payloadJson === 'string' ? JSON.parse(payloadJson) : payloadJson,
            created_at: new Date()
          };

          if (activeTxState.inTransaction) {
            activeTxState.stagedIdempotency.set(key, rec);
          } else {
            this.idempotencyRecords.set(key, rec);
          }

          return { rows: [{ idempotency_key: key } as any], rowCount: 1 };
        }

        // 12. SELECT FROM ledger_entries WHERE transaction_id = $1 or user_id = $1
        if (cleanSql.includes('FROM ledger_entries') && cleanSql.includes('user_id = $1')) {
          const userId = String(params[0]).trim();
          const matched: any[] = [];
          for (const entry of this.ledgerEntries.values()) {
            if (String(entry.user_id) === userId) {
              matched.push({
                id: entry.id,
                wallet_id: entry.wallet_id,
                user_id: entry.user_id,
                transaction_id: entry.transaction_id,
                reference_transaction_id: entry.reference_transaction_id,
                type: entry.type,
                balance_target: entry.balance_target || 'REAL',
                amount_minor: entry.amount_minor !== undefined ? entry.amount_minor.toString() : '0',
                currency: entry.currency,
                before_balance_minor: entry.before_balance_minor !== undefined ? entry.before_balance_minor.toString() : '0',
                after_balance_minor: entry.after_balance_minor !== undefined ? entry.after_balance_minor.toString() : '0',
                status: entry.status,
                correlation_id: entry.correlation_id,
                audit_metadata: typeof entry.audit_metadata === 'object' ? JSON.stringify(entry.audit_metadata) : entry.audit_metadata,
                created_at: entry.created_at
              });
            }
          }
          return { rows: matched as any[], rowCount: matched.length };
        }

        if (cleanSql.includes('FROM ledger_entries') && cleanSql.includes('transaction_id = $1')) {
          const txId = params[0];
          for (const entry of this.ledgerEntries.values()) {
            if (entry.transaction_id === txId) {
              return {
                rows: [{
                  id: entry.id,
                  wallet_id: entry.wallet_id,
                  user_id: entry.user_id,
                  transaction_id: entry.transaction_id,
                  balance_target: entry.balance_target || 'REAL',
                  audit_metadata: entry.audit_metadata
                } as any],
                rowCount: 1
              };
            }
          }
          return { rows: [], rowCount: 0 };
        }

        // 13. Audit check: SUM ledger entries for a wallet (with balance_target filtering)
        if (cleanSql.includes('SUM') && cleanSql.includes('FROM ledger_entries')) {
          const walletId = params[0];
          const isBonusFilter = cleanSql.includes("'BONUS'") || params[1] === 'BONUS';
          const isLockedFilter = cleanSql.includes("'LOCKED'") || params[1] === 'LOCKED';
          const isRealFilter = cleanSql.includes("'REAL'") || params[1] === 'REAL';
          const targetFilter = isBonusFilter ? 'BONUS' : (isLockedFilter ? 'LOCKED' : (isRealFilter ? 'REAL' : null));

          let totalCredits = 0n;
          let totalDebits = 0n;
          let firstEntryBeforeMinor: bigint | null = null;
          let entryCount = 0;

          for (const entry of this.ledgerEntries.values()) {
            if (entry.wallet_id == walletId && entry.status === 'COMMITTED') {
              const entryTarget = entry.balance_target || (
                (entry.audit_metadata?.targetBalance === 'BONUS' || entry.audit_metadata?.category === 'BONUS_CASH')
                  ? 'BONUS'
                  : (entry.audit_metadata?.targetBalance === 'LOCKED' ? 'LOCKED' : 'REAL')
              );

              if (!targetFilter || entryTarget === targetFilter) {
                if (firstEntryBeforeMinor === null) {
                  firstEntryBeforeMinor = entry.before_balance_minor;
                }
                if (entry.type === 'CREDIT' || entry.type === 'REVERSAL') {
                  totalCredits += entry.amount_minor;
                } else if (entry.type === 'DEBIT') {
                  totalDebits += entry.amount_minor;
                }
                entryCount++;
              }
            }
          }

          return {
            rows: [{
              total_credits: totalCredits.toString(),
              total_debits: totalDebits.toString(),
              net_minor: (totalCredits - totalDebits).toString(),
              initial_seed_minor: firstEntryBeforeMinor !== null ? firstEntryBeforeMinor.toString() : null,
              entry_count: entryCount.toString()
            } as any],
            rowCount: 1
          };
        }

        return { rows: [], rowCount: 0 };
      },

      release: () => {
        if (activeTxState.inTransaction) {
          activeTxState.stagedWallets.clear();
          activeTxState.stagedEntries.clear();
          activeTxState.stagedIdempotency.clear();
          activeTxState.stagedPaymentRequests.clear();
          this.releaseLocks(activeTxState);
        }
      }
    };

    return client;
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<IDbResult<T>> {
    const client = await this.connect();
    try {
      return await client.query<T>(sql, params);
    } finally {
      client.release();
    }
  }

  private async acquireRowLock(walletKey: string, txState: { acquiredLocks: Set<string> }) {
    while (this.walletLocks.has(walletKey)) {
      await this.walletLocks.get(walletKey);
    }
    let resolver: () => void;
    const lockPromise = new Promise<void>((res) => {
      resolver = res;
    });
    this.walletLocks.set(walletKey, lockPromise);
    this.lockResolvers.set(walletKey, resolver!);
    txState.acquiredLocks.add(walletKey);
  }

  private releaseLocks(txState: { acquiredLocks: Set<string> }) {
    for (const key of txState.acquiredLocks) {
      const resolver = this.lockResolvers.get(key);
      if (resolver) {
        resolver();
        this.lockResolvers.delete(key);
      }
      this.walletLocks.delete(key);
    }
    txState.acquiredLocks.clear();
  }

  /**
   * Diagnostic helper to inspect master storage state
   */
  public getDebugSnapshot() {
    return {
      walletsCount: this.wallets.size,
      ledgerEntriesCount: this.ledgerEntries.size,
      idempotencyRecordsCount: this.idempotencyRecords.size,
      paymentRequestsCount: this.paymentRequests.size
    };
  }

  /**
   * Helper to seed or reset a wallet for testing
   */
  public seedWallet(params: {
    userId: string | number;
    currency?: string;
    realBalance?: string;
    bonusBalance?: string;
    lockedBalance?: string;
    status?: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  }): void {
    const userId = String(params.userId);
    const currency = params.currency || 'BDT';
    const realBalance = params.realBalance || '0.0000';
    const bonusBalance = params.bonusBalance || '0.0000';
    const lockedBalance = params.lockedBalance || '0.0000';
    const realMinor = BigInt(Math.round(parseFloat(realBalance) * 10000));
    const walletKey = `${userId}:${currency}`;
    const id = this.wallets.size + 1;

    this.users.set(userId, {
      id: userId,
      username: `user_${userId}`,
      status: params.status || 'ACTIVE',
      currency
    });

    this.wallets.set(walletKey, {
      id,
      user_id: userId,
      currency,
      real_balance: realBalance,
      bonus_balance: bonusBalance,
      locked_balance: lockedBalance,
      balance_minor: realMinor,
      version: 1n,
      status: params.status || 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  /**
   * Helper to retrieve all ledger entries for testing and audit inspection
   */
  public getAllLedgerEntries(): any[] {
    return Array.from(this.ledgerEntries.values());
  }

  /**
   * Helper to directly set or manipulate a ledger entry for testing backfill & migration logic
   */
  public setRawLedgerEntry(id: string, entry: any): void {
    this.ledgerEntries.set(id, entry);
  }

  /**
   * Helper to directly mutate a wallet for testing reconciliation discrepancy detection
   */
  public setRawWallet(walletKey: string, wallet: any): void {
    this.wallets.set(walletKey, wallet);
  }
}
