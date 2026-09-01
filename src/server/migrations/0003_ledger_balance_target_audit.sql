-- ============================================================================
-- Migration: 0003_ledger_balance_target_audit.sql
-- Description: PLAY369 Task 3.2.1 - Ledger Balance Target & Audit Reconciliation Fix
-- 1. Idempotently adds balance_target VARCHAR(16) column to ledger_entries
-- 2. Safely backfills historical balance_target values from audit_metadata:
--    - if audit_metadata->>'targetBalance' = 'BONUS' OR audit_metadata->>'category' = 'BONUS_CASH' => 'BONUS'
--    - otherwise => 'REAL'
-- 3. Enforces DEFAULT 'REAL' on balance_target
-- 4. Enforces NOT NULL on balance_target
-- 5. Idempotently adds CHECK constraint (balance_target IN ('REAL', 'BONUS'))
-- 6. Adds index on (wallet_id, balance_target, status) for high-performance audit reconciliation
-- 7. Fully idempotent — safe to execute multiple times without data loss or error
-- ============================================================================

-- 1. Ensure balance_target column exists
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'ledger_entries' 
      AND column_name = 'balance_target'
  ) THEN 
    ALTER TABLE ledger_entries ADD COLUMN balance_target VARCHAR(16);
  END IF;
END $$;

-- 2. Backfill historical entries from audit_metadata
-- Preserves existing ledger history without deletion
UPDATE ledger_entries
SET balance_target = CASE
  WHEN (
    COALESCE(audit_metadata->>'targetBalance', '') = 'BONUS' OR 
    COALESCE(audit_metadata->>'category', '') = 'BONUS_CASH'
  ) THEN 'BONUS'
  ELSE 'REAL'
END
WHERE balance_target IS NULL;

-- 3. Set default to 'REAL'
ALTER TABLE ledger_entries ALTER COLUMN balance_target SET DEFAULT 'REAL';

-- 4. Enforce NOT NULL constraint
ALTER TABLE ledger_entries ALTER COLUMN balance_target SET NOT NULL;

-- 5. Idempotently add CHECK constraint
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'chk_ledger_balance_target'
  ) THEN 
    ALTER TABLE ledger_entries 
    ADD CONSTRAINT chk_ledger_balance_target CHECK (balance_target IN ('REAL', 'BONUS'));
  END IF;
END $$;

-- 6. Idempotently create performance index for balance-target reconciliation
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_target_status 
ON ledger_entries (wallet_id, balance_target, status);
