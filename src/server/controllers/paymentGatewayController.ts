/**
 * @file paymentGatewayController.ts
 * @description Express API Controller for Gameplay 365 Automated Payment Gateway.
 */

import { Request, Response } from 'express';
import { paymentGatewayEngine } from '../../services/paymentGatewayEngine';
import { PaymentProviderId, PaymentMethod } from '../types/paymentGateway';
import { WageringService } from '../services/wageringService';
import { validatePaymentAmount, ParsedPaymentAmount } from '../utils/paymentAmount';
import { resolveAuthPaymentUser } from '../utils/paymentAuth';

export class PaymentGatewayController {
  /**
   * POST /api/v2/payment/deposit/intent
   * Create a unique deposit intent and assign payment destination from the pool
   */
  async createDepositIntent(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        provider,
        method,
        amount,
        currency = 'BDT',
        idempotencyKey
      } = req.body;

      // 1. Resolve and verify authenticated user ownership
      let authUser;
      try {
        authUser = await resolveAuthPaymentUser(req, userId);
      } catch (authErr: any) {
        res.status(authErr.statusCode || 401).json({
          success: false,
          error: authErr.code || authErr.message || 'Authentication failed',
          code: authErr.code || 'UNAUTHENTICATED',
          message: authErr.message
        });
        return;
      }

      if (!provider || amount === undefined || amount === null || amount === '') {
        res.status(400).json({ error: 'Missing required parameters: provider, amount' });
        return;
      }

      if (typeof amount !== 'string') {
        res.status(400).json({
          error: 'UNSAFE_NUMERIC_MONEY_INPUT: Monetary amount must be provided as an exact decimal string (e.g. "100.0000"). Numeric values are rejected.'
        });
        return;
      }

      let parsedAmount: ParsedPaymentAmount;
      try {
        parsedAmount = validatePaymentAmount(amount);
      } catch (err: any) {
        res.status(400).json({ error: `Invalid monetary amount: ${err.message}` });
        return;
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      const intent = paymentGatewayEngine.createDepositIntent({
        userId: String(authUser.id),
        username: authUser.username || `User_${authUser.id}`,
        provider: provider as PaymentProviderId,
        method: (method || provider.toUpperCase()) as PaymentMethod,
        amount: parsedAmount.decimalString,
        amountMinor: parsedAmount.minorUnits,
        currency: currency as 'BDT' | 'USD',
        idempotencyKey: idempotencyKey || req.headers['idempotency-key'] as string,
        clientIp
      });

      res.status(201).json({
        success: true,
        data: intent,
        message: 'Deposit intent created successfully. Please complete payment within 15 minutes.'
      });
    } catch (err: any) {
      console.error('[PaymentGatewayController.createDepositIntent error]:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  }

  /**
   * POST /api/v2/payment/deposit/verify-trx
   * Submit TrxID and trigger the 8-point Automated Verification & Credit Engine
   */
  async verifyTrxId(req: Request, res: Response): Promise<void> {
    try {
      const { depositId, trxId, senderNumber, userId } = req.body;

      if (!depositId || !trxId) {
        res.status(400).json({ error: 'Missing required parameters: depositId, trxId' });
        return;
      }

      // 1. Resolve and verify authenticated user ownership
      let authUser;
      try {
        authUser = await resolveAuthPaymentUser(req, userId);
      } catch (authErr: any) {
        res.status(authErr.statusCode || 401).json({
          success: false,
          error: authErr.code || authErr.message || 'Authentication failed',
          code: authErr.code || 'UNAUTHENTICATED',
          message: authErr.message
        });
        return;
      }

      // 2. Validate that authenticated player owns this deposit intent
      const existingIntent = paymentGatewayEngine.getDepositIntent(String(depositId));
      if (existingIntent) {
        const isOwner = existingIntent.userId === String(authUser.id) || existingIntent.userId === authUser.uid;
        if (!isOwner) {
          res.status(403).json({
            success: false,
            error: 'ACCOUNT_OWNERSHIP_MISMATCH',
            code: 'ACCOUNT_OWNERSHIP_MISMATCH',
            message: 'Account ownership mismatch: deposit intent does not belong to authenticated user'
          });
          return;
        }
      }

      const result = await paymentGatewayEngine.verifyAndCreditDeposit({
        depositId: String(depositId),
        trxId: String(trxId),
        senderNumber: senderNumber ? String(senderNumber) : undefined
      });

      res.status(200).json({
        success: true,
        data: result.depositIntent,
        status: result.status || result.depositIntent.status,
        code: result.code || 'LEDGER_SETTLEMENT_PENDING',
        newBalance: result.newBalance,
        message: result.message
      });
    } catch (err: any) {
      console.error('[PaymentGatewayController.verifyTrxId error]:', err);
      const isUnconfigured = err.code === 'PROVIDER_NOT_CONFIGURED' || err.code === 'PROVIDER_INTEGRATION_INCOMPLETE' || err.status === 'PENDING_INTEGRATION';
      res.status(isUnconfigured ? 503 : 400).json({
        success: false,
        code: err.code || 'VERIFICATION_FAILED',
        status: err.status || 'FAILED',
        error: err.message || 'Verification failed'
      });
    }
  }

  /**
   * POST /api/v2/payment/withdraw/request
   * Submit withdrawal request with balance reservation and automated payout
   */
  async requestWithdrawal(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        provider,
        method,
        amount,
        currency = 'BDT',
        recipientAccount,
        recipientName,
        idempotencyKey
      } = req.body;

      // 1. Resolve and verify authenticated user ownership
      let authUser;
      try {
        authUser = await resolveAuthPaymentUser(req, userId);
      } catch (authErr: any) {
        res.status(authErr.statusCode || 401).json({
          success: false,
          error: authErr.code || authErr.message || 'Authentication failed',
          code: authErr.code || 'UNAUTHENTICATED',
          message: authErr.message
        });
        return;
      }

      if (!provider || amount === undefined || amount === null || amount === '' || !recipientAccount) {
        res.status(400).json({ error: 'Missing required parameters: provider, amount, recipientAccount' });
        return;
      }

      if (typeof amount !== 'string') {
        res.status(400).json({
          error: 'UNSAFE_NUMERIC_MONEY_INPUT: Monetary amount must be provided as an exact decimal string (e.g. "100.0000"). Numeric values are rejected.'
        });
        return;
      }

      let parsedAmount: ParsedPaymentAmount;
      try {
        parsedAmount = validatePaymentAmount(amount);
      } catch (err: any) {
        res.status(400).json({ error: `Invalid monetary amount: ${err.message}` });
        return;
      }

      // Authoritative Server-Side Wagering Gate Check (PLAY369 Task 5.2) on authenticated user
      const gate = await WageringService.enforceWithdrawalWageringGate({ userId: authUser.id });
      if (!gate.allowed) {
        res.status(403).json({
          success: false,
          error: `Withdrawal blocked: active wagering requirement is not completed (${gate.reason}).`,
          code: 'WAGERING_REQUIREMENT_INCOMPLETE',
          activeRequirementsCount: gate.activeRequirementsCount,
          activeRequirements: gate.activeRequirements
        });
        return;
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const key = idempotencyKey || (req.headers['idempotency-key'] as string) || `WD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const record = await paymentGatewayEngine.requestWithdrawal({
        userId: String(authUser.id),
        username: authUser.username || `User_${authUser.id}`,
        provider: provider as PaymentProviderId,
        method: (method || provider.toUpperCase()) as PaymentMethod,
        amount: parsedAmount.decimalString,
        amountMinor: parsedAmount.minorUnits,
        currency: currency as 'BDT' | 'USD',
        recipientAccount: String(recipientAccount),
        recipientName: recipientName ? String(recipientName) : undefined,
        idempotencyKey: key,
        clientIp
      });

      res.status(201).json({
        success: true,
        data: record,
        message: 'Withdrawal submitted. Balance reserved and payout is being processed.'
      });
    } catch (err: any) {
      console.error('[PaymentGatewayController.requestWithdrawal error]:', err);
      const isUnconfigured = err.code === 'PROVIDER_NOT_CONFIGURED' || err.code === 'PROVIDER_INTEGRATION_INCOMPLETE' || err.status === 'PENDING_INTEGRATION';
      res.status(isUnconfigured ? 503 : 400).json({
        success: false,
        code: err.code || 'WITHDRAWAL_FAILED',
        status: err.status || 'FAILED',
        error: err.message || 'Withdrawal failed'
      });
    }
  }

  /**
   * POST /api/v2/payment/webhook/:provider
   * Provider Webhook listener with signature validation
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const provider = req.params.provider as PaymentProviderId;
      const signature = (req.headers['x-signature'] || req.headers['x-webhook-signature'] || '') as string;
      if (!signature) {
        res.status(401).json({ error: 'Missing required webhook signature header (x-signature)' });
        return;
      }

      const log = await paymentGatewayEngine.handleWebhook(provider, req.body, signature);

      res.status(200).json({
        received: true,
        processed: log.processed,
        eventId: log.eventId
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/v2/payment/destination-pool
   */
  async getDestinationPool(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: paymentGatewayEngine.getDestinationPool()
    });
  }

  /**
   * GET /api/v2/payment/stats
   */
  async getStats(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: paymentGatewayEngine.getStats()
    });
  }
}

export const paymentGatewayController = new PaymentGatewayController();
