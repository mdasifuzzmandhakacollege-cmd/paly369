-- ============================================================================
-- Migration: 0002_promotion_utc_daily_integrity.sql
-- Description: PLAY369 Task 3.1.1 - Promotion UTC Daily Claim Schema Migration
-- 1. Idempotently adds claim_date_utc VARCHAR(10) to daily_check_ins
-- 2. Backfills claim_date_utc from check_in_date / created_at formatted as UTC 'YYYY-MM-DD'
-- 3. Detects duplicate historical (user_id, claim_date_utc) rows and FAILS clearly
--    (preserves historical records; does NOT silently delete/pick winners)
-- 4. Enforces NOT NULL on daily_check_ins.claim_date_utc
-- 5. Creates unique index daily_check_ins_user_claim_date_utc_idx on (user_id, claim_date_utc)
-- 6. Idempotently adds spin_date_utc VARCHAR(10) to wheel_spins
-- 7. Backfills spin_date_utc from created_at formatted as UTC 'YYYY-MM-DD'
-- 8. Detects duplicate historical (user_id, spin_date_utc) rows and FAILS clearly
--    (preserves historical records; does NOT silently delete/pick winners)
-- 9. Enforces NOT NULL on wheel_spins.spin_date_utc
-- 10. Creates unique index wheel_spins_user_spin_date_utc_idx on (user_id, spin_date_utc)
-- 11. Idempotent and safe to run multiple times without data divergence
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART A: daily_check_ins Migration
-- ----------------------------------------------------------------------------

-- A1. Ensure claim_date_utc column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'daily_check_ins'
      AND column_name = 'claim_date_utc'
  ) THEN
    ALTER TABLE daily_check_ins ADD COLUMN claim_date_utc VARCHAR(10);
  END IF;
END $$;

-- A2. Backfill existing rows using UTC calendar date format 'YYYY-MM-DD'
UPDATE daily_check_ins
SET claim_date_utc = TO_CHAR(COALESCE(check_in_date, created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE claim_date_utc IS NULL;

-- A3. Duplicate Historical Record Collision Guard:
-- If historical data contains duplicate claims for the same user on the same UTC date,
-- fail the migration explicitly to prevent silent deletion or arbitrary selection.
DO $$
DECLARE
  v_dup_count INTEGER;
  v_dup_sample TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(user_id || ':' || claim_date_utc || ' (' || cnt || ' claims)', ', ')
  INTO v_dup_count, v_dup_sample
  FROM (
    SELECT user_id, claim_date_utc, COUNT(*) as cnt
    FROM daily_check_ins
    WHERE claim_date_utc IS NOT NULL
    GROUP BY user_id, claim_date_utc
    HAVING COUNT(*) > 1
    LIMIT 5
  ) dups;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION_FAILED: Duplicate historical daily_check_ins detected for user/UTC date: %. Cannot create unique index without manual reconciliation.', v_dup_sample;
  END IF;
END $$;

-- A4. Enforce NOT NULL constraint once backfilled and verified
ALTER TABLE daily_check_ins ALTER COLUMN claim_date_utc SET NOT NULL;

-- A5. Idempotently create unique index on (user_id, claim_date_utc)
CREATE UNIQUE INDEX IF NOT EXISTS daily_check_ins_user_claim_date_utc_idx
ON daily_check_ins (user_id, claim_date_utc);


-- ----------------------------------------------------------------------------
-- PART B: wheel_spins Migration
-- ----------------------------------------------------------------------------

-- B1. Ensure spin_date_utc column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'wheel_spins'
      AND column_name = 'spin_date_utc'
  ) THEN
    ALTER TABLE wheel_spins ADD COLUMN spin_date_utc VARCHAR(10);
  END IF;
END $$;

-- B2. Backfill existing rows using UTC calendar date format 'YYYY-MM-DD'
UPDATE wheel_spins
SET spin_date_utc = TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE spin_date_utc IS NULL;

-- B3. Duplicate Historical Record Collision Guard:
-- If historical data contains duplicate spins for the same user on the same UTC date,
-- fail the migration explicitly to prevent silent deletion or arbitrary selection.
DO $$
DECLARE
  v_dup_count INTEGER;
  v_dup_sample TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(user_id || ':' || spin_date_utc || ' (' || cnt || ' spins)', ', ')
  INTO v_dup_count, v_dup_sample
  FROM (
    SELECT user_id, spin_date_utc, COUNT(*) as cnt
    FROM wheel_spins
    WHERE spin_date_utc IS NOT NULL
    GROUP BY user_id, spin_date_utc
    HAVING COUNT(*) > 1
    LIMIT 5
  ) dups;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION_FAILED: Duplicate historical wheel_spins detected for user/UTC date: %. Cannot create unique index without manual reconciliation.', v_dup_sample;
  END IF;
END $$;

-- B4. Enforce NOT NULL constraint once backfilled and verified
ALTER TABLE wheel_spins ALTER COLUMN spin_date_utc SET NOT NULL;

-- B5. Idempotently create unique index on (user_id, spin_date_utc)
CREATE UNIQUE INDEX IF NOT EXISTS wheel_spins_user_spin_date_utc_idx
ON wheel_spins (user_id, spin_date_utc);
