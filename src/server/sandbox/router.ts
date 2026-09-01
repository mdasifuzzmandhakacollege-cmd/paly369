/**
 * @file router.ts
 * @description Express Router for PLAY369 Task 6.2B: Sandbox-Only Payment Flow Routes.
 * 
 * Routes:
 * - POST /api/sandbox/payment/create
 * - POST /api/sandbox/payment/verify
 * 
 * Invariants:
 * - Completely disabled in production: returns 404 with SANDBOX_ROUTE_DISABLED.
 * - Requires Firebase authentication (requireAuth).
 * - Zero external network calls & zero WalletLedgerService mutations.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { sandboxPaymentController } from '../controllers/sandboxPaymentController';

/**
 * Middleware ensuring sandbox endpoints are completely inaccessible in production.
 */
export function productionFailClosedMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({
      success: false,
      error: 'Sandbox routes are disabled in production',
      code: 'SANDBOX_ROUTE_DISABLED'
    });
    return;
  }
  next();
}

export function createSandboxRouter(): Router {
  const router = Router();

  // 1. Fail-closed in production
  router.use(productionFailClosedMiddleware);

  // 2. Authenticated Sandbox Payment Routes
  router.post('/payment/create', requireAuth, (req: Request, res: Response) => {
    sandboxPaymentController.createPayment(req, res);
  });

  router.post('/payment/verify', requireAuth, (req: Request, res: Response) => {
    sandboxPaymentController.verifyPayment(req, res);
  });

  return router;
}

export const sandboxRouter = createSandboxRouter();
