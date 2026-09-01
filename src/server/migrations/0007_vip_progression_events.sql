-- ============================================================================
-- Migration: 0007_vip_progression_events.sql
-- Description: PLAY369 Task 4.3 - Authoritative PostgreSQL VIP Progression Source Authority
-- 1. Creates vip_progression_events table for tracking verified deposits and bets
-- 2. Enforces strict ACID idempotency with UNIQUE(user_id, source_transaction_id, source_type)
-- 3. Adds database integrity constraints:
--    - amount > 0
--    - source_type IN ('DEPOSIT', 'BET')
-- ============================================================================

CREATE TABLE IF NOT EXISTS vip_progression_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_transaction_id VARCHAR(128) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  amount NUMERIC(18, 4) NOT NULL,
  currency VARCHAR(3) DEFAULT 'BDT' NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  CONSTRAINT chk_vip_progression_events_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_vip_progression_events_source_type_valid CHECK (source_type IN ('DEPOSIT', 'BET'))
);

-- Unique constraints to enforce strict idempotency and prevent duplicate event processing
CREATE UNIQUE INDEX IF NOT EXISTS vip_progression_events_user_source_idx 
  ON vip_progression_events(user_id, source_transaction_id, source_type);

CREATE INDEX IF NOT EXISTS vip_progression_events_source_tx_idx 
  ON vip_progression_events(source_transaction_id);

CREATE INDEX IF NOT EXISTS vip_progression_events_user_type_idx 
  ON vip_progression_events(user_id, source_type);

-- Scoped idempotent check constraints verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'vip_progression_events' AND c.conname = 'chk_vip_progression_events_amount_positive'
  ) THEN
    ALTER TABLE vip_progression_events ADD CONSTRAINT chk_vip_progression_events_amount_positive CHECK (amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'vip_progression_events' AND c.conname = 'chk_vip_progression_events_source_type_valid'
  ) THEN
    ALTER TABLE vip_progression_events ADD CONSTRAINT chk_vip_progression_events_source_type_valid CHECK (source_type IN ('DEPOSIT', 'BET'));
  END IF;
END $$;
