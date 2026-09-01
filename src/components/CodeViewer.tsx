import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  FileCode,
  Download,
  Database,
  ShieldCheck,
  Cpu,
  Layers,
  Terminal,
  GitCompare,
  ArrowRight,
  GitBranch,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileDiff,
  FileSpreadsheet,
  Zap
} from 'lucide-react';

interface CodeFile {
  id: string;
  name: string;
  language: string;
  icon: any;
  description: string;
  code: string;
}

interface SchemaDiffScenario {
  id: string;
  title: string;
  category: 'migration' | 'operation';
  versionTag: string;
  description: string;
  affectedTables: string[];
  lockLevel: string;
  downtimeRisk: 'Zero Downtime (Online Safe)' | 'Low Risk (Share Update)' | 'High Risk (Access Exclusive)';
  upSql: string;
  downSql: string;
  diffLines: Array<{ type: 'add' | 'del' | 'same'; text: string; lineNo?: { old?: number; new?: number } }>;
  architectNotes: string[];
}

const CODE_FILES: CodeFile[] = [
  {
    id: 'schema',
    name: 'schema.sql',
    language: 'sql',
    icon: Database,
    description: 'PostgreSQL ACID schema with Row-Level Locking (SELECT ... FOR UPDATE), foreign keys, and idempotency constraints',
    code: `-- ============================================================================
-- iGaming B2B Seamless Wallet - PostgreSQL ACID Schema & Ledger Architecture
-- Engine: PostgreSQL 14+ with Row-Level Locking (SELECT ... FOR UPDATE)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Game Providers Table
CREATE TABLE IF NOT EXISTS game_providers (
    id VARCHAR(64) PRIMARY KEY,                   -- e.g., 'pragmatic_play', 'evolution'
    name VARCHAR(128) NOT NULL,
    secret_key VARCHAR(255) NOT NULL,             -- Shared HMAC-SHA256 secret key
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_ips TEXT[] DEFAULT '{}',
    webhook_timeout_ms INTEGER NOT NULL DEFAULT 4000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) NOT NULL UNIQUE,
    operator_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT_OPERATOR',
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED', 'SELF_EXCLUDED'
    country_code VARCHAR(2) DEFAULT 'US',
    parent_affiliate_id UUID REFERENCES users(id) ON DELETE SET NULL,
    affiliate_tier INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_operator_username ON users(operator_id, username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 3. Wallets Table (Player ledger balance with strict integrity constraints)
-- Row-level locking (SELECT ... FOR UPDATE) is executed on this table during transactions.
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(3) NOT NULL,
    real_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    bonus_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    locked_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    version BIGINT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'FROZEN', 'CLOSED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_wallet_user_currency UNIQUE (user_id, currency),
    CONSTRAINT chk_real_balance_non_negative CHECK (real_balance >= 0),
    CONSTRAINT chk_bonus_balance_non_negative CHECK (bonus_balance >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_currency ON wallets(user_id, currency);

-- 4. Game Rounds Table
CREATE TABLE IF NOT EXISTS game_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR(64) NOT NULL REFERENCES game_providers(id),
    provider_round_id VARCHAR(128) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    game_id VARCHAR(128) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',   -- 'OPEN', 'SETTLED', 'CANCELLED', 'REFUNDED'
    total_bet NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    total_win NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    net_payout NUMERIC(18, 4) GENERATED ALWAYS AS (total_win - total_bet) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,

    CONSTRAINT uq_provider_round UNIQUE (provider_id, provider_round_id)
);

CREATE INDEX IF NOT EXISTS idx_game_rounds_user_created ON game_rounds(user_id, created_at DESC);

-- 5. Transactions Table (Immutable Double-Entry Financial Ledger)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR(64) NOT NULL REFERENCES game_providers(id),
    transaction_id VARCHAR(128) NOT NULL,
    reference_transaction_id VARCHAR(128),
    user_id UUID NOT NULL REFERENCES users(id),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    round_id UUID REFERENCES game_rounds(id),
    provider_round_id VARCHAR(128),
    game_id VARCHAR(128) NOT NULL,
    type VARCHAR(32) NOT NULL,                   -- 'BET', 'WIN', 'REFUND', 'PROMO'
    amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    before_balance NUMERIC(18, 4) NOT NULL,
    after_balance NUMERIC(18, 4) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    error_code VARCHAR(64),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_provider_tx_id UNIQUE (provider_id, transaction_id),
    CONSTRAINT chk_tx_amount_positive CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_round_id ON transactions(provider_round_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ref_tx ON transactions(provider_id, reference_transaction_id);

-- 6. Idempotency Records Table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key VARCHAR(192) PRIMARY KEY,
    provider_id VARCHAR(64) NOT NULL,
    endpoint VARCHAR(64) NOT NULL,
    status_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);`
  },
  {
    id: 'hmac',
    name: 'hmac.middleware.ts',
    language: 'typescript',
    icon: ShieldCheck,
    description: 'HMAC-SHA256 signature verification middleware with timestamp replay prevention (<300s window)',
    code: `import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const MAX_TIMESTAMP_AGE_SECONDS = 300; // 5 minutes SLA threshold

export const validateHmacSignature = (req: Request, res: Response, next: NextFunction) => {
  const providerId = req.headers['x-provider-id'] as string;
  const signature = req.headers['x-signature'] as string;
  const timestampHeader = req.headers['x-timestamp'] as string;

  if (!signature || !timestampHeader || !providerId) {
    return res.status(401).json({
      code: 'MISSING_SECURITY_HEADERS',
      message: 'x-provider-id, x-signature, and x-timestamp headers are mandatory'
    });
  }

  // 1. Verify Timestamp Freshness (Replay Attack Defense)
  const timestamp = parseInt(timestampHeader, 10);
  const now = Date.now();
  if (isNaN(timestamp) || Math.abs(now - timestamp) > MAX_TIMESTAMP_AGE_SECONDS * 1000) {
    return res.status(401).json({
      code: 'TIMESTAMP_EXPIRED',
      message: 'Request timestamp is outside the acceptable 300s clock drift window'
    });
  }

  // 2. Compute Expected HMAC SHA-256
  const secretKey = process.env[\`PROVIDER_SECRET_\${providerId.toUpperCase()}\`];
  if (!secretKey) {
    return res.status(401).json({
      code: 'UNKNOWN_PROVIDER',
      message: 'Unknown or unconfigured game provider identifier'
    });
  }

  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const payloadToSign = \`\${timestampHeader}.\${rawBody}\`;

  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payloadToSign, 'utf8')
    .digest('hex');

  // Constant-time buffer comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );

  if (!isValid) {
    return res.status(401).json({
      code: 'INVALID_SIGNATURE',
      message: 'HMAC-SHA256 signature verification failed'
    });
  }

  next();
};`
  },
  {
    id: 'wallet_service',
    name: 'walletService.ts',
    language: 'typescript',
    icon: Cpu,
    description: 'ACID transaction service using PostgreSQL Row-Level Locking (SELECT ... FOR UPDATE)',
    code: `import { Pool, PoolClient } from 'pg';

export class SeamlessWalletService {
  constructor(private pool: Pool) {}

  public async processBet(params: {
    providerId: string;
    userId: string;
    currency: string;
    transactionId: string;
    roundId: string;
    gameId: string;
    amount: number;
  }) {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED');

      // 1. Row-Level Lock on target player wallet
      const lockRes = await client.query(
        \`SELECT id, user_id, currency, real_balance, bonus_balance, version 
         FROM wallets 
         WHERE user_id = $1 AND currency = $2 
         FOR UPDATE\`,
        [params.userId, params.currency]
      );

      if (lockRes.rows.length === 0) {
        throw { code: 'USER_NOT_FOUND', status: 404 };
      }

      const wallet = lockRes.rows[0];

      // 2. Insufficient Funds Check
      if (Number(wallet.real_balance) < params.amount) {
        throw { code: 'INSUFFICIENT_FUNDS', status: 402, balance: wallet.real_balance };
      }

      const newBalance = Number(wallet.real_balance) - params.amount;

      // 3. Update Balance with Optimistic Version Bump
      await client.query(
        \`UPDATE wallets 
         SET real_balance = $1, version = version + 1, updated_at = NOW() 
         WHERE id = $2\`,
        [newBalance, wallet.id]
      );

      // 4. Record Immutable Ledger Transaction
      const txRes = await client.query(
        \`INSERT INTO transactions (
           provider_id, transaction_id, user_id, wallet_id, 
           provider_round_id, game_id, type, amount, currency, 
           before_balance, after_balance, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'BET', $7, $8, $9, $10, 'COMPLETED') 
         RETURNING id\`,
        [
          params.providerId, params.transactionId, params.userId, wallet.id,
          params.roundId, params.gameId, params.amount, params.currency,
          wallet.real_balance, newBalance
        ]
      );

      await client.query('COMMIT');

      return {
        balance: newBalance,
        operatorTransactionId: txRes.rows[0].id,
        isIdempotent: false
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}`
  }
];

const SCHEMA_DIFF_SCENARIOS: SchemaDiffScenario[] = [
  {
    id: 'diff_bonus_split',
    title: 'Migration v1.0.0 → v1.1.0: Bonus Wallet Split & Wagering Constraints',
    category: 'migration',
    versionTag: 'v1.1.0',
    description: 'Splits single monolithic real_balance into separate real, bonus, and locked balances with non-negative constraints and a dedicated wagering requirements table.',
    affectedTables: ['wallets', 'wagering_requirements'],
    lockLevel: 'SHARE UPDATE EXCLUSIVE (Safe)',
    downtimeRisk: 'Zero Downtime (Online Safe)',
    upSql: `-- Migration: v1.0.0 -> v1.1.0: Bonus Wallet Separation & Wagering Engine
BEGIN;

-- 1. Alter wallets table: add dedicated bonus and locked sub-balances
ALTER TABLE wallets
    ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS locked_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS turnover_ratio NUMERIC(5, 2) NOT NULL DEFAULT 15.00;

-- 2. Add non-negative check constraints on sub-balances
ALTER TABLE wallets
    ADD CONSTRAINT chk_bonus_balance_non_negative CHECK (bonus_balance >= 0),
    ADD CONSTRAINT chk_locked_balance_non_negative CHECK (locked_balance >= 0);

-- 3. Create wagering requirements table for tracking turnover progress
CREATE TABLE IF NOT EXISTS wagering_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id VARCHAR(64) NOT NULL,
    bonus_amount NUMERIC(18, 4) NOT NULL,
    target_turnover_amount NUMERIC(18, 4) NOT NULL,
    completed_turnover_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wagering_user_status ON wagering_requirements(user_id, status);

COMMIT;`,
    downSql: `-- Rollback Migration: v1.1.0 -> v1.0.0
BEGIN;

DROP TABLE IF EXISTS wagering_requirements CASCADE;

ALTER TABLE wallets 
    DROP CONSTRAINT IF EXISTS chk_bonus_balance_non_negative,
    DROP CONSTRAINT IF EXISTS chk_locked_balance_non_negative,
    DROP COLUMN IF EXISTS bonus_balance,
    DROP COLUMN IF EXISTS locked_balance,
    DROP COLUMN IF EXISTS turnover_ratio;

COMMIT;`,
    diffLines: [
      { type: 'same', text: ' CREATE TABLE wallets (' },
      { type: 'same', text: '     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),' },
      { type: 'same', text: '     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,' },
      { type: 'same', text: '     currency VARCHAR(3) NOT NULL,' },
      { type: 'same', text: '     real_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,' },
      { type: 'add', text: '+    bonus_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,' },
      { type: 'add', text: '+    locked_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,' },
      { type: 'add', text: '+    turnover_ratio NUMERIC(5, 2) NOT NULL DEFAULT 15.00,' },
      { type: 'same', text: '     version BIGINT NOT NULL DEFAULT 1,' },
      { type: 'same', text: '     status VARCHAR(32) NOT NULL DEFAULT \'ACTIVE\',' },
      { type: 'same', text: '     CONSTRAINT uq_wallet_user_currency UNIQUE (user_id, currency),' },
      { type: 'same', text: '     CONSTRAINT chk_real_balance_non_negative CHECK (real_balance >= 0),' },
      { type: 'add', text: '+    CONSTRAINT chk_bonus_balance_non_negative CHECK (bonus_balance >= 0),' },
      { type: 'add', text: '+    CONSTRAINT chk_locked_balance_non_negative CHECK (locked_balance >= 0)' },
      { type: 'same', text: ' );' },
      { type: 'add', text: '+-- NEW TABLE: wagering_requirements for tracking campaign rollover turnover' },
      { type: 'add', text: '+CREATE TABLE wagering_requirements (' },
      { type: 'add', text: '+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),' },
      { type: 'add', text: '+    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,' },
      { type: 'add', text: '+    target_turnover_amount NUMERIC(18, 4) NOT NULL,' },
      { type: 'add', text: '+    completed_turnover_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,' },
      { type: 'add', text: '+    status VARCHAR(32) NOT NULL DEFAULT \'ACTIVE\'' },
      { type: 'add', text: '+);' }
    ],
    architectNotes: [
      'Adding columns with `DEFAULT 0.0000` in PostgreSQL 11+ is a constant-time metadata-only operation without table rewrite.',
      'Check constraints are validated immediately; verify existing rows contain non-negative balances before deploying to production.',
      'All subsequent `/bet` and `/win` operations must split mutations between `real_balance` and `bonus_balance`.'
    ]
  },
  {
    id: 'diff_affiliate_mlm',
    title: 'Migration v1.1.0 → v1.2.0: Multi-Tier MLM Affiliate & Commission Hierarchy',
    category: 'migration',
    versionTag: 'v1.2.0',
    description: 'Adds parent affiliate referral relationships to users and creates an immutable affiliate_commissions ledger for multi-level revenue sharing.',
    affectedTables: ['users', 'affiliate_commissions'],
    lockLevel: 'SHARE UPDATE EXCLUSIVE (Safe)',
    downtimeRisk: 'Zero Downtime (Online Safe)',
    upSql: `-- Migration: v1.1.0 -> v1.2.0: MLM Affiliate Hierarchy & Commission Ledger
BEGIN;

-- 1. Add referral parent tree to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS parent_affiliate_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS affiliate_tier INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32) UNIQUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_parent_affiliate ON users(parent_affiliate_id);

-- 2. Create immutable commission earnings ledger
CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_user_id UUID NOT NULL REFERENCES users(id),
    source_player_id UUID NOT NULL REFERENCES users(id),
    source_round_id VARCHAR(128) NOT NULL,
    tier_level INTEGER NOT NULL CHECK (tier_level BETWEEN 1 AND 3),
    valid_bet_amount NUMERIC(18, 4) NOT NULL,
    commission_rate NUMERIC(6, 4) NOT NULL,      -- e.g. 0.0050 = 0.50%
    commission_earned NUMERIC(18, 4) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'CLAIMED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_comm_user ON affiliate_commissions(affiliate_user_id, created_at DESC);

COMMIT;`,
    downSql: `-- Rollback Migration: v1.2.0 -> v1.1.0
BEGIN;

DROP TABLE IF EXISTS affiliate_commissions CASCADE;

ALTER TABLE users 
    DROP COLUMN IF EXISTS parent_affiliate_id,
    DROP COLUMN IF EXISTS affiliate_tier,
    DROP COLUMN IF EXISTS referral_code;

COMMIT;`,
    diffLines: [
      { type: 'same', text: ' CREATE TABLE users (' },
      { type: 'same', text: '     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),' },
      { type: 'same', text: '     username VARCHAR(64) NOT NULL UNIQUE,' },
      { type: 'same', text: '     currency VARCHAR(3) NOT NULL DEFAULT \'USD\',' },
      { type: 'add', text: '+    parent_affiliate_id UUID REFERENCES users(id) ON DELETE SET NULL,' },
      { type: 'add', text: '+    affiliate_tier INTEGER NOT NULL DEFAULT 1,' },
      { type: 'add', text: '+    referral_code VARCHAR(32) UNIQUE,' },
      { type: 'same', text: '     status VARCHAR(32) NOT NULL DEFAULT \'ACTIVE\'' },
      { type: 'same', text: ' );' },
      { type: 'add', text: '+-- NEW TABLE: affiliate_commissions double-entry audit table' },
      { type: 'add', text: '+CREATE TABLE affiliate_commissions (' },
      { type: 'add', text: '+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),' },
      { type: 'add', text: '+    affiliate_user_id UUID NOT NULL REFERENCES users(id),' },
      { type: 'add', text: '+    tier_level INTEGER NOT NULL CHECK (tier_level BETWEEN 1 AND 3),' },
      { type: 'add', text: '+    valid_bet_amount NUMERIC(18, 4) NOT NULL,' },
      { type: 'add', text: '+    commission_earned NUMERIC(18, 4) NOT NULL' },
      { type: 'add', text: '+);' }
    ],
    architectNotes: [
      '`CREATE INDEX CONCURRENTLY` prevents locking the `users` table during index generation on active player databases.',
      'Commission rates are enforced via tier checks: Tier 1 (Direct: 50%), Tier 2 (30%), Tier 3 (20%).'
    ]
  },
  {
    id: 'diff_acid_idempotency',
    title: 'Migration v1.2.0 → v1.3.0: High-Throughput ACID Mutex & Idempotency Store',
    category: 'migration',
    versionTag: 'v1.3.0',
    description: 'Implements dedicated idempotency storage, adds unique composite constraint on (provider_id, transaction_id), and adds optimistic versioning for lock verification.',
    affectedTables: ['transactions', 'idempotency_keys', 'wallets'],
    lockLevel: 'SHARE UPDATE EXCLUSIVE (Safe)',
    downtimeRisk: 'Zero Downtime (Online Safe)',
    upSql: `-- Migration: v1.2.0 -> v1.3.0: ACID Mutex & Idempotency Key Tracking
BEGIN;

-- 1. Ensure composite unique constraint on (provider_id, transaction_id)
ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS uq_provider_tx_id;

ALTER TABLE transactions
    ADD CONSTRAINT uq_provider_tx_id UNIQUE (provider_id, transaction_id);

-- 2. Add version counter to wallets for hybrid optimistic concurrency fallback
ALTER TABLE wallets
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

-- 3. Dedicated Idempotency cache table with 7-day TTL expiration
CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key VARCHAR(192) PRIMARY KEY,
    provider_id VARCHAR(64) NOT NULL,
    endpoint VARCHAR(64) NOT NULL,
    status_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

COMMIT;`,
    downSql: `-- Rollback Migration: v1.3.0 -> v1.2.0
BEGIN;

DROP TABLE IF EXISTS idempotency_keys CASCADE;

ALTER TABLE wallets DROP COLUMN IF EXISTS version;

COMMIT;`,
    diffLines: [
      { type: 'same', text: ' CREATE TABLE transactions (' },
      { type: 'same', text: '     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),' },
      { type: 'same', text: '     provider_id VARCHAR(64) NOT NULL REFERENCES game_providers(id),' },
      { type: 'same', text: '     transaction_id VARCHAR(128) NOT NULL,' },
      { type: 'add', text: '+    CONSTRAINT uq_provider_tx_id UNIQUE (provider_id, transaction_id),' },
      { type: 'same', text: '     amount NUMERIC(18, 4) NOT NULL' },
      { type: 'same', text: ' );' },
      { type: 'add', text: '+-- NEW TABLE: idempotency_keys for sub-millisecond RAM/Postgres replay response' },
      { type: 'add', text: '+CREATE TABLE idempotency_keys (' },
      { type: 'add', text: '+    idempotency_key VARCHAR(192) PRIMARY KEY,' },
      { type: 'add', text: '+    status_code INTEGER NOT NULL,' },
      { type: 'add', text: '+    response_body JSONB NOT NULL,' },
      { type: 'add', text: '+    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL \'7 days\')' },
      { type: 'add', text: '+);' }
    ],
    architectNotes: [
      'The unique constraint `uq_provider_tx_id` guarantees that concurrent provider duplicate requests will fail at DB constraint level even if memory cache misses.',
      'The `expires_at` column enables background vacuuming of expired records (`DELETE FROM idempotency_keys WHERE expires_at < NOW()`).'
    ]
  },
  {
    id: 'diff_op_bet',
    title: 'Operation Runtime SQL Diff: POST /api/seamless/bet (ACID Balance Debit)',
    category: 'operation',
    versionTag: 'Runtime SQL',
    description: 'Step-by-step SQL executed during a bet transaction, illustrating row-level lock acquisition, balance check, mutation, and ledger insertion.',
    affectedTables: ['wallets', 'transactions', 'idempotency_keys'],
    lockLevel: 'ROW EXCLUSIVE (SELECT ... FOR UPDATE)',
    downtimeRisk: 'Zero Downtime (Online Safe)',
    upSql: `-- Atomic Seamless Bet Execution Pipeline
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- 1. Step 1: Acquire exclusive row-level lock on user wallet
SELECT id, user_id, currency, real_balance, version
FROM wallets
WHERE user_id = 'a0000000-0000-0000-0000-000000000004' AND currency = 'BDT'
FOR UPDATE;

-- 2. Step 2: Atomic Balance Deduction with version increment
UPDATE wallets
SET real_balance = real_balance - 50.0000,
    version = version + 1,
    updated_at = NOW()
WHERE id = 'w_sakib_01' AND real_balance >= 50.0000;

-- 3. Step 3: Insert immutable financial ledger record
INSERT INTO transactions (
    provider_id, transaction_id, user_id, wallet_id,
    provider_round_id, game_id, type, amount, currency,
    before_balance, after_balance, status
) VALUES (
    'pragmatic_play', 'TX_BET_991823', 'a0000000-0000-0000-0000-000000000004', 'w_sakib_01',
    'RND_881923', 'sweet_bonanza', 'BET', 50.0000, 'BDT',
    5000.0000, 4950.0000, 'COMPLETED'
);

-- 4. Step 4: Cache idempotent response
INSERT INTO idempotency_keys (idempotency_key, provider_id, endpoint, status_code, response_body)
VALUES ('pragmatic_play:bet:TX_BET_991823', 'pragmatic_play', 'bet', 200, '{"code":"SUCCESS","balance":4950.0}'::jsonb);

COMMIT;`,
    downSql: `-- Compensation / Bet Void Void Script (Executed during /refund)
UPDATE wallets SET real_balance = real_balance + 50.0000 WHERE id = 'w_sakib_01';`,
    diffLines: [
      { type: 'same', text: ' -- 1. Row Lock Acquisition:' },
      { type: 'add', text: '+SELECT * FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE;' },
      { type: 'same', text: ' -- 2. Balance Verification & Mutation:' },
      { type: 'del', text: '-UPDATE wallets SET real_balance = real_balance - $3;' },
      { type: 'add', text: '+UPDATE wallets SET real_balance = real_balance - $3, version = version + 1 WHERE id = $4 AND real_balance >= $3;' },
      { type: 'same', text: ' -- 3. Immutable Double-Entry Ledger Entry:' },
      { type: 'add', text: '+INSERT INTO transactions (provider_id, transaction_id, user_id, wallet_id, type, amount, before_balance, after_balance) VALUES ($1, $2, $3, $4, \'BET\', $5, $6, $7);' },
      { type: 'add', text: '+INSERT INTO idempotency_keys (idempotency_key, provider_id, endpoint, status_code, response_body) VALUES ($8, $1, \'bet\', 200, $9);' }
    ],
    architectNotes: [
      '`SELECT ... FOR UPDATE` serializes concurrent bets from the same player across multiple provider tabs.',
      'The `WHERE real_balance >= $amount` clause in the UPDATE statement acts as a second safeguard against balance race overdrafts.'
    ]
  }
];

export const CodeViewer: React.FC = () => {
  const [viewerMode, setViewerMode] = useState<'source' | 'schema_diff'>('source');
  const [activeFileId, setActiveFileId] = useState<string>('schema');
  const [activeDiffId, setActiveDiffId] = useState<string>('diff_bonus_split');
  const [diffViewMode, setDiffViewMode] = useState<'unified' | 'script'>('unified');
  const [copied, setCopied] = useState<boolean>(false);

  const activeFile = CODE_FILES.find((f) => f.id === activeFileId) || CODE_FILES[0];
  const activeDiff = SCHEMA_DIFF_SCENARIOS.find((d) => d.id === activeDiffId) || SCHEMA_DIFF_SCENARIOS[0];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Level Mode Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewerMode('source')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewerMode === 'source'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Source Code Repository</span>
          </button>

          <button
            onClick={() => setViewerMode('schema_diff')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewerMode === 'schema_diff'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
            }`}
          >
            <GitCompare className="w-4 h-4 text-amber-400" />
            <span>Schema Changes &amp; SQL Diff</span>
            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded uppercase font-mono">
              Diff Tool
            </span>
          </button>
        </div>

        <button
          onClick={() =>
            handleCopy(viewerMode === 'source' ? activeFile.code : activeDiff.upSql)
          }
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs font-mono flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer self-end sm:self-auto"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied!' : viewerMode === 'source' ? `Copy ${activeFile.name}` : 'Copy Migration SQL'}</span>
        </button>
      </div>

      {/* MODE 1: SOURCE CODE REPOSITORY */}
      {viewerMode === 'source' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg flex items-center space-x-2 overflow-x-auto no-scrollbar font-mono text-xs">
            {CODE_FILES.map((file) => {
              const Icon = file.icon;
              return (
                <button
                  key={file.id}
                  onClick={() => setActiveFileId(file.id)}
                  className={`px-3 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeFileId === file.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{file.name}</span>
                </button>
              );
            })}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
            <div className="bg-slate-950/90 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-white">{activeFile.name}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">{activeFile.description}</p>
              </div>
              <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                {activeFile.language}
              </span>
            </div>

            <div className="p-4 bg-slate-950 overflow-x-auto max-h-[650px]">
              <pre className="text-xs font-mono text-slate-200 leading-relaxed">
                <code>{activeFile.code}</code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: SCHEMA CHANGES & SQL DIFF TOOL */}
      {viewerMode === 'schema_diff' && (
        <div className="space-y-6">
          {/* Migration / Operation Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
            {SCHEMA_DIFF_SCENARIOS.map((diff) => (
              <button
                key={diff.id}
                onClick={() => setActiveDiffId(diff.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  activeDiffId === diff.id
                    ? 'bg-slate-950 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-amber-400 uppercase">
                    {diff.category === 'migration' ? 'Schema Migration' : 'Runtime SQL'}
                  </span>
                  <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-bold">
                    {diff.versionTag}
                  </span>
                </div>
                <div className="font-bold text-white text-xs truncate">{diff.title.split(':')[0]}</div>
                <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{diff.description}</div>
              </button>
            ))}
          </div>

          {/* Diff Overview Metadata Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3 font-mono text-xs">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileDiff className="w-4 h-4 text-amber-400" />
                  <span>{activeDiff.title}</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">{activeDiff.description}</p>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1.5 self-start md:self-auto">
                <button
                  onClick={() => setDiffViewMode('unified')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    diffViewMode === 'unified'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  Line-by-Line Diff
                </button>
                <button
                  onClick={() => setDiffViewMode('script')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    diffViewMode === 'script'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  Full UP/DOWN Script
                </button>
              </div>
            </div>

            {/* Metrics Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Affected Tables:</span>
                <span className="font-bold text-white">{activeDiff.affectedTables.join(', ')}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">PostgreSQL Lock Level:</span>
                <span className="font-bold text-amber-400">{activeDiff.lockLevel}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Zero-Downtime Rating:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {activeDiff.downtimeRisk}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Diff Highlights:</span>
                <span className="font-bold text-cyan-400">
                  {activeDiff.diffLines.filter((l) => l.type === 'add').length} Added /{' '}
                  {activeDiff.diffLines.filter((l) => l.type === 'del').length} Removed
                </span>
              </div>
            </div>
          </div>

          {/* Diff Output Panel */}
          {diffViewMode === 'unified' ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl font-mono text-xs">
              <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Unified Schema Diff</span>
                  <span className="text-emerald-400 font-bold">+ Added Lines</span>
                  <span className="text-rose-400 font-bold">- Removed Lines</span>
                </div>
                <span className="text-slate-500">PostgreSQL DDL</span>
              </div>

              <div className="p-4 overflow-x-auto max-h-[550px] space-y-1 divide-y divide-slate-900/60">
                {activeDiff.diffLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={`py-1 px-2 rounded flex items-start gap-2 ${
                      line.type === 'add'
                        ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500 font-semibold'
                        : line.type === 'del'
                        ? 'bg-rose-950/40 text-rose-300 border-l-2 border-rose-500 line-through opacity-80'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className="text-slate-600 select-none min-w-[2rem] text-right">{idx + 1}</span>
                    <span className="whitespace-pre">{line.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono text-xs">
              {/* UP Migration */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    UP Migration Script (Apply)
                  </span>
                  <button
                    onClick={() => handleCopy(activeDiff.upSql)}
                    className="text-[10px] text-slate-400 hover:text-white"
                  >
                    Copy UP
                  </button>
                </div>
                <div className="p-4 overflow-x-auto max-h-[500px]">
                  <pre className="text-emerald-300 leading-relaxed whitespace-pre-wrap">
                    <code>{activeDiff.upSql}</code>
                  </pre>
                </div>
              </div>

              {/* DOWN Migration */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    DOWN Migration Script (Rollback)
                  </span>
                  <button
                    onClick={() => handleCopy(activeDiff.downSql)}
                    className="text-[10px] text-slate-400 hover:text-white"
                  >
                    Copy DOWN
                  </button>
                </div>
                <div className="p-4 overflow-x-auto max-h-[500px]">
                  <pre className="text-rose-300 leading-relaxed whitespace-pre-wrap">
                    <code>{activeDiff.downSql}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Architect Notes & Production Migration Advice */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
            <div className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Architectural Impact &amp; Constraint Analysis</span>
            </div>
            <div className="space-y-1.5">
              {activeDiff.architectNotes.map((note, idx) => (
                <div key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
