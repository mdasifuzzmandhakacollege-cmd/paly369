/**
 * @file paymentAdapters.ts
 * @description Provider Adapter Layer for PLAY369 Payment Orchestrator.
 * Implements the standard PaymentProviderAdapter interface for bKash, Nagad, Rocket,
 * Bank Transfer, Card Payment, and Manual channels.
 * 
 * [TASK 6.1.3 - ZERO FAKE SUCCESS CONTRACT]:
 * 1. Legacy adapters fail closed: No adapter may return VERIFIED/SUCCESS unless
 *    the result comes from a verified, live provider API/webhook contract.
 * 2. Payouts fail closed with PROVIDER_INTEGRATION_INCOMPLETE (no fake references,
 *    no simulated dispatch, no COMPLETED status).
 * 3. Webhooks fail closed with signatureValid: false and WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED.
 * 4. Monetary amounts preserve raw strings; never use Number(), parseFloat(), or toFixed().
 * 5. Sensitive credentials, PINs, secrets, and auth headers are strictly redacted.
 */

import {
  PaymentProviderId,
  PaymentDestinationAccount,
  DepositIntent,
  PaymentVerificationResult,
  WithdrawalRecord
} from '../server/types/paymentGateway';

export interface PaymentProviderAdapter {
  providerId: PaymentProviderId;
  name: string;

  /**
   * Check if adapter is configured with production secrets
   */
  isConfigured(): boolean;

  /**
   * Verify an incoming deposit by transaction ID against provider records/APIs
   */
  verifyDeposit(params: {
    depositIntent: DepositIntent;
    trxId: string;
    senderNumber?: string;
    destinationAccount: PaymentDestinationAccount;
  }): Promise<PaymentVerificationResult>;

  /**
   * Execute or dispatch an automated payout for a withdrawal
   */
  executePayout(params: {
    withdrawal: WithdrawalRecord;
  }): Promise<{
    success: boolean;
    providerReference: string;
    status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
    code?: string;
    message: string;
    rawResponse?: Record<string, any>;
  }>;

  /**
   * Validate incoming webhook signatures & process payload
   */
  processWebhook(payload: Record<string, any>, signature: string): Promise<{
    signatureValid: boolean;
    code?: string;
    providerTransactionId?: string;
    rawAmount?: string;
    amount?: number;
    currency?: string;
    status?: string;
    rawPayload: Record<string, any>;
  }>;
}

/**
 * Sanitizes provider payloads to strip sensitive secrets, tokens, pins, and auth headers
 * before recording into logs or returning in adapter results.
 */
export function sanitizeProviderPayload(data: any, depth: number = 0): any {
  if (depth > 5) return '[Truncated]';
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  const SENSITIVE_KEYS = [
    /secret/i,
    /password/i,
    /passphrase/i,
    /token/i,
    /auth(orization)?/i,
    /bearer/i,
    /signature/i,
    /pin/i,
    /api[-_]?key/i,
    /private[-_]?key/i,
    /cert/i,
    /cvv/i
  ];

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeProviderPayload(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEYS.some((regex) => regex.test(key));
    if (isSensitive) {
      sanitized[key] = '***REDACTED***';
    } else {
      sanitized[key] = sanitizeProviderPayload(value, depth + 1);
    }
  }
  return sanitized;
}

// ----------------------------------------------------------------------------
// 1. bKash Provider Adapter (Tokenized Checkout & B2C Payouts)
// ----------------------------------------------------------------------------
export class BkashPaymentAdapter implements PaymentProviderAdapter {
  providerId: PaymentProviderId = 'bkash';
  name = 'bKash Automated Gateway';

  isConfigured(): boolean {
    return Boolean(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET);
  }

  async verifyDeposit(params: {
    depositIntent: DepositIntent;
    trxId: string;
    senderNumber?: string;
    destinationAccount: PaymentDestinationAccount;
  }): Promise<PaymentVerificationResult> {
    const cleanTrx = params.trxId.trim().toUpperCase();

    // Fail closed: Provider adapter is not configured in production
    if (!this.isConfigured()) {
      return {
        verified: false,
        status: 'PENDING_INTEGRATION',
        code: 'PROVIDER_NOT_CONFIGURED',
        providerTransactionId: cleanTrx,
        message: 'bKash Automated Gateway adapter is not configured with live credentials. Automated credit is disabled.'
      };
    }

    // Regex check: bKash TrxID is usually 8-12 alphanumeric characters (e.g. BL92A81K09)
    const validFormat = /^[A-Z0-9]{8,12}$/.test(cleanTrx);
    if (!validFormat) {
      return {
        verified: false,
        status: 'FAILED',
        code: 'INVALID_TRX_FORMAT',
        providerTransactionId: cleanTrx,
        message: 'Invalid bKash TrxID format. Expected 8-12 alphanumeric characters.'
      };
    }

    // Fail closed: Live provider verification contract is pending
    return {
      verified: false,
      status: 'PENDING_INTEGRATION',
      code: 'PROVIDER_INTEGRATION_INCOMPLETE',
      providerTransactionId: cleanTrx,
      message: 'bKash API verification requires live provider integration and webhook confirmation.'
    };
  }

  async executePayout(params: { withdrawal: WithdrawalRecord }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        providerReference: '',
        status: 'FAILED' as const,
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'bKash payout adapter is not configured with live credentials. Automated disbursement is disabled.'
      };
    }

    return {
      success: false,
      providerReference: '',
      status: 'FAILED' as const,
      code: 'PROVIDER_INTEGRATION_INCOMPLETE',
      message: 'bKash automated payout integration is incomplete and pending verified provider documentation.'
    };
  }

  async processWebhook(payload: Record<string, any>, _signature: string) {
    const sanitized = sanitizeProviderPayload(payload);
    const rawAmount = payload.amount != null ? String(payload.amount) : undefined;
    return {
      signatureValid: false,
      code: 'WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED',
      providerTransactionId: payload.trxID || payload.paymentID ? String(payload.trxID || payload.paymentID) : undefined,
      rawAmount,
      currency: payload.currency ? String(payload.currency) : 'BDT',
      status: 'PROVIDER_INTEGRATION_INCOMPLETE',
      rawPayload: sanitized
    };
  }
}

// ----------------------------------------------------------------------------
// 2. Nagad Provider Adapter (Direct Merchant & Cash-In)
// ----------------------------------------------------------------------------
export class NagadPaymentAdapter implements PaymentProviderAdapter {
  providerId: PaymentProviderId = 'nagad';
  name = 'Nagad Automated Gateway';

  isConfigured(): boolean {
    return Boolean(process.env.NAGAD_MERCHANT_ID && process.env.NAGAD_PRIVATE_KEY);
  }

  async verifyDeposit(params: {
    depositIntent: DepositIntent;
    trxId: string;
    senderNumber?: string;
    destinationAccount: PaymentDestinationAccount;
  }): Promise<PaymentVerificationResult> {
    const cleanTrx = params.trxId.trim().toUpperCase();

    if (!this.isConfigured()) {
      return {
        verified: false,
        status: 'PENDING_INTEGRATION',
        code: 'PROVIDER_NOT_CONFIGURED',
        providerTransactionId: cleanTrx,
        message: 'Nagad Automated Gateway adapter is not configured with live credentials. Automated credit is disabled.'
      };
    }

    const validFormat = /^[A-Z0-9]{8,12}$/.test(cleanTrx);
    if (!validFormat) {
      return {
        verified: false,
        status: 'FAILED',
        code: 'INVALID_TRX_FORMAT',
        providerTransactionId: cleanTrx,
        message: 'Invalid Nagad TrxID format. Expected 8-12 alphanumeric characters.'
      };
    }

    return {
      verified: false,
      status: 'PENDING_INTEGRATION',
      code: 'PROVIDER_INTEGRATION_INCOMPLETE',
      providerTransactionId: cleanTrx,
      message: 'Nagad verification requires live provider integration and webhook confirmation.'
    };
  }

  async executePayout(params: { withdrawal: WithdrawalRecord }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        providerReference: '',
        status: 'FAILED' as const,
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'Nagad payout adapter is not configured. Request queued for manual processing.'
      };
    }

    return {
      success: false,
      providerReference: '',
      status: 'FAILED' as const,
      code: 'PROVIDER_INTEGRATION_INCOMPLETE',
      message: 'Nagad automated payout integration is incomplete and pending verified provider documentation.'
    };
  }

  async processWebhook(payload: Record<string, any>, _signature: string) {
    const sanitized = sanitizeProviderPayload(payload);
    const rawAmount = payload.amount != null ? String(payload.amount) : undefined;
    return {
      signatureValid: false,
      code: 'WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED',
      providerTransactionId: payload.issuerTrxId ? String(payload.issuerTrxId) : undefined,
      rawAmount,
      currency: payload.currency ? String(payload.currency) : 'BDT',
      status: 'PROVIDER_INTEGRATION_INCOMPLETE',
      rawPayload: sanitized
    };
  }
}

// ----------------------------------------------------------------------------
// 3. Rocket Provider Adapter (DBBL Biller & Mobile Banking)
// ----------------------------------------------------------------------------
export class RocketPaymentAdapter implements PaymentProviderAdapter {
  providerId: PaymentProviderId = 'rocket';
  name = 'Rocket Automated Gateway';

  isConfigured(): boolean {
    return Boolean(process.env.ROCKET_BILLER_ID && process.env.ROCKET_PIN);
  }

  async verifyDeposit(params: {
    depositIntent: DepositIntent;
    trxId: string;
    senderNumber?: string;
    destinationAccount: PaymentDestinationAccount;
  }): Promise<PaymentVerificationResult> {
    const cleanTrx = params.trxId.trim().toUpperCase();

    if (!this.isConfigured()) {
      return {
        verified: false,
        status: 'PENDING_INTEGRATION',
        code: 'PROVIDER_NOT_CONFIGURED',
        providerTransactionId: cleanTrx,
        message: 'Rocket Automated Gateway adapter is not configured with live credentials. Automated credit is disabled.'
      };
    }

    const validFormat = /^[A-Z0-9]{8,12}$/.test(cleanTrx);
    if (!validFormat) {
      return {
        verified: false,
        status: 'FAILED',
        code: 'INVALID_TRX_FORMAT',
        providerTransactionId: cleanTrx,
        message: 'Invalid Rocket TrxID format. Expected 8-12 alphanumeric characters.'
      };
    }

    return {
      verified: false,
      status: 'PENDING_INTEGRATION',
      code: 'PROVIDER_INTEGRATION_INCOMPLETE',
      providerTransactionId: cleanTrx,
      message: 'Rocket verification requires live provider integration and webhook confirmation.'
    };
  }

  async executePayout(params: { withdrawal: WithdrawalRecord }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        providerReference: '',
        status: 'FAILED' as const,
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'Rocket payout adapter is not configured. Request queued for manual processing.'
      };
    }

    return {
      success: false,
      providerReference: '',
      status: 'FAILED' as const,
      code: 'PROVIDER_INTEGRATION_INCOMPLETE',
      message: 'Rocket automated payout integration is incomplete and pending verified provider documentation.'
    };
  }

  async processWebhook(payload: Record<string, any>, _signature: string) {
    const sanitized = sanitizeProviderPayload(payload);
    const rawAmount = payload.amount != null ? String(payload.amount) : undefined;
    return {
      signatureValid: false,
      code: 'WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED',
      providerTransactionId: payload.txId ? String(payload.txId) : undefined,
      rawAmount,
      currency: payload.currency ? String(payload.currency) : 'BDT',
      status: 'PROVIDER_INTEGRATION_INCOMPLETE',
      rawPayload: sanitized
    };
  }
}

// ----------------------------------------------------------------------------
// 4. Bank Transfer Provider Adapter (EFTN / NPSB / Realtime Payout)
// ----------------------------------------------------------------------------
export class BankTransferPaymentAdapter implements PaymentProviderAdapter {
  providerId: PaymentProviderId = 'bank_transfer';
  name = 'Bank Transfer / NPSB Gateway';

  isConfigured(): boolean {
    return Boolean(process.env.BANK_API_GATEWAY_URL && process.env.BANK_CLIENT_CERT);
  }

  async verifyDeposit(params: {
    depositIntent: DepositIntent;
    trxId: string;
    senderNumber?: string;
    destinationAccount: PaymentDestinationAccount;
  }): Promise<PaymentVerificationResult> {
    const cleanTrx = params.trxId.trim().toUpperCase();

    if (!this.isConfigured()) {
      return {
        verified: false,
        status: 'PENDING_INTEGRATION',
        code: 'PROVIDER_NOT_CONFIGURED',
        providerTransactionId: cleanTrx,
        message: 'Bank Core Banking API adapter is not configured with live credentials. Automated credit is disabled.'
      };
    }

    return {
      verified: false,
      status: 'PENDING_INTEGRATION',
      code: 'PROVIDER_INTEGRATION_INCOMPLETE',
      providerTransactionId: cleanTrx,
      message: 'Bank transfer verification requires live banking callback and settlement.'
    };
  }

  async executePayout(params: { withdrawal: WithdrawalRecord }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        providerReference: '',
        status: 'FAILED' as const,
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'Bank transfer payout adapter is not configured. Request queued for manual processing.'
      };
    }

    return {
      success: false,
      providerReference: '',
      status: 'FAILED' as const,
      code: 'PROVIDER_INTEGRATION_INCOMPLETE',
      message: 'Bank transfer automated payout integration is incomplete and pending verified provider documentation.'
    };
  }

  async processWebhook(payload: Record<string, any>, _signature: string) {
    const sanitized = sanitizeProviderPayload(payload);
    const rawAmount = payload.amount != null ? String(payload.amount) : undefined;
    return {
      signatureValid: false,
      code: 'WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED',
      providerTransactionId: payload.swiftOrNpsbRef ? String(payload.swiftOrNpsbRef) : undefined,
      rawAmount,
      currency: payload.currency ? String(payload.currency) : 'BDT',
      status: 'PROVIDER_INTEGRATION_INCOMPLETE',
      rawPayload: sanitized
    };
  }
}

// ----------------------------------------------------------------------------
// 5. Card & USDT Adapters
// ----------------------------------------------------------------------------
export class CardPaymentAdapter implements PaymentProviderAdapter {
  providerId: PaymentProviderId = 'card_payment';
  name = 'Visa / Mastercard 3DS Gateway';

  isConfigured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY || process.env.CARD_MERCHANT_SECRET);
  }

  async verifyDeposit(params: {
    depositIntent: DepositIntent;
    trxId: string;
    destinationAccount: PaymentDestinationAccount;
  }): Promise<PaymentVerificationResult> {
    const cleanTrx = params.trxId.trim().toUpperCase();

    if (!this.isConfigured()) {
      return {
        verified: false,
        status: 'PENDING_INTEGRATION',
        code: 'PROVIDER_NOT_CONFIGURED',
        providerTransactionId: cleanTrx,
        message: 'Card 3DS Gateway adapter is not configured with live credentials. Automated credit is disabled.'
      };
    }

    return {
      verified: false,
      status: 'PENDING_INTEGRATION',
      code: 'PROVIDER_INTEGRATION_INCOMPLETE',
      providerTransactionId: cleanTrx,
      message: 'Card verification requires live gateway callback.'
    };
  }

  async executePayout(params: { withdrawal: WithdrawalRecord }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        providerReference: '',
        status: 'FAILED' as const,
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'Card OCT payout adapter is not configured. Request queued for manual processing.'
      };
    }

    return {
      success: false,
      providerReference: '',
      status: 'FAILED' as const,
      code: 'PROVIDER_INTEGRATION_INCOMPLETE',
      message: 'Card OCT payout adapter integration is incomplete and pending verified provider documentation.'
    };
  }

  async processWebhook(payload: Record<string, any>, _signature?: string) {
    const sanitized = sanitizeProviderPayload(payload);
    const rawAmount = payload.amount != null ? String(payload.amount) : undefined;
    return {
      signatureValid: false,
      code: 'WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED',
      providerTransactionId: payload.chargeId ? String(payload.chargeId) : undefined,
      rawAmount,
      currency: payload.currency ? String(payload.currency) : 'USD',
      status: 'PROVIDER_INTEGRATION_INCOMPLETE',
      rawPayload: sanitized
    };
  }
}
