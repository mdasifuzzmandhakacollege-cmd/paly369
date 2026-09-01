-- ============================================================================
-- Migration: 0005_free_spin_entitlements.sql
-- Description: PLAY369 Task 3.4 / 3.4.1 - Authoritative PostgreSQL Free Spin Entitlements
-- 1. Creates free_spin_entitlements table for non-monetary Lucky Wheel rewards
-- 2. Enforces strict ACID idempotency with sourceReference and (userId, source, spinDateUtc) unique indexes
-- 3. Adds database integrity constraints (Task 3.4.1):
--    - quantity > 0
--    - remaining_quantity >= 0
--    - remaining_quantity <= quantity
--    - status IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED')
-- ============================================================================

CREATE TABLE IF NOT EXISTS free_spin_entitlements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source VARCHAR(32) DEFAULT 'LUCKY_WHEEL' NOT NULL,
  source_reference VARCHAR(128) NOT NULL,
  quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
  spin_date_utc VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  CONSTRAINT chk_free_spin_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_free_spin_remaining_non_negative CHECK (remaining_quantity >= 0),
  CONSTRAINT chk_free_spin_remaining_lte_quantity CHECK (remaining_quantity <= quantity),
  CONSTRAINT chk_free_spin_status_valid CHECK (status IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED'))
);

-- Unique constraints to enforce strict idempotency and prevent duplicate entitlements
CREATE UNIQUE INDEX IF NOT EXISTS free_spin_entitlements_source_ref_idx 
  ON free_spin_entitlements(source_reference);

CREATE UNIQUE INDEX IF NOT EXISTS free_spin_entitlements_user_source_date_idx 
  ON free_spin_entitlements(user_id, source, spin_date_utc);

CREATE INDEX IF NOT EXISTS free_spin_entitlements_user_status_idx 
  ON free_spin_entitlements(user_id, status);

-- Idempotently apply constraints if the table already existed without them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'free_spin_entitlements'
      AND c.conname = 'chk_free_spin_quantity_positive'
  ) THEN
    ALTER TABLE free_spin_entitlements ADD CONSTRAINT chk_free_spin_quantity_positive CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'free_spin_entitlements'
      AND c.conname = 'chk_free_spin_remaining_non_negative'
  ) THEN
    ALTER TABLE free_spin_entitlements ADD CONSTRAINT chk_free_spin_remaining_non_negative CHECK (remaining_quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'free_spin_entitlements'
      AND c.conname = 'chk_free_spin_remaining_lte_quantity'
  ) THEN
    ALTER TABLE free_spin_entitlements ADD CONSTRAINT chk_free_spin_remaining_lte_quantity CHECK (remaining_quantity <= quantity);
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'free_spin_entitlements'
      AND c.conname = 'chk_free_spin_status_valid'
  ) THEN
    ALTER TABLE free_spin_entitlements ADD CONSTRAINT chk_free_spin_status_valid CHECK (status IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED'));
  END IF;
END $$;
