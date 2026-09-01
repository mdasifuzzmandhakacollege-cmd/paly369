/**
 * @file types.ts
 * @description Contract and Data Definitions for PLAY369 Task 6.2A: Sandbox-Only Payment Contract Harness.
 * 
 * [STRICT SAFETY INVARIANTS]:
 * 1. Non-Monetary Sandbox Adapter: NO real-money settlement, NO live payment API calls, NO production credentials.
 * 2. Exact Scale-4 Decimal Strings: Monetary amounts are strictly validated and handled as exact decimal strings (e.g. "100.0000").
 *    No Number(), parseFloat(), or toFixed() conversions are permitted.
 * 3. Settlement Isolation: Even mock COMPLETED verifications MUST NOT credit WalletLedgerService.
 *    Returns code 'SANDBOX_VERIFIED_NO_SETTLEMENT' with settlementBlocked: true.
 * 4. Production Fail-Close: If process.env.NODE_ENV === 'production', all operations refuse execution and return
 *    code 'SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION'.
 * 5. Browser Redirect Independence: Browser redirect/query parameters are NEVER treated as payment authority.
 *    A redirect is strictly informational UI state.
 */

export type SandboxVerificationStatus =
  | 'COMPLETED'
  | 'PENDING'
  | 'ERROR'
  | 'SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION';

export interface SandboxCreatePaymentRequest {
  customerName: string;
  customerEmail: string;
  amount: string; // Exact decimal string (e.g. "100.0000")
  successCallbackUrl: string;
  cancelCallbackUrl: string;
  metadata?: Record<string, any>;
}

export interface SandboxCreatePaymentResponse {
  status: 'CREATED' | 'FAILED' | 'SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION';
  message: string;
  paymentUrl?: string;
  transactionId?: string;
  amount?: string;
  isSandbox: true;
  metadata?: Record<string, any>;
}

export interface SandboxVerifyRequest {
  transactionId: string;
  expectedAmount?: string; // Optional exact decimal string to assert amount parity
}

export interface SandboxVerifyResponse {
  status: SandboxVerificationStatus;
  code:
    | 'SANDBOX_VERIFIED_NO_SETTLEMENT'
    | 'SANDBOX_PENDING'
    | 'SANDBOX_ERROR'
    | 'AMOUNT_MISMATCH'
    | 'FIXTURE_NOT_FOUND'
    | 'SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION'
    | 'VALIDATION_ERROR';
  customerName: string;
  customerEmail: string;
  amount: string; // Exact decimal string
  transactionId: string;
  metadata: Record<string, any>;
  isSandbox: true;
  settlementBlocked: true; // Hard invariant: real wallet settlement is permanently blocked
  verificationCount?: number;
  message?: string;
}

export interface SandboxPaymentFixture {
  transactionId: string;
  customerName: string;
  customerEmail: string;
  amount: string; // Exact scale-4 decimal string
  status: 'COMPLETED' | 'PENDING' | 'ERROR';
  code?: string;
  message?: string;
  metadata?: Record<string, any>;
}

export interface SandboxRedirectAnalysis {
  isAuthoritative: false;
  status: 'INFORMATIONAL_ONLY';
  advisoryMessage: string;
  rawParams: Record<string, any>;
}
