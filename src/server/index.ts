/**
 * @file index.ts
 * @description Standalone Production Express Server entrypoint for B2B Seamless Wallet API.
 */

import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validateHmacSignature, AuthenticatedRequest } from './middleware/hmac';
import { PostgresLedgerPool } from './ledger/db';
import { WalletLedgerService } from './ledger/walletLedgerService';
import { SeamlessWalletController } from './controllers/seamlessWalletController';
import { paymentController } from './controllers/paymentController';
import { paymentGatewayController } from './controllers/paymentGatewayController';
import { getAffiliateSummaryHandler, claimCommissionHandler, bindReferralHandler, AffiliateService } from './controllers/affiliateController';
import { getVipDetailsHandler, claimVipBonusHandler, VipService } from './controllers/vipController';
import { getPromotionDetailsHandler, claimCheckInHandler, spinWheelHandler, convertBonusHandler, getWageringStatusHandler, PromotionService } from './controllers/promotionController';
import { WageringService } from './services/wageringService';
import { createProviderGatewayRouter } from './controllers/providerGatewayController';
import { createSandboxRouter } from './sandbox';
import { adminController } from './controllers/adminController';
import { requireAuth, requireAdmin, getAuthoritativeUserRole, AuthRequest } from '../middleware/auth.js';
import { validateRuntimeEnvironmentConfig } from './config/index.js';

dotenv.config();

// Enforce Authoritative System Boundary Startup Validation (Fail-closed on invalid env)
const envValidation = validateRuntimeEnvironmentConfig();
if (process.env.NODE_ENV !== 'test') {
  console.log(`[SystemBoundary Guard] Normalized Runtime Environment: ${envValidation.environment}`);
  console.log(`[SystemBoundary Guard] Configuration Status: DB=${envValidation.sanitizedConfig.databaseConfigured}, Gemini=${envValidation.sanitizedConfig.geminiConfigured}, Sandbox=${envValidation.sanitizedConfig.sandboxEnabled}`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// ----------------------------------------------------------------------------
// 1. Raw Body Middleware for HMAC SHA-256 Signature Verification
// Crucial: Must capture raw byte stream before JSON.parse alters whitespace/keys
// ----------------------------------------------------------------------------
app.use(
  express.json({
    verify: (req: AuthenticatedRequest, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  })
);

// ----------------------------------------------------------------------------
// 2. Production PostgreSQL Connection Pool & Wallet Ledger Service
// Connected to PostgreSQL via process.env.DATABASE_URL
// ----------------------------------------------------------------------------
export const postgresLedgerPool = new PostgresLedgerPool(process.env.DATABASE_URL);
export const walletLedgerService = new WalletLedgerService(postgresLedgerPool);
export const walletController = new SeamlessWalletController(walletLedgerService);

// Inject production PostgreSQL WalletLedgerService into AffiliateService, PromotionService, VipService, WageringService & paymentController
AffiliateService.setLedgerService(walletLedgerService);
PromotionService.setLedgerService(walletLedgerService);
VipService.setLedgerService(walletLedgerService);
WageringService.setLedgerService(walletLedgerService);
paymentController.setLedgerService(walletLedgerService);

// ----------------------------------------------------------------------------
// 3. B2B Seamless Wallet Routes (Protected by HMAC Validation Middleware)
// ----------------------------------------------------------------------------
const seamlessRouter = express.Router();
seamlessRouter.use(validateHmacSignature);

seamlessRouter.post('/balance', walletController.getBalance);
seamlessRouter.post('/bet', walletController.processBet);
seamlessRouter.post('/win', walletController.processWin);
seamlessRouter.post('/refund', walletController.processRefund);

app.use('/api/seamless', seamlessRouter);

// ----------------------------------------------------------------------------
// 5. Automated Payment Gateway & Cashier Routes (bKash, Nagad, Rocket, Bank, USDT)
// ----------------------------------------------------------------------------
const cashierRouter = express.Router();
cashierRouter.post('/deposit', requireAuth, (req, res) => paymentController.submitDeposit(req, res));
cashierRouter.post('/withdraw', requireAuth, (req, res) => paymentController.submitWithdrawal(req, res));
cashierRouter.get('/requests', requireAdmin, (req, res) => paymentController.getRequests(req, res));

app.use('/api/cashier', cashierRouter);

// Automated Payment Orchestrator API v2
const paymentV2Router = express.Router();
paymentV2Router.post('/deposit/intent', requireAuth, (req, res) => paymentGatewayController.createDepositIntent(req, res));
paymentV2Router.post('/deposit/verify-trx', requireAuth, (req, res) => paymentGatewayController.verifyTrxId(req, res));
paymentV2Router.post('/withdraw/request', requireAuth, (req, res) => paymentGatewayController.requestWithdrawal(req, res));
paymentV2Router.post('/webhook/:provider', (req, res) => paymentGatewayController.handleWebhook(req, res));
paymentV2Router.get('/destination-pool', requireAdmin, (req, res) => paymentGatewayController.getDestinationPool(req, res));
paymentV2Router.get('/stats', requireAdmin, (req, res) => paymentGatewayController.getStats(req, res));

app.use('/api/v2/payment', paymentV2Router);

// ----------------------------------------------------------------------------
// 5b. Authenticated Sandbox Payment Flow Routes (PLAY369 Task 6.2B)
// Disabled in production (returns 404 SANDBOX_ROUTE_DISABLED)
// ----------------------------------------------------------------------------
app.use('/api/sandbox', createSandboxRouter());

// ----------------------------------------------------------------------------
// 6. Multi-Tier Affiliate, VIP & Promotion Routes
// ----------------------------------------------------------------------------
const authRouter = express.Router();
authRouter.get('/verify-role', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const authoritativeRole = await getAuthoritativeUserRole(user);
    const isPrivileged = ['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(authoritativeRole);
    res.json({
      success: true,
      uid: user.uid,
      email: user.email || null,
      role: authoritativeRole,
      isPrivileged
    });
  } catch (err: any) {
    console.error('[Auth verify-role error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Role verification failed' });
  }
});
app.use('/api/auth', authRouter);

// ----------------------------------------------------------------------------
// 6b. Privileged Administration & Developer Tool Routes (Protected by requireAdmin)
// ----------------------------------------------------------------------------
const adminRouter = express.Router();
adminRouter.use(requireAdmin);

adminRouter.get('/verify', (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    authorized: true,
    uid: req.user?.uid,
    role: req.userRole
  });
});

adminRouter.get('/stats', (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    authorized: true,
    role: req.userRole,
    timestamp: Date.now(),
    system: {
      status: 'OPERATIONAL',
      uptime: process.uptime(),
      activeNodes: 1
    }
  });
});

adminRouter.get('/requests', (req: AuthRequest, res: Response) => paymentController.getRequests(req, res));
adminRouter.get('/destination-pool', (req: AuthRequest, res: Response) => paymentGatewayController.getDestinationPool(req, res));
adminRouter.get('/payment-stats', (req: AuthRequest, res: Response) => paymentGatewayController.getStats(req, res));

// PLAY369 Task A1: Authoritative Admin Read Model Endpoints
adminRouter.get('/overview', (req: AuthRequest, res: Response) => adminController.getOverview(req, res));
adminRouter.get('/payments', (req: AuthRequest, res: Response) => adminController.getPayments(req, res));
adminRouter.get('/wallets', (req: AuthRequest, res: Response) => adminController.getWallets(req, res));
adminRouter.get('/wagering', (req: AuthRequest, res: Response) => adminController.getWagering(req, res));
adminRouter.get('/audit', (req: AuthRequest, res: Response) => adminController.getAudit(req, res));

app.use('/api/admin', adminRouter);

const affiliateRouter = express.Router();

affiliateRouter.use(requireAuth);
affiliateRouter.get('/summary', getAffiliateSummaryHandler);
affiliateRouter.post('/claim', claimCommissionHandler);
affiliateRouter.post('/bind', bindReferralHandler);
app.use('/api/affiliate', affiliateRouter);

const vipRouter = express.Router();
vipRouter.use(requireAuth);
vipRouter.get('/details', getVipDetailsHandler);
vipRouter.post('/claim-bonus', claimVipBonusHandler);
app.use('/api/vip', vipRouter);

const promoRouter = express.Router();
promoRouter.use(requireAuth);
promoRouter.get('/details', getPromotionDetailsHandler);
promoRouter.get('/wagering-status', getWageringStatusHandler);
promoRouter.post('/checkin', claimCheckInHandler);
promoRouter.post('/spin', spinWheelHandler);
promoRouter.post('/convert-bonus', convertBonusHandler);
app.use('/api/promo', promoRouter);

// ----------------------------------------------------------------------------
// 7. Server-Side Game Provider Gateway Routes
// ----------------------------------------------------------------------------
app.use('/api/gateway/providers', createProviderGatewayRouter());

// ----------------------------------------------------------------------------
// 8. Health Check Endpoint (For Cloud Run / Firebase App Hosting Probes)
// ----------------------------------------------------------------------------
app.get(['/health', '/api/health', '/_health'], (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'HEALTHY',
    uptime: process.uptime(),
    timestamp: Date.now(),
    port: PORT
  });
});

// ----------------------------------------------------------------------------
// 8. Serve Static Frontend Bundle (dist directory) in Production & SPA Fallback
// ----------------------------------------------------------------------------
const candidateDistPaths = [
  path.resolve(process.cwd(), 'dist'),
  path.resolve(__dirname, 'dist'),
  path.resolve(__dirname, '../dist')
];

const resolvedDistPath = candidateDistPaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || candidateDistPaths[0];

// Static asset handler with cache control
app.use(express.static(resolvedDistPath, {
  index: false, // Handle index via SPA fallback for consistent routing
  maxAge: '1h'
}));

// SPA Fallback: Route all non-API GET requests to dist/index.html
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/_health')) {
    return res.status(404).json({ code: 'NOT_FOUND', message: `API route '${req.path}' not found` });
  }

  const indexPath = path.join(resolvedDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.sendFile(indexPath);
  }

  // Graceful fallback if dist/index.html is missing
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>PLAY369 | Seamless Core</title>
    <style>
      body { background: #02180e; color: #e2e8f0; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .loader { text-align: center; }
      .spinner { width: 40px; height: 40px; border: 4px solid #10b98133; border-top-color: #10b981; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div class="loader">
      <div class="spinner"></div>
      <h2>Initializing PLAY369 Application...</h2>
      <p>Frontend assets are readying. Reloading...</p>
    </div>
    <script>setTimeout(() => window.location.reload(), 1500);</script>
  </body>
</html>`);
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Fatal Server Error]:', err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An unhandled server exception occurred',
    timestamp: Date.now()
  });
});

if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true' && process.env.DISABLE_SERVER_LISTEN !== 'true') {
  const server = app.listen(PORT, HOST, () => {
    console.log(`[Seamless Wallet Core] Server successfully listening on http://${HOST}:${PORT} (PORT=${PORT})`);
  });

  process.on('SIGTERM', () => {
    console.log('[Seamless Wallet Core] SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('[Seamless Wallet Core] HTTP server closed');
      process.exit(0);
    });
  });
}

export default app;
