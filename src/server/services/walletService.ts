/**
 * @file walletService.ts
 * @description Core Transactional Wallet Service implementing PostgreSQL ACID transactions with Row-Level Locking (SELECT ... FOR UPDATE) and Idempotency Guard.
 */

import {
  BalanceRequest,
  BalanceResponse,
  BetRequest,
  WinRequest,
  RefundRequest,
  TransactionResponse,
  SeamlessErrorCode,
  UserEntity,
  WalletEntity,
  TransactionEntity,
  GameRoundEntity
} from '../types/seamless';

// Generic database pool client interface (matches 'pg' PoolClient / transaction client)
export interface IDbClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
}

export interface IDbPool {
  connect(): Promise<IDbClient & { release: () => void }>;
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
}

export class SeamlessWalletService {
  private db: IDbPool;
  private redisClient?: any;

  constructor(dbPool: IDbPool, redisClient?: any) {
    this.db = dbPool;
    this.redisClient = redisClient;
  }

  /**
   * Generates a deterministic idempotency key for Redis / DB lookup
   */
  private getIdempotencyKey(providerId: string, endpoint: string, transactionId: string): string {
    return `idempotency:${providerId}:${endpoint}:${transactionId}`;
  }

  /**
   * Checks for an existing cached response for idempotent retry requests
   */
  private async checkIdempotency(
    client: IDbClient,
    providerId: string,
    endpoint: string,
    transactionId: string
  ): Promise<TransactionResponse | null> {
    const key = this.getIdempotencyKey(providerId, endpoint, transactionId);

    // 1. Fast Redis check (if configured)
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.is_idempotent = true;
          return parsed;
        }
      } catch (err) {
        console.warn('[Idempotency] Redis lookup failed, falling back to DB:', err);
      }
    }

    // 2. PostgreSQL Idempotency Table Check
    const result = await client.query(
      `SELECT response_body FROM idempotency_keys WHERE idempotency_key = $1 LIMIT 1`,
      [key]
    );

    if (result.rows.length > 0) {
      const resp = result.rows[0].response_body as TransactionResponse;
      resp.is_idempotent = true;
      return resp;
    }

    return null;
  }

  /**
   * Persists the successful response for future idempotent replays
   */
  private async saveIdempotency(
    client: IDbClient,
    providerId: string,
    endpoint: string,
    transactionId: string,
    response: TransactionResponse,
    statusCode = 200
  ): Promise<void> {
    const key = this.getIdempotencyKey(providerId, endpoint, transactionId);

    // 1. Save to Redis with 7-day TTL
    if (this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(response), 'EX', 7 * 24 * 3600);
      } catch (err) {
        console.warn('[Idempotency] Redis save failed:', err);
      }
    }

    // 2. Save to PostgreSQL
    await client.query(
      `INSERT INTO idempotency_keys (idempotency_key, provider_id, endpoint, status_code, response_body)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [key, providerId, endpoint, statusCode, JSON.stringify(response)]
    );
  }

  // ==========================================================================
  // 1. POST /balance - Fast Non-blocking Read
  // ==========================================================================
  public async getBalance(req: BalanceRequest): Promise<BalanceResponse> {
    const { provider_id, user_id, currency } = req;

    // Check user and wallet in a single optimized join
    const res = await this.db.query<{
      user_id: string;
      username: string;
      user_status: string;
      wallet_id: string;
      real_balance: string;
      bonus_balance: string;
      wallet_status: string;
    }>(
      `SELECT 
          u.id AS user_id,
          u.username,
          u.status AS user_status,
          w.id AS wallet_id,
          w.real_balance,
          w.bonus_balance,
          w.status AS wallet_status
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id AND w.currency = $2
       WHERE (u.id::text = $1 OR u.username = $1)
       LIMIT 1`,
      [user_id, currency]
    );

    if (res.rows.length === 0) {
      throw {
        code: SeamlessErrorCode.USER_NOT_FOUND,
        message: `Player '${user_id}' not found in platform records`,
        status: 404
      };
    }

    const row = res.rows[0];

    if (row.user_status !== 'ACTIVE' || row.wallet_status === 'FROZEN') {
      throw {
        code: SeamlessErrorCode.USER_FROZEN,
        message: `Player account is currently ${row.user_status.toLowerCase()}`,
        status: 403
      };
    }

    const realBalance = parseFloat(row.real_balance || '0');
    const bonusBalance = parseFloat(row.bonus_balance || '0');

    return {
      code: SeamlessErrorCode.SUCCESS,
      message: 'Success',
      user_id: row.user_id,
      balance: realBalance,
      bonus_balance: bonusBalance,
      currency,
      timestamp: Date.now()
    };
  }

  // ==========================================================================
  // 2. POST /bet - Atomic Debit with PostgreSQL Row-Level Lock (FOR UPDATE)
  // ==========================================================================
  public async processBet(req: BetRequest): Promise<TransactionResponse> {
    const {
      provider_id,
      user_id,
      currency,
      transaction_id,
      round_id,
      game_id,
      amount,
      metadata = {}
    } = req;

    if (amount <= 0) {
      throw {
        code: SeamlessErrorCode.INVALID_REQUEST,
        message: 'Bet amount must be greater than zero',
        status: 400
      };
    }

    const client = await this.db.connect();

    try {
      // 1. Begin PostgreSQL ACID Transaction
      await client.query('BEGIN');

      // 2. Idempotency Guard Check inside transaction
      const cached = await this.checkIdempotency(client, provider_id, 'bet', transaction_id);
      if (cached) {
        await client.query('COMMIT');
        return cached;
      }

      // 3. Row-Level Locking: Acquire exclusive lock on the player's wallet
      // Other concurrent /bet or /win requests for this exact wallet will queue and wait.
      const walletRes = await client.query<{
        wallet_id: string;
        user_id: string;
        user_status: string;
        real_balance: string;
        bonus_balance: string;
        version: string;
      }>(
        `SELECT 
            w.id AS wallet_id,
            u.id AS user_id,
            u.status AS user_status,
            w.real_balance,
            w.bonus_balance,
            w.version
         FROM wallets w
         JOIN users u ON u.id = w.user_id
         WHERE (u.id::text = $1 OR u.username = $1)
           AND w.currency = $2
         FOR UPDATE OF w`, // <--- ROW LEVEL LOCKING
        [user_id, currency]
      );

      if (walletRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw {
          code: SeamlessErrorCode.USER_NOT_FOUND,
          message: `User '${user_id}' with currency '${currency}' not found`,
          status: 404
        };
      }

      const wallet = walletRes.rows[0];

      if (wallet.user_status !== 'ACTIVE') {
        await client.query('ROLLBACK');
        throw {
          code: SeamlessErrorCode.USER_FROZEN,
          message: `Account is inactive (${wallet.user_status})`,
          status: 403
        };
      }

      const currentBalance = parseFloat(wallet.real_balance);

      // 4. Overdraft Prevention Check
      if (currentBalance < amount) {
        await client.query('ROLLBACK');
        throw {
          code: SeamlessErrorCode.INSUFFICIENT_FUNDS,
          message: `Insufficient funds. Required: ${amount}, Available: ${currentBalance}`,
          balance: currentBalance,
          currency,
          status: 400
        };
      }

      const newBalance = Number((currentBalance - amount).toFixed(4));

      // 5. Update Wallet Balance with row version increment
      await client.query(
        `UPDATE wallets 
         SET real_balance = $1, 
             version = version + 1, 
             updated_at = NOW()
         WHERE id = $2`,
        [newBalance, wallet.wallet_id]
      );

      // 6. Upsert Game Round tracking record
      const roundRes = await client.query<{ id: string }>(
        `INSERT INTO game_rounds (provider_id, provider_round_id, user_id, game_id, currency, total_bet, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
         ON CONFLICT (provider_id, provider_round_id) 
         DO UPDATE SET 
            total_bet = game_rounds.total_bet + EXCLUDED.total_bet,
            status = 'OPEN'
         RETURNING id`,
        [provider_id, round_id, wallet.user_id, game_id, currency, amount]
      );
      const internalRoundId = roundRes.rows[0]?.id;

      // 7. Insert Immutable Transaction Ledger Record
      const txRes = await client.query<{ id: string }>(
        `INSERT INTO transactions (
            provider_id, transaction_id, user_id, wallet_id, round_id, provider_round_id,
            game_id, type, amount, currency, before_balance, after_balance, status, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'BET', $8, $9, $10, $11, 'COMPLETED', $12)
         RETURNING id`,
        [
          provider_id,
          transaction_id,
          wallet.user_id,
          wallet.wallet_id,
          internalRoundId,
          round_id,
          game_id,
          amount,
          currency,
          currentBalance,
          newBalance,
          JSON.stringify(metadata)
        ]
      );

      const operatorTxId = txRes.rows[0].id;

      const responsePayload: TransactionResponse = {
        code: SeamlessErrorCode.SUCCESS,
        message: 'Bet processed successfully',
        transaction_id,
        operator_transaction_id: operatorTxId,
        round_id,
        balance: newBalance,
        bonus_balance: parseFloat(wallet.bonus_balance),
        currency,
        timestamp: Date.now(),
        is_idempotent: false
      };

      // 8. Store Idempotency Record
      await this.saveIdempotency(client, provider_id, 'bet', transaction_id, responsePayload);

      // 9. Commit Transaction
      await client.query('COMMIT');

      return responsePayload;
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      // Handle PostgreSQL unique constraint violation (duplicate transaction)
      if (err.code === '23505' && err.constraint === 'uq_provider_tx_id') {
        const cached = await this.checkIdempotency(this.db, provider_id, 'bet', transaction_id);
        if (cached) return cached;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // 3. POST /win - Atomic Credit with PostgreSQL Row-Level Lock (FOR UPDATE)
  // ==========================================================================
  public async processWin(req: WinRequest): Promise<TransactionResponse> {
    const {
      provider_id,
      user_id,
      currency,
      transaction_id,
      reference_transaction_id,
      round_id,
      game_id,
      amount,
      is_round_end = true,
      metadata = {}
    } = req;

    if (amount < 0) {
      throw {
        code: SeamlessErrorCode.INVALID_REQUEST,
        message: 'Win amount cannot be negative',
        status: 400
      };
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 1. Idempotency Check
      const cached = await this.checkIdempotency(client, provider_id, 'win', transaction_id);
      if (cached) {
        await client.query('COMMIT');
        return cached;
      }

      // 2. Acquire Row-Level Lock on Wallet
      const walletRes = await client.query<{
        wallet_id: string;
        user_id: string;
        user_status: string;
        real_balance: string;
        bonus_balance: string;
      }>(
        `SELECT 
            w.id AS wallet_id,
            u.id AS user_id,
            u.status AS user_status,
            w.real_balance,
            w.bonus_balance
         FROM wallets w
         JOIN users u ON u.id = w.user_id
         WHERE (u.id::text = $1 OR u.username = $1)
           AND w.currency = $2
         FOR UPDATE OF w`,
        [user_id, currency]
      );

      if (walletRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw {
          code: SeamlessErrorCode.USER_NOT_FOUND,
          message: `User '${user_id}' with currency '${currency}' not found`,
          status: 404
        };
      }

      const wallet = walletRes.rows[0];
      const currentBalance = parseFloat(wallet.real_balance);
      const newBalance = Number((currentBalance + amount).toFixed(4));

      // 3. Credit Wallet Balance
      await client.query(
        `UPDATE wallets 
         SET real_balance = $1, 
             version = version + 1, 
             updated_at = NOW()
         WHERE id = $2`,
        [newBalance, wallet.wallet_id]
      );

      // 4. Update Game Round
      const roundRes = await client.query<{ id: string }>(
        `INSERT INTO game_rounds (provider_id, provider_round_id, user_id, game_id, currency, total_win, status, closed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (provider_id, provider_round_id) 
         DO UPDATE SET 
            total_win = game_rounds.total_win + EXCLUDED.total_win,
            status = CASE WHEN $7 = 'SETTLED' THEN 'SETTLED' ELSE game_rounds.status END,
            closed_at = CASE WHEN $7 = 'SETTLED' THEN NOW() ELSE game_rounds.closed_at END
         RETURNING id`,
        [
          provider_id,
          round_id,
          wallet.user_id,
          game_id,
          currency,
          amount,
          is_round_end ? 'SETTLED' : 'OPEN',
          is_round_end ? new Date().toISOString() : null
        ]
      );
      const internalRoundId = roundRes.rows[0]?.id;

      // 5. Insert WIN Transaction
      const txRes = await client.query<{ id: string }>(
        `INSERT INTO transactions (
            provider_id, transaction_id, reference_transaction_id, user_id, wallet_id,
            round_id, provider_round_id, game_id, type, amount, currency,
            before_balance, after_balance, status, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'WIN', $9, $10, $11, $12, 'COMPLETED', $13)
         RETURNING id`,
        [
          provider_id,
          transaction_id,
          reference_transaction_id || null,
          wallet.user_id,
          wallet.wallet_id,
          internalRoundId,
          round_id,
          game_id,
          amount,
          currency,
          currentBalance,
          newBalance,
          JSON.stringify(metadata)
        ]
      );

      const operatorTxId = txRes.rows[0].id;

      // 6. Increment Wagering Requirement Progress in PostgreSQL
      const turnoverToCredit = amount > 0 ? amount : 0;
      if (turnoverToCredit > 0) {
        await client.query(
          `UPDATE wagering_requirements
           SET completed_turnover_amount = completed_turnover_amount + $1,
               status = CASE WHEN (completed_turnover_amount + $1) >= target_turnover_amount THEN 'COMPLETED' ELSE status END,
               completed_at = CASE WHEN (completed_turnover_amount + $1) >= target_turnover_amount THEN NOW() ELSE completed_at END
           WHERE user_id = $2 AND status = 'ACTIVE'`,
          [turnoverToCredit, wallet.user_id]
        );
      }

      const responsePayload: TransactionResponse = {
        code: SeamlessErrorCode.SUCCESS,
        message: 'Win processed successfully',
        transaction_id,
        operator_transaction_id: operatorTxId,
        round_id,
        balance: newBalance,
        bonus_balance: parseFloat(wallet.bonus_balance),
        currency,
        timestamp: Date.now(),
        is_idempotent: false
      };

      // 7. Save Idempotency
      await this.saveIdempotency(client, provider_id, 'win', transaction_id, responsePayload);

      await client.query('COMMIT');

      return responsePayload;
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23505' && err.constraint === 'uq_provider_tx_id') {
        const cached = await this.checkIdempotency(this.db, provider_id, 'win', transaction_id);
        if (cached) return cached;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // 4. POST /refund - Rollback / Reversal of a BET transaction
  // ==========================================================================
  public async processRefund(req: RefundRequest): Promise<TransactionResponse> {
    const {
      provider_id,
      user_id,
      currency,
      transaction_id,
      reference_transaction_id,
      round_id,
      game_id,
      amount,
      reason = 'PROVIDER_REFUND',
      metadata = {}
    } = req;

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 1. Idempotency Check for the refund itself
      const cached = await this.checkIdempotency(client, provider_id, 'refund', transaction_id);
      if (cached) {
        await client.query('COMMIT');
        return cached;
      }

      // 2. Verify original BET transaction exists
      const origTxRes = await client.query<{
        id: string;
        amount: string;
        status: string;
        type: string;
      }>(
        `SELECT id, amount, status, type 
         FROM transactions 
         WHERE provider_id = $1 AND transaction_id = $2
         LIMIT 1`,
        [provider_id, reference_transaction_id]
      );

      if (origTxRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw {
          code: SeamlessErrorCode.TRANSACTION_NOT_FOUND,
          message: `Original bet transaction '${reference_transaction_id}' not found to refund`,
          status: 404
        };
      }

      const origTx = origTxRes.rows[0];

      // 3. Check if already refunded
      const alreadyRefunded = await client.query(
        `SELECT id FROM transactions 
         WHERE provider_id = $1 AND reference_transaction_id = $2 AND type = 'REFUND'
         LIMIT 1`,
        [provider_id, reference_transaction_id]
      );

      if (alreadyRefunded.rows.length > 0) {
        await client.query('ROLLBACK');
        throw {
          code: SeamlessErrorCode.TRANSACTION_ALREADY_SETTLED,
          message: `Transaction '${reference_transaction_id}' was already refunded`,
          status: 409
        };
      }

      // 4. Acquire Row-Level Lock on Wallet
      const walletRes = await client.query<{
        wallet_id: string;
        user_id: string;
        real_balance: string;
        bonus_balance: string;
      }>(
        `SELECT 
            w.id AS wallet_id,
            u.id AS user_id,
            w.real_balance,
            w.bonus_balance
         FROM wallets w
         JOIN users u ON u.id = w.user_id
         WHERE (u.id::text = $1 OR u.username = $1)
           AND w.currency = $2
         FOR UPDATE OF w`,
        [user_id, currency]
      );

      if (walletRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw {
          code: SeamlessErrorCode.USER_NOT_FOUND,
          message: `User '${user_id}' with currency '${currency}' not found`,
          status: 404
        };
      }

      const wallet = walletRes.rows[0];
      const currentBalance = parseFloat(wallet.real_balance);
      const refundAmount = amount > 0 ? amount : parseFloat(origTx.amount);
      const newBalance = Number((currentBalance + refundAmount).toFixed(4));

      // 5. Restore Wallet Balance
      await client.query(
        `UPDATE wallets 
         SET real_balance = $1, 
             version = version + 1, 
             updated_at = NOW()
         WHERE id = $2`,
        [newBalance, wallet.wallet_id]
      );

      // 6. Mark Game Round as REFUNDED / CANCELLED
      await client.query(
        `UPDATE game_rounds 
         SET status = 'REFUNDED', closed_at = NOW()
         WHERE provider_id = $1 AND provider_round_id = $2`,
        [provider_id, round_id]
      );

      // 7. Insert REFUND Transaction
      const txRes = await client.query<{ id: string }>(
        `INSERT INTO transactions (
            provider_id, transaction_id, reference_transaction_id, user_id, wallet_id,
            provider_round_id, game_id, type, amount, currency,
            before_balance, after_balance, status, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'REFUND', $8, $9, $10, $11, 'COMPLETED', $12)
         RETURNING id`,
        [
          provider_id,
          transaction_id,
          reference_transaction_id,
          wallet.user_id,
          wallet.wallet_id,
          round_id,
          game_id,
          refundAmount,
          currency,
          currentBalance,
          newBalance,
          JSON.stringify({ reason, ...metadata })
        ]
      );

      const operatorTxId = txRes.rows[0].id;

      const responsePayload: TransactionResponse = {
        code: SeamlessErrorCode.SUCCESS,
        message: 'Refund processed and funds restored',
        transaction_id,
        operator_transaction_id: operatorTxId,
        round_id,
        balance: newBalance,
        bonus_balance: parseFloat(wallet.bonus_balance),
        currency,
        timestamp: Date.now(),
        is_idempotent: false
      };

      // 8. Save Idempotency
      await this.saveIdempotency(client, provider_id, 'refund', transaction_id, responsePayload);

      await client.query('COMMIT');

      return responsePayload;
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23505' && err.constraint === 'uq_provider_tx_id') {
        const cached = await this.checkIdempotency(this.db, provider_id, 'refund', transaction_id);
        if (cached) return cached;
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
