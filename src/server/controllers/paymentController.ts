/**
 * @file paymentController.ts
 * @description Local Cashier Payment Controller for Playall 365.
 * Handles bKash, Nagad, Rocket, Upay deposits and withdrawals with fail-safe server authority.
 */

import { Request, Response } from 'express';
import { db } from '../../db/index';
import { paymentRequests, wallets } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { PaymentMethodType } from '../types/seamless';
import { WageringService } from '../services/wageringService';
import { validatePaymentAmount } from '../utils/paymentAmount';
import { resolveAuthPaymentUser } from '../utils/paymentAuth';
import { WalletLedgerService, walletLedgerService as defaultLedgerService } from '../ledger/walletLedgerService';
import {
  deriveWithdrawalTransactionId,
  InsufficientFundsError,
  WalletFrozenError,
  WalletNotFoundError,
  IdempotencyConflictError,
  LedgerValidationError
} from '../ledger/types';

export class PaymentController {
  private ledgerService: WalletLedgerService = defaultLedgerService;

  public setLedgerService(service: WalletLedgerService): void {
    this.ledgerService = service;
  }

  /**
   * Submit a local deposit request (bKash / Nagad / Rocket)
   * In production, deposit submission creates ONLY a PENDING record.
   * Client-controlled autoApprove and direct wallet balance mutation are strictly disabled.
   * Authenticated via Firebase ID token and resolved to canonical PostgreSQL user.
   */
  async submitDeposit(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        method,
        amount,
        currency = 'BDT',
        senderNumber,
        receiverNumber,
        trxId
      } = req.body;

      // 1. Resolve authoritative authenticated user
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

      if (!method || amount === undefined || amount === null || amount === '' || !trxId) {
        res.status(400).json({ error: 'Missing required deposit parameters' });
        return;
      }

      if (typeof amount !== 'string') {
        res.status(400).json({
          error: 'UNSAFE_NUMERIC_MONEY_INPUT: Monetary amount must be provided as an exact decimal string.'
        });
        return;
      }

      // Exact Scale-4 validation to prevent floating point inaccuracies
      let amountMinor: bigint;
      let normalizedAmount: string;
      try {
        const parsed = validatePaymentAmount(amount);
        amountMinor = parsed.minorUnits;
        normalizedAmount = parsed.decimalString;
      } catch (err: any) {
        res.status(400).json({ error: `Invalid monetary amount: ${err.message}` });
        return;
      }

      if (amountMinor <= 0n) {
        res.status(400).json({ error: 'Deposit amount must be greater than zero' });
        return;
      }

      // 2. Verify or create wallet for authenticated canonical user
      const walletList = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, authUser.id));

      let wallet = walletList.find((w) => w.currency === currency) || walletList[0];

      if (!wallet) {
        const [newWallet] = await db
          .insert(wallets)
          .values({
            userId: authUser.id,
            currency: currency,
            realBalance: '0.0000',
            bonusBalance: '0.0000',
            lockedBalance: '0.0000'
          })
          .returning();
        wallet = newWallet;
      }

      // 3. Insert Payment Request with strictly PENDING status bound to authoritative user
      const [insertedReq] = await db
        .insert(paymentRequests)
        .values({
          userId: authUser.id,
          walletId: wallet.id,
          type: 'DEPOSIT',
          method: method as PaymentMethodType,
          amount: normalizedAmount,
          currency: currency,
          senderNumber: senderNumber ? String(senderNumber) : '',
          receiverNumber: receiverNumber ? String(receiverNumber) : '01900-112233',
          trxId: String(trxId).trim().toUpperCase(),
          status: 'PENDING',
          adminNote: 'Deposit submitted, pending provider callback/manual verification'
        })
        .returning();

      res.status(201).json({
        success: true,
        data: insertedReq,
        message: 'Deposit request submitted for manual/provider verification'
      });
    } catch (err: any) {
      console.error('[PaymentController Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to submit deposit' });
    }
  }

  /**
   * Submit a local withdrawal request (bKash / Nagad / Rocket)
   * Authenticated via Firebase ID token and resolved to canonical PostgreSQL user.
   * PLAY369 Task 6.1.6: Atomic REAL -> LOCKED Reservation via WalletLedgerService.
   */
  async submitWithdrawal(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        method,
        amount,
        currency = 'BDT',
        receiverNumber,
        withdrawalId: requestedWithdrawalId,
        trxId: requestedTrxId,
        idempotencyKey: bodyIdempotencyKey
      } = req.body;

      // 1. Resolve authoritative authenticated user
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

      // 2. Require strict Idempotency-Key HTTP header (PLAY369 Task 6.1.6.1 & 6.1.6.2)
      const rawIdempHeader = (
        (req.headers && req.headers['idempotency-key']) ||
        (typeof req.header === 'function' ? req.header('idempotency-key') : undefined)
      );
      if (!rawIdempHeader || typeof rawIdempHeader !== 'string' || rawIdempHeader.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'Idempotency-Key header is required for withdrawals',
          code: 'IDEMPOTENCY_KEY_REQUIRED'
        });
        return;
      }
      const idempotencyKey = rawIdempHeader.trim();
      if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
        res.status(400).json({
          success: false,
          error: 'Idempotency-Key header must be between 8 and 128 characters',
          code: 'INVALID_IDEMPOTENCY_KEY'
        });
        return;
      }

      if (!method || amount === undefined || amount === null || amount === '' || !receiverNumber) {
        res.status(400).json({ error: 'Missing required withdrawal parameters' });
        return;
      }

      if (typeof amount !== 'string') {
        res.status(400).json({
          error: 'UNSAFE_NUMERIC_MONEY_INPUT: Monetary amount must be provided as an exact decimal string.'
        });
        return;
      }

      let normalizedAmount: string;
      try {
        const parsed = validatePaymentAmount(amount);
        if (parsed.minorUnits <= 0n) {
          res.status(400).json({ error: 'Withdrawal amount must be greater than zero' });
          return;
        }
        normalizedAmount = parsed.decimalString;
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
          code: gate.reason || 'WAGERING_REQUIREMENT_INCOMPLETE',
          activeRequirementsCount: gate.activeRequirementsCount,
          activeRequirements: gate.activeRequirements
        });
        return;
      }

      // 3. Derive deterministic server-authoritative withdrawal transaction ID (PLAY369 Task 6.1.6.2)
      const withdrawalId = deriveWithdrawalTransactionId(authUser.id, idempotencyKey);

      const correlationId = (req.headers['x-correlation-id'] as string) || `corr_wth_${Date.now()}_${authUser.id}`;

      // 4. Perform Atomic Reservation via WalletLedgerService (REAL -> LOCKED)
      try {
        const reservation = await this.ledgerService.reserveWithdrawalFunds({
          withdrawalId,
          userId: authUser.id,
          amount: normalizedAmount,
          currency,
          paymentMethod: method,
          receiverNumber: String(receiverNumber),
          adminNote: 'Queued for Bank/MFS Transfer',
          metadata: {
            method,
            receiverNumber: String(receiverNumber),
            clientReference: (
              typeof requestedWithdrawalId === 'string' && requestedWithdrawalId.trim() !== ''
                ? requestedWithdrawalId.trim()
                : (typeof requestedTrxId === 'string' && requestedTrxId.trim() !== '' ? requestedTrxId.trim() : undefined)
            ),
            senderIp: req.ip,
            userAgent: req.headers['user-agent']
          },
          correlationId,
          idempotencyKey
        });

        res.status(reservation.isIdempotent ? 200 : 201).json({
          success: true,
          data: {
            id: reservation.paymentRequestId,
            userId: authUser.id,
            walletId: reservation.walletId,
            type: 'WITHDRAWAL',
            method: method as PaymentMethodType,
            amount: normalizedAmount,
            currency: currency,
            receiverNumber: String(receiverNumber),
            trxId: reservation.withdrawalId,
            status: reservation.status,
            adminNote: 'Queued for Bank/MFS Transfer',
            beforeRealBalance: reservation.beforeRealBalance,
            afterRealBalance: reservation.afterRealBalance,
            beforeLockedBalance: reservation.beforeLockedBalance,
            afterLockedBalance: reservation.afterLockedBalance,
            isIdempotent: reservation.isIdempotent,
            createdAt: reservation.executedAt
          },
          message: 'Withdrawal request submitted successfully and funds reserved'
        });
      } catch (ledgerErr: any) {
        if (ledgerErr instanceof InsufficientFundsError) {
          res.status(400).json({
            success: false,
            error: 'Insufficient funds for withdrawal',
            code: 'INSUFFICIENT_FUNDS',
            message: ledgerErr.message
          });
          return;
        }

        if (ledgerErr instanceof WalletFrozenError) {
          res.status(403).json({
            success: false,
            error: 'Wallet is frozen or suspended',
            code: 'WALLET_FROZEN',
            message: ledgerErr.message
          });
          return;
        }

        if (ledgerErr instanceof WalletNotFoundError) {
          res.status(404).json({
            success: false,
            error: 'Wallet not found',
            code: 'WALLET_NOT_FOUND',
            message: ledgerErr.message
          });
          return;
        }

        if (ledgerErr instanceof IdempotencyConflictError) {
          res.status(409).json({
            success: false,
            error: 'Idempotency conflict: request parameters do not match original request',
            code: 'IDEMPOTENCY_CONFLICT',
            message: ledgerErr.message,
            details: ledgerErr.details
          });
          return;
        }

        if (ledgerErr instanceof LedgerValidationError) {
          res.status(400).json({
            success: false,
            error: ledgerErr.message,
            code: 'VALIDATION_ERROR'
          });
          return;
        }

        throw ledgerErr;
      }
    } catch (err: any) {
      console.error('[PaymentController Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to submit withdrawal' });
    }
  }

  /**
   * List recent payment requests
   */
  async getRequests(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query;
      let query = db.select().from(paymentRequests).orderBy(desc(paymentRequests.createdAt));

      if (userId) {
        const results = await db
          .select()
          .from(paymentRequests)
          .where(eq(paymentRequests.userId, Number(userId)))
          .orderBy(desc(paymentRequests.createdAt));
        res.json({ success: true, data: results });
        return;
      }

      const results = await query.limit(50);
      res.json({ success: true, data: results });
    } catch (err: any) {
      console.error('[PaymentController Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch requests' });
    }
  }
}

export const paymentController = new PaymentController();
