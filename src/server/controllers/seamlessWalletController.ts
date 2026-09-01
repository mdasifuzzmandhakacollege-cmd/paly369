/**
 * @file seamlessWalletController.ts
 * @description Express Controller handling the 4 primary B2B Seamless Wallet endpoints:
 * 1. POST /balance
 * 2. POST /bet
 * 3. POST /win
 * 4. POST /refund
 * 
 * Enforces strict 4-second SLA timeout response limit and delegates to verified WalletLedgerService.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/hmac';
import { WalletLedgerService } from '../ledger/walletLedgerService';
import {
  InsufficientFundsError,
  WalletNotFoundError,
  WalletFrozenError,
  LedgerValidationError,
  SupportedCurrency
} from '../ledger/types';
import { formatMinorUnits } from '../ledger/money';
import {
  BalanceResponse,
  TransactionResponse,
  SeamlessErrorCode
} from '../types/seamless';

// Strict Provider SLA timeout (iGaming providers typically drop connection after 4000ms)
const PROVIDER_SLA_TIMEOUT_MS = 3800; // 3.8s hard guard to guarantee response before 4.0s provider timeout

/**
 * Utility wrapper that executes a promise with strict timeout protection
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject({
        code: SeamlessErrorCode.TIMEOUT_EXCEEDED,
        message: `Wallet transaction processing exceeded ${timeoutMs}ms SLA threshold`,
        status: 504
      });
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export class SeamlessWalletController {
  private ledgerService: WalletLedgerService;

  constructor(ledgerService: WalletLedgerService) {
    this.ledgerService = ledgerService;
  }

  // --------------------------------------------------------------------------
  // 1. POST /balance
  // --------------------------------------------------------------------------
  public getBalance = async (
    req: AuthenticatedRequest,
    res: Response,
    _next?: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      const userId = req.body.user_id;
      const currency = req.body.currency;

      if (!userId || !currency) {
        res.status(400).json({
          code: SeamlessErrorCode.INVALID_REQUEST,
          message: "Missing mandatory fields: 'user_id' and 'currency' are required",
          timestamp: Date.now()
        });
        return;
      }

      const wallet = await withTimeout(
        this.ledgerService.getWallet(userId, currency),
        PROVIDER_SLA_TIMEOUT_MS
      );

      const balanceMajor = Number(formatMinorUnits(wallet.balanceMinor, wallet.currency));

      const response: BalanceResponse = {
        code: SeamlessErrorCode.SUCCESS,
        message: 'Balance retrieved successfully',
        user_id: String(wallet.userId),
        currency: wallet.currency,
        balance: balanceMajor,
        bonus_balance: 0,
        timestamp: Date.now()
      };

      res.setHeader('X-Response-Time-Ms', Date.now() - startTime);
      res.status(200).json(response);
    } catch (err: any) {
      this.handleError(err, res, startTime);
    }
  };

  // --------------------------------------------------------------------------
  // 2. POST /bet
  // --------------------------------------------------------------------------
  public processBet = async (
    req: AuthenticatedRequest,
    res: Response,
    _next?: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      const {
        user_id,
        currency,
        transaction_id,
        round_id,
        game_id,
        amount,
        session_id,
        is_round_end,
        metadata
      } = req.body;

      if (
        !user_id ||
        !currency ||
        !transaction_id ||
        !round_id ||
        amount === undefined ||
        isNaN(Number(amount)) ||
        Number(amount) <= 0
      ) {
        res.status(400).json({
          code: SeamlessErrorCode.INVALID_REQUEST,
          message: 'Missing mandatory fields for bet transaction (user_id, currency, transaction_id, round_id, amount > 0)',
          timestamp: Date.now()
        });
        return;
      }

      const correlationId = (req.headers['x-correlation-id'] as string) || `cid-${Date.now()}`;

      const result = await withTimeout(
        this.ledgerService.executeTransaction({
          userId: user_id,
          currency,
          transactionId: transaction_id,
          type: 'DEBIT',
          amountMinor: amount,
          correlationId,
          auditMetadata: {
            roundId: round_id,
            gameId: game_id,
            sessionId: session_id,
            isRoundEnd: is_round_end,
            providerId: req.providerId,
            ...(typeof metadata === 'object' && metadata !== null ? metadata : {})
          }
        }),
        PROVIDER_SLA_TIMEOUT_MS
      );

      const response: TransactionResponse = {
        code: SeamlessErrorCode.SUCCESS,
        message: 'Bet processed successfully',
        transaction_id: result.transactionId,
        operator_transaction_id: result.ledgerEntryId,
        round_id,
        balance: Number(result.afterBalanceMajor),
        bonus_balance: 0,
        currency: result.currency,
        timestamp: Date.now(),
        is_idempotent: result.isIdempotent
      };

      res.setHeader('X-Response-Time-Ms', Date.now() - startTime);
      res.status(200).json(response);
    } catch (err: any) {
      this.handleError(err, res, startTime);
    }
  };

  // --------------------------------------------------------------------------
  // 3. POST /win
  // --------------------------------------------------------------------------
  public processWin = async (
    req: AuthenticatedRequest,
    res: Response,
    _next?: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      const {
        user_id,
        currency,
        transaction_id,
        reference_transaction_id,
        round_id,
        game_id,
        amount,
        is_round_end,
        jackpot_amount,
        metadata
      } = req.body;

      if (
        !user_id ||
        !currency ||
        !transaction_id ||
        !round_id ||
        amount === undefined ||
        isNaN(Number(amount)) ||
        Number(amount) < 0
      ) {
        res.status(400).json({
          code: SeamlessErrorCode.INVALID_REQUEST,
          message: 'Missing mandatory fields for win payout (user_id, currency, transaction_id, round_id, amount >= 0)',
          timestamp: Date.now()
        });
        return;
      }

      const correlationId = (req.headers['x-correlation-id'] as string) || `cid-${Date.now()}`;

      const result = await withTimeout(
        this.ledgerService.executeTransaction({
          userId: user_id,
          currency,
          transactionId: transaction_id,
          referenceTransactionId: reference_transaction_id,
          type: 'CREDIT',
          amountMinor: amount,
          correlationId,
          auditMetadata: {
            roundId: round_id,
            gameId: game_id,
            jackpotAmount: jackpot_amount,
            isRoundEnd: is_round_end,
            providerId: req.providerId,
            ...(typeof metadata === 'object' && metadata !== null ? metadata : {})
          }
        }),
        PROVIDER_SLA_TIMEOUT_MS
      );

      const response: TransactionResponse = {
        code: SeamlessErrorCode.SUCCESS,
        message: 'Win payout processed successfully',
        transaction_id: result.transactionId,
        operator_transaction_id: result.ledgerEntryId,
        round_id,
        balance: Number(result.afterBalanceMajor),
        bonus_balance: 0,
        currency: result.currency,
        timestamp: Date.now(),
        is_idempotent: result.isIdempotent
      };

      res.setHeader('X-Response-Time-Ms', Date.now() - startTime);
      res.status(200).json(response);
    } catch (err: any) {
      this.handleError(err, res, startTime);
    }
  };

  // --------------------------------------------------------------------------
  // 4. POST /refund
  // --------------------------------------------------------------------------
  public processRefund = async (
    req: AuthenticatedRequest,
    res: Response,
    _next?: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      const {
        user_id,
        currency,
        transaction_id,
        reference_transaction_id,
        round_id,
        game_id,
        amount,
        reason,
        metadata
      } = req.body;

      if (
        !user_id ||
        !currency ||
        !transaction_id ||
        !reference_transaction_id ||
        !round_id ||
        amount === undefined ||
        isNaN(Number(amount)) ||
        Number(amount) <= 0
      ) {
        res.status(400).json({
          code: SeamlessErrorCode.INVALID_REQUEST,
          message: 'Missing mandatory fields for refund (user_id, currency, transaction_id, reference_transaction_id, round_id, amount > 0)',
          timestamp: Date.now()
        });
        return;
      }

      const correlationId = (req.headers['x-correlation-id'] as string) || `cid-${Date.now()}`;

      const result = await withTimeout(
        this.ledgerService.executeTransaction({
          userId: user_id,
          currency,
          transactionId: transaction_id,
          referenceTransactionId: reference_transaction_id,
          type: 'REVERSAL',
          amountMinor: amount,
          correlationId,
          auditMetadata: {
            roundId: round_id,
            gameId: game_id,
            reason: reason || 'PROVIDER_REFUND',
            providerId: req.providerId,
            ...(typeof metadata === 'object' && metadata !== null ? metadata : {})
          }
        }),
        PROVIDER_SLA_TIMEOUT_MS
      );

      const response: TransactionResponse = {
        code: SeamlessErrorCode.SUCCESS,
        message: 'Refund processed successfully',
        transaction_id: result.transactionId,
        operator_transaction_id: result.ledgerEntryId,
        round_id,
        balance: Number(result.afterBalanceMajor),
        bonus_balance: 0,
        currency: result.currency,
        timestamp: Date.now(),
        is_idempotent: result.isIdempotent
      };

      res.setHeader('X-Response-Time-Ms', Date.now() - startTime);
      res.status(200).json(response);
    } catch (err: any) {
      this.handleError(err, res, startTime);
    }
  };

  /**
   * Centralized HTTP error mapper preserving provider-expected status codes and error payloads
   */
  private handleError(err: any, res: Response, startTime: number): void {
    const latency = Date.now() - startTime;
    res.setHeader('X-Response-Time-Ms', latency);

    let statusCode = 500;
    let errorCode: SeamlessErrorCode = SeamlessErrorCode.INTERNAL_ERROR;
    let message = err.message || 'Internal wallet error during transaction execution';
    let balance: number | undefined;
    let currency: string | undefined;

    if (err instanceof InsufficientFundsError) {
      statusCode = 422;
      errorCode = SeamlessErrorCode.INSUFFICIENT_FUNDS;
      currency = err.currency;
      balance = Number(formatMinorUnits(BigInt(err.availableMinor), err.currency as SupportedCurrency));
    } else if (err instanceof WalletNotFoundError) {
      statusCode = 404;
      errorCode = SeamlessErrorCode.USER_NOT_FOUND;
    } else if (err instanceof WalletFrozenError) {
      statusCode = 403;
      errorCode = SeamlessErrorCode.USER_FROZEN;
    } else if (err instanceof LedgerValidationError) {
      statusCode = 400;
      errorCode = SeamlessErrorCode.INVALID_REQUEST;
    } else if (err.code === SeamlessErrorCode.TIMEOUT_EXCEEDED) {
      statusCode = 504;
      errorCode = SeamlessErrorCode.TIMEOUT_EXCEEDED;
    } else if (err.code && Object.values(SeamlessErrorCode).includes(err.code)) {
      errorCode = err.code;
      statusCode = err.status || 400;
    }

    console.error(`[SeamlessController] Error (${errorCode} - ${statusCode}):`, err);

    res.status(statusCode).json({
      code: errorCode,
      message,
      balance,
      currency,
      timestamp: Date.now()
    });
  }
}
