-- ============================================================================
-- Migration: 0001_canonical_wallet_schema.sql
-- Description: Canonical wallet migration & compatibility fix
-- 1. Safely converts existing balance_minor columns (e.g. old NUMERIC(20,0)) to BIGINT
-- 2. Ensures fresh databases create balance_minor as BIGINT NOT NULL DEFAULT 0
-- 3. Safely backfills balance_minor from real_balance (0.0516 BDT = 516 minor units)
-- 4. Aligns version type to BIGINT NOT NULL DEFAULT 1 preserving existing versions
-- 5. Completely idempotent — safe to execute multiple times without balance resets
-- ============================================================================

-- 1. Safely handle balance_minor column creation or type conversion to BIGINT
DO $$ 
BEGIN 
  -- Case A: Column exists with a non-bigint type (e.g. old numeric/varchar)
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'wallets' 
      AND column_name = 'balance_minor' 
      AND data_type IN ('numeric', 'double precision', 'real', 'integer', 'smallint', 'character varying', 'text')
  ) THEN 
    -- Convert existing values to BIGINT using explicit rounded conversion
    ALTER TABLE wallets ALTER COLUMN balance_minor TYPE BIGINT USING ROUND(balance_minor::numeric)::bigint;
  
  -- Case B: Column does not exist yet (fresh database)
  ELSIF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'wallets' 
      AND column_name = 'balance_minor'
  ) THEN
    ALTER TABLE wallets ADD COLUMN balance_minor BIGINT DEFAULT 0;
  END IF;
END $$;

-- 2. Ensure commission_balance column exists on wallets table
ALTER TABLE IF EXISTS wallets ADD COLUMN IF NOT EXISTS commission_balance NUMERIC(18, 4) DEFAULT 0.0000;

-- 3. Safely handle version column conversion or creation as BIGINT preserving existing version values
DO $$ 
BEGIN 
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'wallets' 
      AND column_name = 'version' 
      AND data_type IN ('integer', 'smallint', 'numeric')
  ) THEN 
    ALTER TABLE wallets ALTER COLUMN version TYPE BIGINT USING version::bigint;
  ELSIF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'wallets' 
      AND column_name = 'version'
  ) THEN
    ALTER TABLE wallets ADD COLUMN version BIGINT DEFAULT 1;
  END IF;
END $$;

-- 4. Ensure unique constraint exists on (user_id, currency)
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_wallet_user_currency'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT uq_wallet_user_currency UNIQUE (user_id, currency);
  END IF;
END $$;

-- 5. Safe backfill of balance_minor from real_balance (0.0516 BDT = 516 minor units)
-- Only backfills if balance_minor is NULL or 0 and real_balance > 0, preserving existing non-zero minor balances
UPDATE wallets 
SET balance_minor = ROUND(real_balance * 10000)::bigint 
WHERE (balance_minor IS NULL OR balance_minor = 0) AND real_balance > 0;

-- 6. Guarantee zero defaults and NOT NULL constraints on canonical columns
UPDATE wallets SET balance_minor = 0 WHERE balance_minor IS NULL;
UPDATE wallets SET version = 1 WHERE version IS NULL;

ALTER TABLE IF EXISTS wallets ALTER COLUMN balance_minor SET DEFAULT 0;
ALTER TABLE IF EXISTS wallets ALTER COLUMN balance_minor SET NOT NULL;
ALTER TABLE IF EXISTS wallets ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE IF EXISTS wallets ALTER COLUMN version SET NOT NULL;
