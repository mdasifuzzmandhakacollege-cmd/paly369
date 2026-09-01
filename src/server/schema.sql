-- ============================================================================
-- iGaming B2B Seamless Wallet - PostgreSQL ACID Schema & Ledger Architecture
-- Author: Senior iGaming System Architect
-- Engine: PostgreSQL 14+ with Row-Level Locking (SELECT ... FOR UPDATE)
-- ============================================================================

-- Enable UUID extension for high-performance distributed primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean up existing tables if re-provisioning (order matters due to foreign keys)
-- DROP TABLE IF EXISTS idempotency_keys CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS game_rounds CASCADE;
-- DROP TABLE IF EXISTS wallets CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS game_providers CASCADE;

-- ----------------------------------------------------------------------------
-- 1. Game Providers Table (Catalog of integrated B2B game providers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_providers (
    id VARCHAR(64) PRIMARY KEY,                   -- e.g., 'pragmatic_play', 'evolution', 'pgsoft', 'spribe'
    name VARCHAR(128) NOT NULL,
    secret_key VARCHAR(255) NOT NULL,             -- Shared HMAC-SHA256 secret key
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_ips TEXT[] DEFAULT '{}',              -- IP Whitelist array
    webhook_timeout_ms INTEGER NOT NULL DEFAULT 4000, -- Strict provider timeout (e.g. 4000ms)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Users Table (Platform players registered under the primary operator)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uid TEXT UNIQUE,                               -- Firebase Auth UID (if integrated)
    email VARCHAR(255),
    username VARCHAR(64) NOT NULL UNIQUE,
    operator_id VARCHAR(64) NOT NULL DEFAULT 'GAMEPLAY365_BD',
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',    -- ISO-4217 Currency Code (e.g., 'BDT', 'USD')
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED', 'SELF_EXCLUDED', 'LOCKED'
    country_code VARCHAR(2) DEFAULT 'BD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_operator_username ON users(operator_id, username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ----------------------------------------------------------------------------
-- 3. Wallets Table (Player ledger balance with strict integrity constraints)
-- Row-level locking (SELECT ... FOR UPDATE) is executed on this table during transactions.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(3) NOT NULL,
    
    -- Integer minor units (e.g. 516 = 0.0516 BDT, scale 4) for exact zero-drift arithmetic
    balance_minor BIGINT NOT NULL DEFAULT 0,
    
    -- Balances stored with 4 decimal places for micro-cent precision in casino games
    real_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    bonus_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    locked_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    commission_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    
    -- Optimistic locking version integer (backup guard)
    version BIGINT NOT NULL DEFAULT 1,
    
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'FROZEN', 'CLOSED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints: A user can have only one wallet per currency
    CONSTRAINT uq_wallet_user_currency UNIQUE (user_id, currency),
    
    -- Zero-overdraft constraint: Real balance and minor balance cannot drop below zero
    CONSTRAINT chk_balance_minor_non_negative CHECK (balance_minor >= 0),
    CONSTRAINT chk_real_balance_non_negative CHECK (real_balance >= 0),
    CONSTRAINT chk_bonus_balance_non_negative CHECK (bonus_balance >= 0),
    CONSTRAINT chk_locked_balance_non_negative CHECK (locked_balance >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_currency ON wallets(user_id, currency);

-- ----------------------------------------------------------------------------
-- 3b. Immutable Ledger Entries Table (Append-Only Core Financial Ledger)
-- Every financial debit, credit, reversal, or adjustment is permanently recorded.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
    id VARCHAR(64) PRIMARY KEY,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    transaction_id VARCHAR(128) NOT NULL,
    reference_transaction_id VARCHAR(128),
    type VARCHAR(32) NOT NULL,                    -- 'DEBIT', 'CREDIT', 'REVERSAL', 'ADJUSTMENT'
    balance_target VARCHAR(16) NOT NULL DEFAULT 'REAL', -- 'REAL', 'BONUS', 'LOCKED'
    amount_minor BIGINT NOT NULL,                 -- Exact integer minor units (scale 4)
    currency VARCHAR(3) NOT NULL,
    before_balance_minor BIGINT NOT NULL,
    after_balance_minor BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'COMMITTED', -- 'COMMITTED', 'REJECTED', 'ROLLED_BACK'
    correlation_id VARCHAR(128) NOT NULL,
    audit_metadata JSONB DEFAULT '{}'::jsonb,     -- Masked audit trail (no secrets)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ledger_balance_target CHECK (balance_target IN ('REAL', 'BONUS', 'LOCKED')),
    CONSTRAINT chk_ledger_amount_minor_positive CHECK (amount_minor >= 0),
    CONSTRAINT chk_ledger_balances_non_negative CHECK (before_balance_minor >= 0 AND after_balance_minor >= 0),
    CONSTRAINT uq_ledger_user_transaction UNIQUE (user_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_wallet_created ON ledger_entries(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_target_status ON ledger_entries(wallet_id, balance_target, status);
CREATE INDEX IF NOT EXISTS idx_ledger_user_tx ON ledger_entries(user_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_correlation ON ledger_entries(correlation_id);

-- ----------------------------------------------------------------------------
-- 3c. Idempotency Records Table (Guarantees Exactly-Once Processing)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_key VARCHAR(192) PRIMARY KEY,
    transaction_id VARCHAR(128) NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 200,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_expires ON idempotency_records(expires_at);

-- ----------------------------------------------------------------------------
-- 4. Game Rounds Table (Tracks the lifecycle of casino spins/rounds)
-- A game round typically starts with a BET, can have multiple BETs/WINs, and closes on settlement.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_rounds (
    id SERIAL PRIMARY KEY,
    provider_id VARCHAR(64) NOT NULL REFERENCES game_providers(id),
    provider_round_id VARCHAR(128) NOT NULL,     -- Provider's unique round ID (e.g. 'RND_8892183')
    user_id INTEGER NOT NULL REFERENCES users(id),
    game_id VARCHAR(128) NOT NULL,               -- e.g. 'vs20olympgate', 'sweet_bonanza'
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
CREATE INDEX IF NOT EXISTS idx_game_rounds_status ON game_rounds(status);

-- ----------------------------------------------------------------------------
-- 5. Transactions Table (Immutable Double-Entry Financial Ledger)
-- Every /bet, /win, and /refund logs an immutable row here.
-- Idempotency is enforced by the UNIQUE index on (provider_id, transaction_id).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    provider_id VARCHAR(64) NOT NULL REFERENCES game_providers(id),
    
    -- Provider's external unique transaction identifier
    transaction_id VARCHAR(128) NOT NULL,
    
    -- Reference to parent transaction (e.g., /win or /refund referencing the original /bet)
    reference_transaction_id VARCHAR(128),
    
    user_id INTEGER NOT NULL REFERENCES users(id),
    wallet_id INTEGER NOT NULL REFERENCES wallets(id),
    round_id INTEGER REFERENCES game_rounds(id),
    provider_round_id VARCHAR(128),
    game_id VARCHAR(128) NOT NULL,
    
    type VARCHAR(32) NOT NULL,                   -- 'BET', 'WIN', 'REFUND', 'JACKPOT', 'PROMO', 'TIP'
    amount NUMERIC(18, 4) NOT NULL,              -- Transaction amount (positive numeric)
    currency VARCHAR(3) NOT NULL,
    
    -- Financial snapshots for auditability
    before_balance NUMERIC(18, 4) NOT NULL,
    after_balance NUMERIC(18, 4) NOT NULL,
    
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'FAILED', 'REJECTED', 'ROLLED_BACK'
    error_code VARCHAR(64),
    
    -- Complete provider payload preserved for auditing and dispute resolution
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Enforce idempotency: The same provider cannot submit the same transaction_id twice
    CONSTRAINT uq_provider_tx_id UNIQUE (provider_id, transaction_id),
    CONSTRAINT chk_tx_amount_positive CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_round_id ON transactions(provider_round_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ref_tx ON transactions(provider_id, reference_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(type, status);

-- ----------------------------------------------------------------------------
-- 6. Idempotency Records Table (Fast cache store / permanent response repository)
-- Used to immediately return identical responses for duplicated/retried requests.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key VARCHAR(192) PRIMARY KEY,     -- Hash of (provider_id + ':' + endpoint + ':' + transaction_id)
    provider_id VARCHAR(64) NOT NULL,
    endpoint VARCHAR(64) NOT NULL,
    status_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- ----------------------------------------------------------------------------
-- 7. Audit Trigger Function: Auto-update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE OR REPLACE TRIGGER trg_wallets_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- ============================================================================
-- 8. Seed B2B Game Providers Catalog
-- ============================================================================
INSERT INTO game_providers (id, name, secret_key, webhook_timeout_ms)
VALUES 
    ('pragmatic_play', 'Pragmatic Play Live & Slots', '', 4000),
    ('evolution', 'Evolution Gaming Live Casino', '', 4000),
    ('pgsoft', 'Pocket Games Soft', '', 4000),
    ('spribe', 'Spribe Turbo Games (Aviator)', '', 4000)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. Promotion & Event Engine Tables (PLAY369 Task 3.1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_check_ins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    check_in_date TIMESTAMPTZ NOT NULL,
    claim_date_utc VARCHAR(10) NOT NULL, -- Authoritative 'YYYY-MM-DD' UTC calendar date
    streak_day INTEGER NOT NULL,         -- 1 to 7
    reward_amount NUMERIC(18, 4) NOT NULL,
    reward_type VARCHAR(32) NOT NULL DEFAULT 'BONUS_CREDIT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_check_ins_user_claim_date_utc_idx
ON daily_check_ins (user_id, claim_date_utc);

CREATE TABLE IF NOT EXISTS wheel_spins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spin_date_utc VARCHAR(10) NOT NULL,  -- Authoritative 'YYYY-MM-DD' UTC calendar date
    prize_type VARCHAR(32) NOT NULL,     -- 'REAL_CASH', 'BONUS_CASH', 'FREE_SPINS', 'JACKPOT_TICKET'
    prize_label VARCHAR(64) NOT NULL,
    prize_value NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    is_claimed BOOLEAN NOT NULL DEFAULT TRUE,
    audit_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS wheel_spins_user_spin_date_utc_idx
ON wheel_spins (user_id, spin_date_utc);

-- ----------------------------------------------------------------------------
-- 10. Free Spin Entitlements Table (PLAY369 Task 3.4 / 3.4.1)
-- Authoritative PostgreSQL store for non-monetary casino free spin rewards.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS free_spin_entitlements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(32) NOT NULL DEFAULT 'LUCKY_WHEEL',
    source_reference VARCHAR(128) NOT NULL,
    quantity INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    spin_date_utc VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Database Integrity Constraints (Task 3.4.1)
    CONSTRAINT chk_free_spin_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_free_spin_remaining_non_negative CHECK (remaining_quantity >= 0),
    CONSTRAINT chk_free_spin_remaining_lte_quantity CHECK (remaining_quantity <= quantity),
    CONSTRAINT chk_free_spin_status_valid CHECK (status IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS free_spin_entitlements_source_ref_idx
ON free_spin_entitlements (source_reference);

CREATE UNIQUE INDEX IF NOT EXISTS free_spin_entitlements_user_source_date_idx
ON free_spin_entitlements (user_id, source, spin_date_utc);

CREATE INDEX IF NOT EXISTS free_spin_entitlements_user_status_idx
ON free_spin_entitlements (user_id, status);

-- ----------------------------------------------------------------------------
-- 11. VIP Reward Claims Table (PLAY369 Task 4.2)
-- Authoritative PostgreSQL store for VIP Level-Up reward claim ledger integrity.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vip_reward_claims (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vip_level INTEGER NOT NULL,
    transaction_id VARCHAR(128) NOT NULL,
    reward_amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    credited_at TIMESTAMPTZ,

    -- Database Integrity Constraints (Task 4.2)
    CONSTRAINT chk_vip_reward_claims_amount_positive CHECK (reward_amount > 0),
    CONSTRAINT chk_vip_reward_claims_status_valid CHECK (status IN ('PENDING', 'CREDITED')),
    CONSTRAINT chk_vip_reward_claims_level_range CHECK (vip_level >= 1 AND vip_level <= 10)
);

CREATE UNIQUE INDEX IF NOT EXISTS vip_reward_claims_user_level_idx
ON vip_reward_claims (user_id, vip_level);

CREATE UNIQUE INDEX IF NOT EXISTS vip_reward_claims_transaction_id_idx
ON vip_reward_claims (transaction_id);

CREATE INDEX IF NOT EXISTS vip_reward_claims_user_status_idx
ON vip_reward_claims (user_id, status);

-- ----------------------------------------------------------------------------
-- 12. VIP Progression Events Table (PLAY369 Task 4.3)
-- Authoritative PostgreSQL store for VIP cumulative deposit/bet source events.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vip_progression_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_transaction_id VARCHAR(128) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Database Integrity Constraints (Task 4.3)
    CONSTRAINT chk_vip_progression_events_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_vip_progression_events_source_type_valid CHECK (source_type IN ('DEPOSIT', 'BET'))
);

CREATE UNIQUE INDEX IF NOT EXISTS vip_progression_events_user_source_idx
ON vip_progression_events (user_id, source_transaction_id, source_type);

CREATE INDEX IF NOT EXISTS vip_progression_events_source_tx_idx
ON vip_progression_events (source_transaction_id);

CREATE INDEX IF NOT EXISTS vip_progression_events_user_type_idx
ON vip_progression_events (user_id, source_type);

-- ----------------------------------------------------------------------------
-- 13. Wagering Requirements Table (PLAY369 Task 5.1)
-- Authoritative PostgreSQL store for bonus turnover rollover requirements.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wagering_requirements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    promo_name VARCHAR(128) NOT NULL,
    bonus_amount_granted NUMERIC(18, 4) NOT NULL,
    required_multiplier INTEGER NOT NULL DEFAULT 10,
    target_turnover_amount NUMERIC(18, 4) NOT NULL,
    completed_turnover_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED', 'EXPIRED'
    is_released BOOLEAN NOT NULL DEFAULT FALSE,
    released_at TIMESTAMPTZ,
    release_transaction_id VARCHAR(128),
    audit_metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Database Integrity Constraints (Task 5.1 & 5.2)
    CONSTRAINT chk_wagering_requirements_bonus_positive CHECK (bonus_amount_granted > 0),
    CONSTRAINT chk_wagering_requirements_target_positive CHECK (target_turnover_amount > 0),
    CONSTRAINT chk_wagering_requirements_completed_non_negative CHECK (completed_turnover_amount >= 0),
    CONSTRAINT chk_wagering_requirements_status_valid CHECK (status IN ('ACTIVE', 'COMPLETED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS wagering_requirements_user_status_idx
ON wagering_requirements (user_id, status);

CREATE INDEX IF NOT EXISTS wagering_requirements_released_idx
ON wagering_requirements (user_id, is_released);

CREATE INDEX IF NOT EXISTS wagering_requirements_expires_at_idx
ON wagering_requirements (expires_at);

-- ----------------------------------------------------------------------------
-- 14. Wagering Progress Events Table (PLAY369 Task 5.1)
-- Authoritative PostgreSQL store for verified bet progression events.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wagering_progress_events (
    id SERIAL PRIMARY KEY,
    wagering_requirement_id INTEGER NOT NULL REFERENCES wagering_requirements(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_transaction_id VARCHAR(128) NOT NULL,
    qualified_amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Database Integrity Constraints (Task 5.1)
    CONSTRAINT chk_wagering_progress_events_amount_positive CHECK (qualified_amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS wagering_progress_events_req_source_idx
ON wagering_progress_events (wagering_requirement_id, source_transaction_id);

CREATE INDEX IF NOT EXISTS wagering_progress_events_user_idx
ON wagering_progress_events (user_id);

CREATE INDEX IF NOT EXISTS wagering_progress_events_source_tx_idx
ON wagering_progress_events (source_transaction_id);

CREATE INDEX IF NOT EXISTS wagering_progress_events_requirement_idx
ON wagering_progress_events (wagering_requirement_id);

-- ----------------------------------------------------------------------------
-- 15. Payment Requests Table (bKash, Nagad, Rocket, Upay Local Cashier)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id),
    type VARCHAR(32) NOT NULL, -- 'DEPOSIT', 'WITHDRAWAL'
    method VARCHAR(32) NOT NULL, -- 'BKASH', 'NAGAD', 'ROCKET', 'UPAY', 'USDT'
    amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    sender_number VARCHAR(64),
    receiver_number VARCHAR(64),
    trx_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    admin_note TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_user ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);



