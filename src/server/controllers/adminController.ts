/**
 * @file adminController.ts
 * @description Express Controller for Authoritative Admin Operations Data Read Layer (PLAY369 Task A1).
 * 
 * Invariants:
 * 1. Protected strictly by `requireAdmin` middleware.
 * 2. Only authoritative PostgreSQL financial data is read and returned.
 * 3. All monetary values are rendered as exact decimal strings (Scale-4).
 * 4. Zero exposure of API keys, HMAC secrets, Firebase credentials, or private tokens.
 * 5. Fails closed with 500/503 on database errors without fabricated fallback numbers.
 */

import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { AdminOpsService, AUTHORITATIVE_SOURCE_TAG } from '../services/adminOpsService.js';

export class AdminController {
  /**
   * GET /api/admin/overview
   * Authoritative aggregate operations & financials read model.
   */
  public async getOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const overview = await AdminOpsService.getOverview();
      res.status(200).json({
        success: true,
        source: AUTHORITATIVE_SOURCE_TAG,
        data: overview,
      });
    } catch (err: any) {
      console.error('[AdminController.getOverview error]:', err);
      res.status(500).json({
        success: false,
        source: AUTHORITATIVE_SOURCE_TAG,
        code: 'DATABASE_READ_ERROR',
        error: err.message || 'Failed to retrieve authoritative admin overview',
      });
    }
  }

  /**
   * GET /api/admin/payments
   * Authoritative list of payment requests with filtering and pagination.
   */
  public async getPayments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        type,
        status,
        method,
        currency,
        userId,
        search
      } = req.query;

      const result = await AdminOpsService.getPayments({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        type: type ? String(type) : undefined,
        status: status ? String(status) : undefined,
        method: method ? String(method) : undefined,
        currency: currency ? String(currency) : undefined,
        userId: userId ? Number(userId) : undefined,
        search: search ? String(search) : undefined,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[AdminController.getPayments error]:', err);
      res.status(500).json({
        success: false,
        source: AUTHORITATIVE_SOURCE_TAG,
        code: 'DATABASE_READ_ERROR',
        error: err.message || 'Failed to retrieve payment requests',
      });
    }
  }

  /**
   * GET /api/admin/wallets
   * Authoritative list of user wallets with real, bonus, locked, and commission balances.
   */
  public async getWallets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        currency,
        status,
        search
      } = req.query;

      const result = await AdminOpsService.getWallets({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        currency: currency ? String(currency) : undefined,
        status: status ? String(status) : undefined,
        search: search ? String(search) : undefined,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[AdminController.getWallets error]:', err);
      res.status(500).json({
        success: false,
        source: AUTHORITATIVE_SOURCE_TAG,
        code: 'DATABASE_READ_ERROR',
        error: err.message || 'Failed to retrieve wallets',
      });
    }
  }

  /**
   * GET /api/admin/wagering
   * Authoritative list of wagering requirements, rollover turnover progress, and withdrawal gates.
   */
  public async getWagering(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        status,
        userId,
        search,
        released
      } = req.query;

      const result = await AdminOpsService.getWagering({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        status: status ? String(status) : undefined,
        userId: userId ? Number(userId) : undefined,
        search: search ? String(search) : undefined,
        released: released !== undefined ? String(released) : undefined,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[AdminController.getWagering error]:', err);
      res.status(500).json({
        success: false,
        source: AUTHORITATIVE_SOURCE_TAG,
        code: 'DATABASE_READ_ERROR',
        error: err.message || 'Failed to retrieve wagering requirements',
      });
    }
  }

  /**
   * GET /api/admin/audit
   * Authoritative immutable financial ledger entries and audit log.
   */
  public async getAudit(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        type,
        balanceTarget,
        userId,
        walletId,
        transactionId,
        status
      } = req.query;

      const result = await AdminOpsService.getAudit({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        type: type ? String(type) : undefined,
        balanceTarget: balanceTarget ? String(balanceTarget) : undefined,
        userId: userId ? Number(userId) : undefined,
        walletId: walletId ? Number(walletId) : undefined,
        transactionId: transactionId ? String(transactionId) : undefined,
        status: status ? String(status) : undefined,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[AdminController.getAudit error]:', err);
      res.status(500).json({
        success: false,
        source: AUTHORITATIVE_SOURCE_TAG,
        code: 'DATABASE_READ_ERROR',
        error: err.message || 'Failed to retrieve audit trail',
      });
    }
  }
}

export const adminController = new AdminController();
