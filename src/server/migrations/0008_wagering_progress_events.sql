-- ============================================================================
-- Migration: 0008_wagering_progress_events.sql
-- Description: PLAY369 Task 5.1 - Authoritative PostgreSQL Wagering Progression Engine
-- 1. Creates wagering_requirements table if not exists with integrity constraints
-- 2. Creates wagering_progress_events table for tracking verified settled BET progress
-- 3. Enforces strict ACID idempotency with UNIQUE(wagering_requirement_id, source_transaction_id)
-- 4. Adds database integrity constraints:
--    - qualified_amount > 0
--    - target_turnover_amount > 0
--    - bonus_amount_granted > 0
--    - completed_turnover_amount >= 0
--    - status IN ('ACTIVE', 'COMPLETED', 'EXPIRED')
-- ============================================================================

-- 1. Ensure wagering_requirements table exists
CREATE TABLE IF NOT EXISTS wagering_requirements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promo_name VARCHAR(128) NOT NULL,
  bonus_amount_granted NUMERIC(18, 4) NOT NULL,
  required_multiplier INTEGER NOT NULL DEFAULT 10,
  target_turnover_amount NUMERIC(18, 4) NOT NULL,
  completed_turnover_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_wagering_requirements_bonus_positive CHECK (bonus_amount_granted > 0),
  CONSTRAINT chk_wagering_requirements_target_positive CHECK (target_turnover_amount > 0),
  CONSTRAINT chk_wagering_requirements_completed_non_negative CHECK (completed_turnover_amount >= 0),
  CONSTRAINT chk_wagering_requirements_status_valid CHECK (status IN ('ACTIVE', 'COMPLETED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS wagering_requirements_user_status_idx
  ON wagering_requirements (user_id, status);

CREATE INDEX IF NOT EXISTS wagering_requirements_expires_at_idx
  ON wagering_requirements (expires_at);

-- 2. Create wagering_progress_events table
CREATE TABLE IF NOT EXISTS wagering_progress_events (
  id SERIAL PRIMARY KEY,
  wagering_requirement_id INTEGER NOT NULL REFERENCES wagering_requirements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_transaction_id VARCHAR(128) NOT NULL,
  qualified_amount NUMERIC(18, 4) NOT NULL,
  currency VARCHAR(3) DEFAULT 'BDT' NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

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

-- 3. Idempotent check constraints validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'wagering_requirements' AND c.conname = 'chk_wagering_requirements_bonus_positive'
  ) THEN
    ALTER TABLE wagering_requirements ADD CONSTRAINT chk_wagering_requirements_bonus_positive CHECK (bonus_amount_granted > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'wagering_requirements' AND c.conname = 'chk_wagering_requirements_target_positive'
  ) THEN
    ALTER TABLE wagering_requirements ADD CONSTRAINT chk_wagering_requirements_target_positive CHECK (target_turnover_amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'wagering_requirements' AND c.conname = 'chk_wagering_requirements_completed_non_negative'
  ) THEN
    ALTER TABLE wagering_requirements ADD CONSTRAINT chk_wagering_requirements_completed_non_negative CHECK (completed_turnover_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'wagering_requirements' AND c.conname = 'chk_wagering_requirements_status_valid'
  ) THEN
    ALTER TABLE wagering_requirements ADD CONSTRAINT chk_wagering_requirements_status_valid CHECK (status IN ('ACTIVE', 'COMPLETED', 'EXPIRED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'wagering_progress_events' AND c.conname = 'chk_wagering_progress_events_amount_positive'
  ) THEN
    ALTER TABLE wagering_progress_events ADD CONSTRAINT chk_wagering_progress_events_amount_positive CHECK (qualified_amount > 0);
  END IF;
END $$;
