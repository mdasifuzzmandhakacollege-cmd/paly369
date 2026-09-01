-- ============================================================================
-- Migration: 0010_withdrawal_locked_reservation.sql
-- Description: PLAY369 Task 6.1.6 - Atomic Withdrawal Funds Reservation
-- 1. Ensures wallets.locked_balance exists with non-negative check constraint
-- 2. Updates ledger_entries.balance_target check constraint to allow 'REAL', 'BONUS', 'LOCKED'
-- 3. Ensures payment_requests table exists with proper indexes
-- ============================================================================

-- 1. Ensure locked_balance exists on wallets
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'wallets' 
      AND column_name = 'locked_balance'
  ) THEN 
    ALTER TABLE wallets ADD COLUMN locked_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000;
  END IF;
END $$;

-- 2. Ensure non-negative check constraint on locked_balance
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'chk_locked_balance_non_negative'
  ) THEN 
    ALTER TABLE wallets ADD CONSTRAINT chk_locked_balance_non_negative CHECK (locked_balance >= 0);
  END IF;
END $$;

-- 3. Update check constraint on ledger_entries.balance_target to allow 'LOCKED'
DO $$ 
BEGIN 
  ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS chk_ledger_balance_target;
  ALTER TABLE ledger_entries ADD CONSTRAINT chk_ledger_balance_target CHECK (balance_target IN ('REAL', 'BONUS', 'LOCKED'));
END $$;

-- 4. Ensure payment_requests table exists
CREATE TABLE IF NOT EXISTS payment_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id),
    type VARCHAR(32) NOT NULL,
    method VARCHAR(32) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    sender_number VARCHAR(64),
    receiver_number VARCHAR(64),
    trx_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    admin_note TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_user ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
