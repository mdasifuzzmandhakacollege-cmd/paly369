-- ============================================================================
-- Migration: 0004_wheel_spin_audit_metadata.sql
-- Description: PLAY369 Task 3.3 - Add audit_metadata to wheel_spins
-- 1. Idempotently adds audit_metadata JSONB DEFAULT '{}' to wheel_spins
-- 2. Preserves all historical wheel spin records without data loss
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'wheel_spins'
      AND column_name = 'audit_metadata'
  ) THEN
    ALTER TABLE wheel_spins ADD COLUMN audit_metadata JSONB DEFAULT '{}'::jsonb NOT NULL;
  END IF;
END $$;
