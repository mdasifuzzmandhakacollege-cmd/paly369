/**
 * @file types.ts
 * @description Core Data Types, Enums, and Contracts for PLAY369 Wallet Ledger Foundation.
 * 
 * [ARCHITECTURAL INVARIANTS]:
 * 1. Financial Precision: Money is strictly calculated using integer minor units (e.g. cents/poisha).
 *    No floating-point math is ever permitted in ledger state mutations.
 * 2. Immutability: Ledger entries are append-only. Once committed, they cannot be updated or deleted.
 * 3. Atomicity & Row-Locking: Balance updates must occur inside an ACID transaction with
 *    SELECT ... FOR UPDATE row locks on the wallet row.
 * 4. Idempotency: Duplicate transaction IDs under the same scope or idempotency key return the
 *    original committed outcome without duplicate financial debit/credit.
 */

import { createHash } from 'crypto';
import { maskIdempotencyKey } from '../gateway/masking';

export type SupportedCurrency = 'BDT' | 'USD' | 'EUR' | 'INR';

export const SUPPORTED_CURRENCIES: ReadonlySet<SupportedCurrency> = new Set(['BDT', 'USD', 'EUR', 'INR']);

export type LedgerTransactionType =
  | 'DEBIT'       // Generic debit (e.g. gameplay wager, service charge)
  | 'CREDIT'      // Generic credit (e.g. gameplay win, prize)
  | 'REVERSAL'    // Reversal / refund of a previous debit
  | 'ADJUSTMENT'; // Administrative manual adjustment (with mandatory audit trail)

export type LedgerTransactionStatus =
  | 'COMMITTED'
  | 'REJECTED'
  | 'ROLLED_BACK';

export type LedgerBalanceTarget = 'REAL' | 'BONUS' | 'LOCKED';

export interface WalletRecord {
  id: string | number;
  userId: string | number;
  currency: SupportedCurrency;
  balanceMinor: bigint; // Stored as integer minor units (e.g. 100.5000 BDT = 1005000n minor units)
  realBalance?: string; // Canonical 4-decimal numeric balance (e.g. "100.5000")
  bonusBalance?: string; // Canonical 4-decimal bonus balance (e.g. "50.0000")
  lockedBalance?: string; // Canonical 4-decimal locked balance (e.g. "0.0000")
  version: bigint;      // Optimistic locking / mutation sequence counter
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerEntryRecord {
  id: string;
  walletId: string | number;
  userId: string | number;
  transactionId: string;
  referenceTransactionId?: string | null;
  type: LedgerTransactionType;
  balanceTarget: LedgerBalanceTarget;
  amountMinor: bigint;
  currency: SupportedCurrency;
  beforeBalanceMinor: bigint;
  afterBalanceMinor: bigint;
  status: LedgerTransactionStatus;
  correlationId: string;
  auditMetadata: Record<string, any>;
  createdAt: Date;
}

export interface IdempotencyRecord {
  idempotencyKey: string;
  transactionId: string;
  statusCode: number;
  responsePayload: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
}

export interface LedgerTransactionRequest {
  userId: string | number;
  currency: string;
  transactionId: string;
  referenceTransactionId?: string;
  type: LedgerTransactionType;
  targetBalance?: LedgerBalanceTarget;
  amountMinor?: bigint | number | string;
  amountMajor?: string | number;
  correlationId?: string;
  auditMetadata?: Record<string, any>;
}

export interface LedgerTransactionResult {
  success: boolean;
  isIdempotent: boolean;
  ledgerEntryId: string;
  transactionId: string;
  referenceTransactionId?: string | null;
  userId: string;
  currency: SupportedCurrency;
  type: LedgerTransactionType;
  targetBalance?: LedgerBalanceTarget;
  amountMinor: string;          // Stringified bigint for safe JSON serialization
  amountMajor: string;          // Human-readable formatted string with 4-decimal precision (e.g. "100.5000", "0.0516")
  beforeBalanceMinor: string;
  afterBalanceMinor: string;
  afterBalanceMajor: string;
  correlationId: string;
  timestamp: string;
}

export interface BonusToRealTransferRequest {
  userId: string | number;
  currency: string;
  transactionId: string;
  amountMinor?: bigint | number | string;
  amountMajor?: string | number;
  wageringRequirementId: number;
  correlationId?: string;
  auditMetadata?: Record<string, any>;
}

export interface BonusToRealTransferResult {
  success: boolean;
  isIdempotent: boolean;
  transactionId: string;
  userId: string;
  currency: SupportedCurrency;
  amountMinor: string;
  amountMajor: string;
  debitEntryId: string;
  creditEntryId: string;
  beforeBonusBalanceMinor: string;
  afterBonusBalanceMinor: string;
  beforeRealBalanceMinor: string;
  afterRealBalanceMinor: string;
  bonusBalanceMajor: string;
  realBalanceMajor: string;
  correlationId: string;
  timestamp: string;
}

export interface WithdrawalReservationFingerprint {
  userId: string;
  currency: string;
  amount: string;
  paymentMethod: string;
  receiverAccount: string;
  operationType: 'WITHDRAWAL_RESERVATION';
}

export interface WithdrawalReservationRequest {
  userId: string | number;
  currency: string;
  withdrawalId?: string;
  transactionId?: string;
  amount?: string;
  amountMinor?: bigint | number | string;
  amountMajor?: string | number;
  paymentMethod?: string;
  method?: string;
  receiverNumber?: string;
  recipientAccount?: string;
  adminNote?: string;
  idempotencyKey?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
  auditMetadata?: Record<string, any>;
}

export interface WithdrawalReservationResult {
  success?: boolean;
  isIdempotent: boolean;
  withdrawalId: string;
  transactionId: string;
  paymentRequestId: number | string;
  userId?: string;
  walletId: number | string;
  currency: string;
  paymentMethod?: string;
  method?: string;
  receiverNumber?: string;
  recipientAccount?: string;
  amount: string;
  amountMinor?: string;
  amountMajor?: string;
  beforeRealBalance: string;
  afterRealBalance: string;
  beforeLockedBalance: string;
  afterLockedBalance: string;
  beforeRealBalanceMinor?: string;
  afterRealBalanceMinor?: string;
  beforeLockedBalanceMinor?: string;
  afterLockedBalanceMinor?: string;
  realBalanceMajor?: string;
  lockedBalanceMajor?: string;
  debitLedgerEntryId: string;
  lockLedgerEntryId: string;
  creditEntryId?: string;
  debitEntryId?: string;
  status: 'PENDING';
  correlationId: string;
  fingerprint?: WithdrawalReservationFingerprint;
  executedAt: string;
  timestamp?: string;
}

export interface BalanceTargetReconciliationSummary {
  isReconciled: boolean;
  walletBalanceMinor: string;
  walletBalanceMajor: string;
  computedLedgerNetMinor: string;
  discrepancyMinor: string;
}

export interface WalletAuditReconciliationResult {
  isReconciled: boolean;
  walletBalanceMinor: string;
  walletBalanceMajor: string;
  computedLedgerNetMinor: string;
  discrepancyMinor: string;
  real: BalanceTargetReconciliationSummary;
  bonus: BalanceTargetReconciliationSummary;
  locked?: BalanceTargetReconciliationSummary;
}

export class LedgerValidationError extends Error {
  public readonly code: string = 'LEDGER_VALIDATION_ERROR';
  public readonly statusCode: number = 400;
  public readonly details?: Record<string, any>;

  constructor(message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'LedgerValidationError';
    this.details = details;
  }
}

/**
 * PLAY369 Task 6.1.6.2: Safe Idempotency Key -> Transaction ID Derivation
 * Derives a deterministic cryptographic digest from authenticated userId + exact original Idempotency-Key.
 * Collisions between differing keys (including punctuation variations) are practically negligible.
 * 
 * Formula: WTH_RES_<userId>_<SHA256(userId:idempotencyKey)[0..32]>
 */
export function deriveWithdrawalTransactionId(userId: string | number, idempotencyKey: string): string {
  const normalizedUser = String(userId).trim();
  const rawKey = String(idempotencyKey);
  const hash = createHash('sha256')
    .update(`${normalizedUser}:${rawKey}`)
    .digest('hex');
  return `WTH_RES_${normalizedUser}_${hash.substring(0, 32)}`;
}

export class IdempotencyConflictError extends Error {
  public readonly code: string = 'IDEMPOTENCY_CONFLICT';
  public readonly statusCode: number = 409;
  public readonly details?: Record<string, any>;

  constructor(keyOrMessage: string, details?: Record<string, any>) {
    const isKey = keyOrMessage && !keyOrMessage.toLowerCase().includes('conflict');
    const message = isKey
      ? `Idempotency conflict for key '${maskIdempotencyKey(keyOrMessage)}'`
      : keyOrMessage;
    super(message);
    this.name = 'IdempotencyConflictError';
    this.details = details;
  }
}

export class InsufficientFundsError extends Error {
  public readonly code: string = 'INSUFFICIENT_FUNDS';
  public readonly statusCode: number = 422;
  public readonly availableMinor: string;
  public readonly requiredMinor: string;
  public readonly currency: string;

  constructor(availableMinor: bigint, requiredMinor: bigint, currency: string) {
    super(`Insufficient funds. Required: ${requiredMinor}, Available: ${availableMinor} ${currency}`);
    this.name = 'InsufficientFundsError';
    this.availableMinor = availableMinor.toString();
    this.requiredMinor = requiredMinor.toString();
    this.currency = currency;
  }
}

export class WalletFrozenError extends Error {
  public readonly code: string = 'WALLET_FROZEN';
  public readonly statusCode: number = 403;

  constructor(userId: string, status: string) {
    super(`Wallet for user '${userId}' is not active (status: ${status})`);
    this.name = 'WalletFrozenError';
  }
}

export class WalletNotFoundError extends Error {
  public readonly code: string = 'WALLET_NOT_FOUND';
  public readonly statusCode: number = 404;

  constructor(userId: string, currency: string) {
    super(`Wallet not found for user '${userId}' with currency '${currency}'`);
    this.name = 'WalletNotFoundError';
  }
}
