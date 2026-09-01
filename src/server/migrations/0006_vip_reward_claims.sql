-- ============================================================================
-- Migration: 0006_vip_reward_claims.sql
-- Description: PLAY369 Task 4.2 - Authoritative PostgreSQL VIP Reward Claims Ledger Integrity
-- 1. Creates vip_reward_claims table for tracking VIP level-up reward fulfillment
-- 2. Enforces strict ACID idempotency with UNIQUE(user_id, vip_level) and UNIQUE(transaction_id)
-- 3. Adds database integrity constraints:
--    - reward_amount > 0
--    - status IN ('PENDING', 'CREDITED')
--    - vip_level >= 1 AND vip_level <= 10
-- ============================================================================

CREATE TABLE IF NOT EXISTS vip_reward_claims (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vip_level INTEGER NOT NULL,
  transaction_id VARCHAR(128) NOT NULL,
  reward_amount NUMERIC(18, 4) NOT NULL,
  currency VARCHAR(3) DEFAULT 'BDT' NOT NULL,
  status VARCHAR(32) DEFAULT 'PENDING' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  credited_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_vip_reward_claims_amount_positive CHECK (reward_amount > 0),
  CONSTRAINT chk_vip_reward_claims_status_valid CHECK (status IN ('PENDING', 'CREDITED')),
  CONSTRAINT chk_vip_reward_claims_level_range CHECK (vip_level >= 1 AND vip_level <= 10)
);

-- Unique constraints to enforce strict idempotency and prevent duplicate claims
CREATE UNIQUE INDEX IF NOT EXISTS vip_reward_claims_user_level_idx 
  ON vip_reward_claims(user_id, vip_level);

CREATE UNIQUE INDEX IF NOT EXISTS vip_reward_claims_transaction_id_idx 
  ON vip_reward_claims(transaction_id);

CREATE INDEX IF NOT EXISTS vip_reward_claims_user_status_idx 
  ON vip_reward_claims(user_id, status);

-- Scoped idempotent check constraints verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'vip_reward_claims' AND c.conname = 'chk_vip_reward_claims_amount_positive'
  ) THEN
    ALTER TABLE vip_reward_claims ADD CONSTRAINT chk_vip_reward_claims_amount_positive CHECK (reward_amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'vip_reward_claims' AND c.conname = 'chk_vip_reward_claims_status_valid'
  ) THEN
    ALTER TABLE vip_reward_claims ADD CONSTRAINT chk_vip_reward_claims_status_valid CHECK (status IN ('PENDING', 'CREDITED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'vip_reward_claims' AND c.conname = 'chk_vip_reward_claims_level_range'
  ) THEN
    ALTER TABLE vip_reward_claims ADD CONSTRAINT chk_vip_reward_claims_level_range CHECK (vip_level >= 1 AND vip_level <= 10);
  END IF;
END $$;
