-- ============================================================================
-- Migration: 0009_wagering_release_gate.sql
-- Description: PLAY369 Task 5.2 - Wagering Release and Withdrawal Gating
-- 1. Adds release status, released timestamp, release transaction ID, and audit metadata to wagering_requirements
-- 2. Creates index on (user_id, is_released) for fast gating and conversion lookups
-- 3. Ensures strict database integrity constraints
-- ============================================================================

ALTER TABLE wagering_requirements
  ADD COLUMN IF NOT EXISTS is_released BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS release_transaction_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS audit_metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS wagering_requirements_released_idx
  ON wagering_requirements (user_id, is_released);
