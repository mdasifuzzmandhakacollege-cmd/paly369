/**
 * @file sandboxPaymentController.ts
 * @description Controller for PLAY369 Task 6.2B: Authenticated Sandbox Payment API Flow.
 * 
 * [SAFETY INVARIANTS]:
 * 1. NO Live Payment Network Calls (StarPay or other external providers).
 * 2. NO Production Credentials or Real API Keys.
 * 3. NO Balance Mutation: Zero credit, debit, or real-money settlement.
 * 4. Production Fail-Close: If NODE_ENV === 'production', return 404 SANDBOX_ROUTE_DISABLED.
 * 5. Authenticated Only: Enforces Firebase auth identity via resolveAuthPaymentUser().
 * 6. Exact Scale-4 Decimal Money: Strictly validates amounts via validatePaymentAmount(). Rejects JS numbers.
 * 7. Server Owns Callbacks: Ignores client-provided callback URLs to prevent open redirects.
 * 8. Audit-Safe Logging: Logs user ID, sandbox txId, status, and timestamp without secrets.
 */

import { Request, Response } from 'express';
import { SandboxPaymentAdapter, sandboxPaymentAdapter as defaultSandboxAdapter } from '../sandbox';
import { resolveAuthPaymentUser, PaymentAuthError } from '../utils/paymentAuth';
import { validatePaymentAmount, ParsedPaymentAmount } from '../utils/paymentAmount';

export class SandboxPaymentController {
  private adapter: SandboxPaymentAdapter;

  constructor(adapter: SandboxPaymentAdapter = defaultSandboxAdapter) {
    this.adapter = adapter;
  }

  /**
   * Allows injecting a custom/mock SandboxPaymentAdapter instance for testing.
   */
  public setSandboxAdapter(adapter: SandboxPaymentAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Helper to verify if environment is production.
   */
  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Helper to extract standard error code from validatePaymentAmount error
   */
  private extractAmountErrorCode(err: any): string {
    if (err?.message?.includes('UNSAFE_NUMERIC_MONEY_INPUT')) {
      return 'UNSAFE_NUMERIC_MONEY_INPUT';
    }
    if (err?.message?.includes('Over-precision')) {
      return 'OVER_PRECISION_AMOUNT';
    }
    return 'INVALID_PAYMENT_AMOUNT_FORMAT';
  }

  /**
   * POST /api/sandbox/payment/create
   * Accepts: customerName, customerEmail, amount (exact string), metadata
   * Server strictly owns the sandbox success/cancel callback URLs.
   */
  public async createPayment(req: Request, res: Response): Promise<void> {
    // 1. Explicit production fail-close
    if (this.isProduction()) {
      res.status(404).json({
        success: false,
        error: 'Sandbox routes are disabled in production',
        code: 'SANDBOX_ROUTE_DISABLED'
      });
      return;
    }

    // 2. Authoritative Firebase Authentication verification
    let authUser: { id: number; uid: string; username: string };
    try {
      authUser = await resolveAuthPaymentUser(req, req.body?.userId);
    } catch (authErr: any) {
      const statusCode = authErr instanceof PaymentAuthError ? authErr.statusCode : 401;
      const code = authErr instanceof PaymentAuthError ? authErr.code : 'UNAUTHENTICATED';
      res.status(statusCode).json({
        success: false,
        error: authErr.message || 'Authentication required for sandbox payment flow',
        code
      });
      return;
    }

    const { customerName, customerEmail, amount, metadata } = req.body || {};

    // 3. Exact scale-4 decimal string amount validation (rejection of JS numbers)
    let parsedAmount: ParsedPaymentAmount;
    try {
      if (amount === undefined || amount === null || amount === '') {
        res.status(400).json({
          success: false,
          error: 'Amount is required and must be an exact decimal string',
          code: 'INVALID_PAYMENT_AMOUNT_FORMAT'
        });
        return;
      }
      parsedAmount = validatePaymentAmount(amount);
    } catch (amountErr: any) {
      const code = this.extractAmountErrorCode(amountErr);
      res.status(400).json({
        success: false,
        error: amountErr.message || 'Invalid payment amount',
        code
      });
      return;
    }

    // 4. Validate customer details
    if (!customerName || typeof customerName !== 'string' || customerName.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'customerName is required and must be a non-empty string',
        code: 'INVALID_CUSTOMER_DETAILS'
      });
      return;
    }

    if (!customerEmail || typeof customerEmail !== 'string' || !customerEmail.includes('@')) {
      res.status(400).json({
        success: false,
        error: 'customerEmail is required and must be a valid email address',
        code: 'INVALID_CUSTOMER_DETAILS'
      });
      return;
    }

    // 5. Server owns the sandbox success/cancel callback URLs (never trust client)
    const successCallbackUrl = 'https://sandbox.gameplay365.local/sandbox/payment/success';
    const cancelCallbackUrl = 'https://sandbox.gameplay365.local/sandbox/payment/cancel';

    try {
      const result = await this.adapter.createPayment({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        amount: parsedAmount.decimalString,
        successCallbackUrl,
        cancelCallbackUrl,
        metadata: {
          ...(typeof metadata === 'object' && metadata !== null ? metadata : {}),
          authenticatedUserId: authUser.id,
          authenticatedUid: authUser.uid
        }
      });

      // 10. Audit-safe sandbox logging (no tokens or secrets)
      const timestamp = new Date().toISOString();
      console.log(
        `[SandboxPayment] [${timestamp}] User: ${authUser.id} created transaction: ${result.transactionId}, status: ${result.status}, amount: ${result.amount}`
      );

      res.status(201).json({
        success: true,
        status: result.status,
        paymentUrl: result.paymentUrl,
        transactionId: result.transactionId,
        amount: result.amount,
        isSandbox: true,
        metadata: result.metadata
      });
    } catch (err: any) {
      console.error('[SandboxPayment createPayment error]:', err?.message || err);
      res.status(400).json({
        success: false,
        error: err.message || 'Failed to create sandbox payment',
        code: 'SANDBOX_CREATION_FAILED',
        isSandbox: true
      });
    }
  }

  /**
   * POST /api/sandbox/payment/verify
   * Accepts: transactionId, expectedAmount (optional)
   * Returns sandbox fixture state only.
   * COMPLETED returns code: SANDBOX_VERIFIED_NO_SETTLEMENT and settlementBlocked: true.
   * Zero real-money settlement.
   */
  public async verifyPayment(req: Request, res: Response): Promise<void> {
    // 1. Explicit production fail-close
    if (this.isProduction()) {
      res.status(404).json({
        success: false,
        error: 'Sandbox routes are disabled in production',
        code: 'SANDBOX_ROUTE_DISABLED'
      });
      return;
    }

    // 2. Authoritative Firebase Authentication verification
    let authUser: { id: number; uid: string; username: string };
    try {
      authUser = await resolveAuthPaymentUser(req, req.body?.userId);
    } catch (authErr: any) {
      const statusCode = authErr instanceof PaymentAuthError ? authErr.statusCode : 401;
      const code = authErr instanceof PaymentAuthError ? authErr.code : 'UNAUTHENTICATED';
      res.status(statusCode).json({
        success: false,
        error: authErr.message || 'Authentication required for sandbox payment verification',
        code
      });
      return;
    }

    const { transactionId, expectedAmount } = req.body || {};

    if (!transactionId || typeof transactionId !== 'string' || transactionId.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'transactionId is required and must be a non-empty string',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Optional expectedAmount validation
    let parsedExpectedAmount: ParsedPaymentAmount | undefined;
    if (expectedAmount !== undefined && expectedAmount !== null && expectedAmount !== '') {
      try {
        parsedExpectedAmount = validatePaymentAmount(expectedAmount);
      } catch (amountErr: any) {
        const code = this.extractAmountErrorCode(amountErr);
        res.status(400).json({
          success: false,
          error: amountErr.message || 'Invalid expectedAmount format',
          code
        });
        return;
      }
    }

    try {
      const result = await this.adapter.verifyPayment({
        transactionId: transactionId.trim(),
        expectedAmount: parsedExpectedAmount?.decimalString
      });

      // 10. Audit-safe sandbox logging
      const timestamp = new Date().toISOString();
      console.log(
        `[SandboxPayment] [${timestamp}] User: ${authUser.id} verified transaction: ${result.transactionId}, status: ${result.status}, code: ${result.code}`
      );

      if (result.code === 'AMOUNT_MISMATCH') {
        res.status(400).json({
          success: false,
          status: 'ERROR',
          code: 'AMOUNT_MISMATCH',
          error: result.message || 'Amount mismatch detected in sandbox verification',
          amount: result.amount,
          transactionId: result.transactionId,
          isSandbox: true,
          settlementBlocked: true
        });
        return;
      }

      if (result.code === 'FIXTURE_NOT_FOUND') {
        res.status(404).json({
          success: false,
          status: 'ERROR',
          code: 'FIXTURE_NOT_FOUND',
          error: result.message || `Sandbox transaction fixture not found for ID: ${transactionId}`,
          isSandbox: true,
          settlementBlocked: true
        });
        return;
      }

      if (result.status === 'ERROR') {
        res.status(400).json({
          success: false,
          status: 'ERROR',
          code: result.code || 'SANDBOX_ERROR',
          customerName: result.customerName,
          customerEmail: result.customerEmail,
          amount: result.amount,
          transactionId: result.transactionId,
          metadata: result.metadata,
          isSandbox: true,
          settlementBlocked: true,
          message: result.message
        });
        return;
      }

      // PENDING or COMPLETED
      res.status(200).json({
        success: true,
        status: result.status,
        code: result.code,
        customerName: result.customerName,
        customerEmail: result.customerEmail,
        amount: result.amount,
        transactionId: result.transactionId,
        metadata: result.metadata,
        isSandbox: true,
        settlementBlocked: true,
        verificationCount: result.verificationCount,
        message: result.message
      });
    } catch (err: any) {
      console.error('[SandboxPayment verifyPayment error]:', err?.message || err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to verify sandbox payment',
        code: 'SANDBOX_VERIFICATION_FAILED',
        isSandbox: true,
        settlementBlocked: true
      });
    }
  }
}

export const sandboxPaymentController = new SandboxPaymentController();
