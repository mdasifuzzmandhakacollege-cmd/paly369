/**
 * @file fixtures.ts
 * @description Deterministic Test Fixtures for PLAY369 Task 6.2A: Sandbox-Only Payment Contract Harness.
 * 
 * Invariants:
 * - All monetary amounts are formatted as exact decimal strings (scale-4: "100.0000").
 * - Verification states strictly match: COMPLETED, PENDING, ERROR.
 * - Zero live dependencies or production credentials.
 */

import { SandboxPaymentFixture } from './types';

export const PAYMENT_CREATED_FIXTURE: SandboxPaymentFixture = {
  transactionId: 'SBX_TX_CREATED_001',
  customerName: 'Rahim Uddin',
  customerEmail: 'rahim@example.com',
  amount: '1000.0000',
  status: 'PENDING',
  code: 'SANDBOX_PENDING',
  message: 'Sandbox payment initialized in pending state',
  metadata: {
    tier: 'VIP_1',
    channel: 'SANDBOX_BKASH',
    createdVia: 'HARNESS_FIXTURE'
  }
};

export const PAYMENT_PENDING_FIXTURE: SandboxPaymentFixture = {
  transactionId: 'SBX_TX_PENDING_002',
  customerName: 'Karim Hossain',
  customerEmail: 'karim@example.com',
  amount: '2500.0000',
  status: 'PENDING',
  code: 'SANDBOX_PENDING',
  message: 'Payment is awaiting simulated confirmation',
  metadata: {
    providerRef: 'SBX_PROV_REF_99',
    channel: 'SANDBOX_NAGAD'
  }
};

export const PAYMENT_COMPLETED_FIXTURE: SandboxPaymentFixture = {
  transactionId: 'SBX_TX_COMPLETED_003',
  customerName: 'Fatima Begum',
  customerEmail: 'fatima@example.com',
  amount: '5000.0000',
  status: 'COMPLETED',
  code: 'SANDBOX_VERIFIED_NO_SETTLEMENT',
  message: 'Payment verified in sandbox mode (non-monetary, zero wallet mutation)',
  metadata: {
    paymentMethod: 'SANDBOX_BKASH',
    simulatedFee: '0.0000',
    channel: 'SANDBOX'
  }
};

export const PAYMENT_ERROR_FIXTURE: SandboxPaymentFixture = {
  transactionId: 'SBX_TX_ERROR_004',
  customerName: 'Jamal Ahmed',
  customerEmail: 'jamal@example.com',
  amount: '750.0000',
  status: 'ERROR',
  code: 'SANDBOX_ERROR',
  message: 'Simulated payment processing failure in sandbox',
  metadata: {
    failureReason: 'SIMULATED_USER_CANCELLED',
    channel: 'SANDBOX'
  }
};

export const PAYMENT_DUPLICATE_FIXTURE: SandboxPaymentFixture = {
  transactionId: 'SBX_TX_DUPLICATE_005',
  customerName: 'Tanvir Islam',
  customerEmail: 'tanvir@example.com',
  amount: '1500.0000',
  status: 'COMPLETED',
  code: 'SANDBOX_VERIFIED_NO_SETTLEMENT',
  message: 'Payment verified in sandbox mode for duplicate assertion test',
  metadata: {
    purpose: 'DUPLICATE_VERIFICATION_IDEMPOTENCY_TEST',
    channel: 'SANDBOX'
  }
};

export const PAYMENT_AMOUNT_MISMATCH_FIXTURE: SandboxPaymentFixture = {
  transactionId: 'SBX_TX_MISMATCH_006',
  customerName: 'Nusrat Jahan',
  customerEmail: 'nusrat@example.com',
  amount: '3000.0000', // Expected actual fixture amount
  status: 'COMPLETED',
  code: 'SANDBOX_VERIFIED_NO_SETTLEMENT',
  message: 'Payment fixture for testing client amount discrepancy',
  metadata: {
    channel: 'SANDBOX'
  }
};

export function getDefaultSandboxFixtures(): SandboxPaymentFixture[] {
  return [
    { ...PAYMENT_CREATED_FIXTURE },
    { ...PAYMENT_PENDING_FIXTURE },
    { ...PAYMENT_COMPLETED_FIXTURE },
    { ...PAYMENT_ERROR_FIXTURE },
    { ...PAYMENT_DUPLICATE_FIXTURE },
    { ...PAYMENT_AMOUNT_MISMATCH_FIXTURE }
  ];
}
