/**
 * @file sandboxPaymentAdapter.ts
 * @description Implementation of PLAY369 Task 6.2A: Sandbox-Only Payment Contract Harness.
 * 
 * [SAFETY CONTRACT INVARIANTS]:
 * 1. ZERO Live Network Calls: Does not import or invoke http, https, fetch, or axios.
 * 2. ZERO Production Credentials: Does not read, store, or accept production API keys or tokens.
 * 3. ZERO Wallet Settlement: Even mock COMPLETED states return 'SANDBOX_VERIFIED_NO_SETTLEMENT'
 *    with settlementBlocked: true. WalletLedgerService is never invoked.
 * 4. Production Fail-Close: If NODE_ENV === 'production', all operations immediately halt and return
 *    'SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION'.
 * 5. Exact Scale-4 Decimal Strings: Monetary amounts are strictly validated with validatePaymentAmount()
 *    without using Number(), parseFloat(), or toFixed().
 * 6. Browser Redirect Independence: evaluateRedirectCallback() ensures client redirects remain purely
 *    informational and cannot be used as payment authority.
 */

import { validatePaymentAmount, ParsedPaymentAmount } from '../utils/paymentAmount';
import {
  SandboxCreatePaymentRequest,
  SandboxCreatePaymentResponse,
  SandboxPaymentFixture,
  SandboxRedirectAnalysis,
  SandboxVerifyRequest,
  SandboxVerifyResponse
} from './types';
import { getDefaultSandboxFixtures } from './fixtures';

export class SandboxPaymentAdapter {
  private fixtures: Map<string, SandboxPaymentFixture> = new Map();
  private verificationCounts: Map<string, number> = new Map();

  constructor() {
    this.resetFixtures();
  }

  /**
   * Resets fixtures to the standard default test suite.
   */
  public resetFixtures(): void {
    this.fixtures.clear();
    this.verificationCounts.clear();
    const defaults = getDefaultSandboxFixtures();
    for (const f of defaults) {
      this.fixtures.set(f.transactionId, { ...f });
      this.verificationCounts.set(f.transactionId, 0);
    }
  }

  /**
   * Registers a custom deterministic fixture in memory.
   */
  public registerFixture(fixture: SandboxPaymentFixture): void {
    // Validate exact scale-4 amount string
    const parsed = validatePaymentAmount(fixture.amount);
    this.fixtures.set(fixture.transactionId, {
      ...fixture,
      amount: parsed.decimalString
    });
    if (!this.verificationCounts.has(fixture.transactionId)) {
      this.verificationCounts.set(fixture.transactionId, 0);
    }
  }

  /**
   * Updates or transitions the deterministic status of an existing fixture.
   */
  public setFixtureStatus(
    transactionId: string,
    status: 'PENDING' | 'COMPLETED' | 'ERROR',
    code?: string
  ): void {
    const fixture = this.fixtures.get(transactionId);
    if (fixture) {
      fixture.status = status;
      if (code) fixture.code = code;
      this.fixtures.set(transactionId, fixture);
    }
  }

  /**
   * Returns verification count for a transaction ID.
   */
  public getVerificationCount(transactionId: string): number {
    return this.verificationCounts.get(transactionId) || 0;
  }

  /**
   * Helper to check if production fail-close applies.
   */
  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * 1. Create Payment Request & Response
   * Models the documented payment creation contract safely in sandbox mode.
   */
  public async createPayment(
    req: SandboxCreatePaymentRequest
  ): Promise<SandboxCreatePaymentResponse> {
    // 8. Explicit production fail-close
    if (this.isProduction()) {
      return {
        status: 'SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION',
        message: 'Sandbox payment adapter is strictly disabled in production environment',
        isSandbox: true
      };
    }

    if (!req.customerName || typeof req.customerName !== 'string' || req.customerName.trim() === '') {
      throw new Error('Customer name is required and must be a non-empty string');
    }

    if (!req.customerEmail || typeof req.customerEmail !== 'string' || !req.customerEmail.includes('@')) {
      throw new Error('Customer email is required and must be a valid email address');
    }

    if (!req.successCallbackUrl || !req.cancelCallbackUrl) {
      throw new Error('Success and cancel callback URLs are required');
    }

    // 5. Exact scale-4 decimal string validation (No Number, parseFloat, or toFixed)
    let parsedAmount: ParsedPaymentAmount;
    try {
      parsedAmount = validatePaymentAmount(req.amount);
    } catch (err: any) {
      throw new Error(`Invalid payment amount: ${err.message}`);
    }

    // Generate deterministic transaction ID for the session
    const txId = `SBX_TX_PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Auto-register created payment as a pending sandbox fixture
    const fixture: SandboxPaymentFixture = {
      transactionId: txId,
      customerName: req.customerName.trim(),
      customerEmail: req.customerEmail.trim(),
      amount: parsedAmount.decimalString,
      status: 'PENDING',
      code: 'SANDBOX_PENDING',
      message: 'Sandbox payment created and awaiting customer action',
      metadata: {
        ...(req.metadata || {}),
        successCallbackUrl: req.successCallbackUrl,
        cancelCallbackUrl: req.cancelCallbackUrl,
        createdAt: new Date().toISOString()
      }
    };

    this.registerFixture(fixture);

    return {
      status: 'CREATED',
      message: 'Sandbox payment URL generated successfully',
      paymentUrl: `https://sandbox.gameplay365.local/checkout/${txId}`,
      transactionId: txId,
      amount: parsedAmount.decimalString,
      isSandbox: true,
      metadata: fixture.metadata
    };
  }

  /**
   * 2. Verify Payment Request & Response
   * Simulates non-monetary verification of a sandbox transaction.
   * NEVER credits WalletLedgerService. Returns SANDBOX_VERIFIED_NO_SETTLEMENT.
   */
  public async verifyPayment(
    req: SandboxVerifyRequest
  ): Promise<SandboxVerifyResponse> {
    // 8. Explicit production fail-close
    if (this.isProduction()) {
      return {
        status: 'SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION',
        code: 'SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION',
        customerName: '',
        customerEmail: '',
        amount: '0.0000',
        transactionId: req.transactionId || '',
        metadata: {},
        isSandbox: true,
        settlementBlocked: true,
        message: 'Sandbox payment adapter is strictly disabled in production environment'
      };
    }

    if (!req.transactionId || typeof req.transactionId !== 'string' || req.transactionId.trim() === '') {
      return {
        status: 'ERROR',
        code: 'VALIDATION_ERROR',
        customerName: '',
        customerEmail: '',
        amount: '0.0000',
        transactionId: '',
        metadata: {},
        isSandbox: true,
        settlementBlocked: true,
        message: 'Transaction ID is required for verification'
      };
    }

    const txId = req.transactionId.trim();
    const fixture = this.fixtures.get(txId);

    if (!fixture) {
      return {
        status: 'ERROR',
        code: 'FIXTURE_NOT_FOUND',
        customerName: '',
        customerEmail: '',
        amount: '0.0000',
        transactionId: txId,
        metadata: {},
        isSandbox: true,
        settlementBlocked: true,
        message: `Sandbox transaction fixture not found for ID: ${txId}`
      };
    }

    // Increment deterministic duplicate verification counter
    const currentCount = (this.verificationCounts.get(txId) || 0) + 1;
    this.verificationCounts.set(txId, currentCount);

    // Exact scale-4 amount parity check if expectedAmount is supplied
    if (req.expectedAmount !== undefined && req.expectedAmount !== null && req.expectedAmount !== '') {
      let expectedParsed: ParsedPaymentAmount;
      try {
        expectedParsed = validatePaymentAmount(req.expectedAmount);
      } catch (err: any) {
        return {
          status: 'ERROR',
          code: 'AMOUNT_MISMATCH',
          customerName: fixture.customerName,
          customerEmail: fixture.customerEmail,
          amount: fixture.amount,
          transactionId: txId,
          metadata: fixture.metadata || {},
          isSandbox: true,
          settlementBlocked: true,
          verificationCount: currentCount,
          message: `Invalid expectedAmount parameter: ${err.message}`
        };
      }

      if (expectedParsed.decimalString !== fixture.amount) {
        return {
          status: 'ERROR',
          code: 'AMOUNT_MISMATCH',
          customerName: fixture.customerName,
          customerEmail: fixture.customerEmail,
          amount: fixture.amount,
          transactionId: txId,
          metadata: fixture.metadata || {},
          isSandbox: true,
          settlementBlocked: true,
          verificationCount: currentCount,
          message: `Amount mismatch: expected ${expectedParsed.decimalString} BDT but sandbox recorded ${fixture.amount} BDT`
        };
      }
    }

    // 7. Map status and code: Even mock COMPLETED must return SANDBOX_VERIFIED_NO_SETTLEMENT
    const resultCode =
      fixture.status === 'COMPLETED'
        ? 'SANDBOX_VERIFIED_NO_SETTLEMENT'
        : fixture.status === 'PENDING'
        ? 'SANDBOX_PENDING'
        : 'SANDBOX_ERROR';

    return {
      status: fixture.status,
      code: resultCode,
      customerName: fixture.customerName,
      customerEmail: fixture.customerEmail,
      amount: fixture.amount,
      transactionId: fixture.transactionId,
      metadata: fixture.metadata || {},
      isSandbox: true,
      settlementBlocked: true, // Permanent invariant: never triggers real wallet mutations
      verificationCount: currentCount,
      message: fixture.message || `Sandbox verification completed with state: ${fixture.status}`
    };
  }

  /**
   * 4. Browser Redirect Parameter Evaluator
   * Invariant: NEVER treat browser redirect/query parameters as payment authority.
   * A success-screen redirect must remain informational only.
   */
  public evaluateRedirectCallback(queryParams: Record<string, any>): SandboxRedirectAnalysis {
    return {
      isAuthoritative: false,
      status: 'INFORMATIONAL_ONLY',
      advisoryMessage:
        'Browser redirect parameters are strictly informational and carry zero payment authority. ' +
        'Authoritative payment state can only be obtained through explicit backend verifyPayment() against the sandbox adapter.',
      rawParams: { ...queryParams }
    };
  }
}

export const sandboxPaymentAdapter = new SandboxPaymentAdapter();
