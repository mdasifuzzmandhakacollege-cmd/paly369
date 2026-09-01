/**
 * @file seamless.ts
 * @description Core TypeScript interfaces, DTOs, and Error Codes for iGaming Seamless Wallet.
 */

// ----------------------------------------------------------------------------
// 1. Standard iGaming Error Codes
// ----------------------------------------------------------------------------
export enum SeamlessErrorCode {
  SUCCESS = 'SUCCESS',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  TIMESTAMP_EXPIRED = 'TIMESTAMP_EXPIRED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_FROZEN = 'USER_FROZEN',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  DUPLICATE_TRANSACTION = 'DUPLICATE_TRANSACTION',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  TRANSACTION_ALREADY_SETTLED = 'TRANSACTION_ALREADY_SETTLED',
  ROUND_ALREADY_CLOSED = 'ROUND_ALREADY_CLOSED',
  INVALID_CURRENCY = 'INVALID_CURRENCY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

// ----------------------------------------------------------------------------
// 2. Incoming Request DTOs from Game Provider
// ----------------------------------------------------------------------------

export interface BaseSeamlessRequest {
  provider_id: string;
  user_id: string;
  currency: string;
}

export interface BalanceRequest extends BaseSeamlessRequest {
  game_id?: string;
  session_id?: string;
}

export interface BetRequest extends BaseSeamlessRequest {
  transaction_id: string;      // Provider's unique transaction ID
  round_id: string;            // Provider's unique round ID
  game_id: string;
  amount: number;              // Positive number representing wager
  session_id?: string;
  is_round_end?: boolean;
  metadata?: Record<string, unknown>;
}

export interface WinRequest extends BaseSeamlessRequest {
  transaction_id: string;      // Provider's unique win transaction ID
  reference_transaction_id?: string; // Links back to the original Bet transaction ID
  round_id: string;
  game_id: string;
  amount: number;              // Positive number (0 for loss, >0 for win payout)
  is_round_end?: boolean;
  jackpot_amount?: number;
  metadata?: Record<string, unknown>;
}

export interface RefundRequest extends BaseSeamlessRequest {
  transaction_id: string;             // Unique refund transaction ID
  reference_transaction_id: string;   // Transaction ID of the original BET to refund
  round_id: string;
  game_id: string;
  amount: number;                     // Amount to refund back to player
  reason?: string;                    // e.g., 'ROUND_CANCELLED', 'PROVIDER_TIMEOUT'
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// 3. Outgoing Response DTOs to Game Provider
// ----------------------------------------------------------------------------

export interface SeamlessBaseResponse {
  code: SeamlessErrorCode | string;
  message: string;
  balance: number;             // Real balance
  bonus_balance?: number;
  currency: string;
  timestamp: number;           // Epoch millisecond or second
}

export interface BalanceResponse extends SeamlessBaseResponse {
  user_id: string;
}

export interface TransactionResponse extends SeamlessBaseResponse {
  transaction_id: string;
  operator_transaction_id: string; // Internal ledger UUID
  round_id: string;
  is_idempotent?: boolean;     // Indicates whether this was a replayed identical request
}

export interface ErrorResponse {
  code: SeamlessErrorCode;
  message: string;
  balance?: number;
  currency?: string;
  timestamp: number;
}

// ----------------------------------------------------------------------------
// 4. Database Entities
// ----------------------------------------------------------------------------

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'SELF_EXCLUDED' | 'LOCKED';
export type WalletStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type TransactionType = 'BET' | 'WIN' | 'REFUND' | 'JACKPOT' | 'PROMO' | 'TIP' | 'DEPOSIT' | 'WITHDRAW';
export type TransactionStatus = 'COMPLETED' | 'FAILED' | 'REJECTED' | 'ROLLED_BACK';
export type RoundStatus = 'OPEN' | 'SETTLED' | 'CANCELLED' | 'REFUNDED';

export interface UserEntity {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  operator_id: string;
  currency: string;
  status: UserStatus;
  country_code?: string;
  role?: 'ADMIN' | 'PLAYER' | 'VIP' | 'OPERATOR';
  isAdmin?: boolean;
  vipTier?: string;
  vipPoints?: number;
  created_at: string;
  updated_at: string;
}

export interface WalletEntity {
  id: string;
  user_id: string;
  currency: string;
  real_balance: number;
  bonus_balance: number;
  locked_balance: number;
  turnover_ratio?: number; // Configurable bonus conversion rollover multiplier (e.g. 10x)
  version: number;
  status: WalletStatus;
  created_at: string;
  updated_at: string;
}

export interface TransactionEntity {
  id: string;
  provider_id: string;
  transaction_id: string;
  reference_transaction_id?: string | null;
  user_id: string;
  wallet_id: string;
  round_id?: string | null;
  provider_round_id?: string | null;
  game_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  before_balance: number;
  after_balance: number;
  status: TransactionStatus;
  error_code?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface GameRoundEntity {
  id: string;
  provider_id: string;
  provider_round_id: string;
  user_id: string;
  game_id: string;
  currency: string;
  status: RoundStatus;
  total_bet: number;
  total_win: number;
  net_payout: number;
  created_at: string;
  closed_at?: string | null;
}

export interface GameProviderEntity {
  id: string;
  name: string;
  secret_key: string;
  is_active: boolean;
  allowed_ips: string[];
  webhook_timeout_ms: number;
}

export type PaymentMethodType = 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY' | 'USDT' | 'BANK_TRANSFER';
export type PaymentRequestType = 'DEPOSIT' | 'WITHDRAWAL';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface PaymentRequestEntity {
  id: string;
  user_id: string;
  wallet_id: string;
  type: PaymentRequestType;
  method: PaymentMethodType;
  amount: number;
  currency: string;
  sender_number?: string;
  receiver_number?: string;
  trx_id: string;
  status: PaymentStatus;
  admin_note?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type VIPTier = 'BRONZE' | 'SILVER' | 'GOLD_VIP' | 'PLATINUM_VIP' | 'DIAMOND_VIP';

export interface UserVIPProfile {
  tier: VIPTier;
  tier_name: string;
  badge_color: string;
  cashback_rate: number;
  daily_deposit_limit: number;
  daily_withdrawal_limit: number;
  wagering_turnover_target: number;
  wagering_turnover_current: number;
}

export interface WageringRequirementEntity {
  id: string;
  user_id: string;
  promo_name: string;
  bonus_amount_granted: number;
  required_multiplier: number; // e.g. 10x, 15x
  target_turnover_amount: number;
  completed_turnover_amount: number;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  expires_at: string;
  created_at: string;
  completed_at?: string | null;
}

export interface WageringProgressDTO {
  is_eligible: boolean;
  total_bonus_balance: number;
  active_target_turnover: number;
  completed_turnover: number;
  progress_percent: number;
  remaining_turnover: number;
  convertible_amount: number;
  requirements: WageringRequirementEntity[];
}


