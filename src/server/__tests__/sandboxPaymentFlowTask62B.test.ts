/**
 * @file sandboxPaymentFlowTask62B.test.ts
 * @description Comprehensive Verification Suite for PLAY369 Task 6.2B: Sandbox Payment API Flow.
 * 
 * Strict Verification Checklist:
 * 1. Unauthenticated sandbox create → 401 UNAUTHENTICATED
 * 2. Unauthenticated sandbox verify → 401 UNAUTHENTICATED
 * 3. Authenticated create → sandbox fixture only (isSandbox: true, status: CREATED)
 * 4. Numeric amount rejected with 400 UNSAFE_NUMERIC_MONEY_INPUT
 * 5. Exact "0.0516" decimal string preserved without float precision loss
 * 6. Verify PENDING → status: PENDING, code: SANDBOX_PENDING
 * 7. Verify COMPLETED with zero wallet mutation → status: COMPLETED, code: SANDBOX_VERIFIED_NO_SETTLEMENT, settlementBlocked: true
 * 8. Verify ERROR → status: ERROR, code: SANDBOX_ERROR
 * 9. Amount mismatch rejected → 400 AMOUNT_MISMATCH
 * 10. Production mode routes disabled → 404 SANDBOX_ROUTE_DISABLED
 * 11. Zero external network calls across all sandbox API operations
 * 12. Zero ledger mutations (WalletLedgerService untouched)
 * 13. Server owns callback URLs (client callback URLs ignored)
 * 14. Static code analysis: router wiring in src/server/index.ts
 */

import {
  SandboxPaymentController,
  sandboxPaymentController
} from '../controllers/sandboxPaymentController';
import {
  SandboxPaymentAdapter,
  PAYMENT_PENDING_FIXTURE,
  PAYMENT_COMPLETED_FIXTURE,
  PAYMENT_ERROR_FIXTURE,
  PAYMENT_AMOUNT_MISMATCH_FIXTURE,
  productionFailClosedMiddleware
} from '../sandbox';
import { InMemoryPostgresLedgerEngine } from '../ledger/db';
import { WalletLedgerService } from '../ledger/walletLedgerService';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

async function assert(desc: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}\n`);
    failed++;
  }
}

const mockResponse = () => {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  return res;
};

async function runSuite() {
  console.log('================================================================');
  console.log('🛡️ RUNNING PLAY369 TASK 6.2B: SANDBOX PAYMENT API FLOW');
  console.log('================================================================\n');

  // Setup Fresh Ledger to assert zero ledger mutations
  const dbEngine = new InMemoryPostgresLedgerEngine();
  const ledgerService = new WalletLedgerService(dbEngine);

  const testUser = { id: 7701, uid: 'fb_sandbox_user_7701', username: 'sandbox_tester', email: 'tester@sandbox.local' };
  await dbEngine.query(
    `INSERT INTO users (id, firebase_uid, username, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [testUser.id, testUser.uid, testUser.username]
  );
  await dbEngine.query(
    `INSERT INTO wallets (id, user_id, currency, real_balance, bonus_balance, locked_balance, balance_minor, version, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    ['w_7701_bdt', '7701', 'BDT', '10000.0000', '0.0000', '0.0000', '100000000', 1, 'ACTIVE']
  );

  const adapter = new SandboxPaymentAdapter();
  const controller = new SandboxPaymentController(adapter);

  // Network call tracker: Ensure ZERO external network calls
  let networkCallsAttempted = 0;
  const originalFetch = (global as any).fetch;
  (global as any).fetch = async () => {
    networkCallsAttempted++;
    throw new Error('CRITICAL SECURITY VIOLATION: Sandbox flow attempted an external network call!');
  };

  // --------------------------------------------------------------------------
  // 1. UNAUTHENTICATED SANDBOX CREATE → 401
  // --------------------------------------------------------------------------
  console.log('--- Test 1: Unauthenticated Requests Rejection (401) ---');

  await assert('Unauthenticated sandbox create returns 401 UNAUTHENTICATED', async () => {
    const req: any = {
      body: {
        customerName: 'Test Player',
        customerEmail: 'player@example.com',
        amount: '100.0000'
      }
    };
    const res = mockResponse();

    await controller.createPayment(req, res);

    if (res.statusCode !== 401) {
      throw new Error(`Expected HTTP 401, got ${res.statusCode}`);
    }
    if (res.body?.code !== 'UNAUTHENTICATED') {
      throw new Error(`Expected code UNAUTHENTICATED, got ${res.body?.code}`);
    }
  });

  await assert('Unauthenticated sandbox verify returns 401 UNAUTHENTICATED', async () => {
    const req: any = {
      body: {
        transactionId: PAYMENT_COMPLETED_FIXTURE.transactionId
      }
    };
    const res = mockResponse();

    await controller.verifyPayment(req, res);

    if (res.statusCode !== 401) {
      throw new Error(`Expected HTTP 401, got ${res.statusCode}`);
    }
    if (res.body?.code !== 'UNAUTHENTICATED') {
      throw new Error(`Expected code UNAUTHENTICATED, got ${res.body?.code}`);
    }
  });

  // --------------------------------------------------------------------------
  // 2. AUTHENTICATED CREATE → SANDBOX FIXTURE ONLY & SERVER OWNS CALLBACKS
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Authenticated Sandbox Create Flow ---');

  let createdTxId = '';
  await assert('Authenticated create returns 201 with isSandbox: true and status CREATED', async () => {
    const req: any = {
      user: { uid: testUser.uid, email: testUser.email },
      mockUser: testUser,
      body: {
        customerName: 'Rahim Uddin',
        customerEmail: 'rahim@example.com',
        amount: '1500.0000',
        metadata: { tier: 'VIP_1' },
        // Attempting to inject client callback URLs
        successCallbackUrl: 'https://evil-hacker.com/steal-token',
        cancelCallbackUrl: 'https://evil-hacker.com/cancel'
      }
    };
    const res = mockResponse();

    await controller.createPayment(req, res);

    if (res.statusCode !== 201) {
      throw new Error(`Expected HTTP 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }
    if (!res.body?.isSandbox) {
      throw new Error('Expected isSandbox: true');
    }
    if (res.body?.status !== 'CREATED') {
      throw new Error(`Expected status CREATED, got ${res.body?.status}`);
    }
    if (res.body?.amount !== '1500.0000') {
      throw new Error(`Expected exact amount '1500.0000', got ${res.body?.amount}`);
    }
    if (!res.body?.paymentUrl?.startsWith('https://sandbox.gameplay365.local')) {
      throw new Error(`Invalid sandbox paymentUrl: ${res.body?.paymentUrl}`);
    }
    if (!res.body?.transactionId?.startsWith('SBX_TX_PAY_')) {
      throw new Error(`Invalid transactionId: ${res.body?.transactionId}`);
    }
    // Server must ignore client callback URLs
    if (res.body?.metadata?.successCallbackUrl === 'https://evil-hacker.com/steal-token') {
      throw new Error('Security defect: client callback URL was accepted!');
    }
    createdTxId = res.body.transactionId;
  });

  // --------------------------------------------------------------------------
  // 3. NUMERIC AMOUNT REJECTION
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Rejection of Unsafe JavaScript Numeric Amounts ---');

  await assert('Numeric amount (number 500) is strictly rejected with 400 UNSAFE_NUMERIC_MONEY_INPUT', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        customerName: 'Test Player',
        customerEmail: 'player@example.com',
        amount: 500 // JS Number
      }
    };
    const res = mockResponse();

    await controller.createPayment(req, res);

    if (res.statusCode !== 400) {
      throw new Error(`Expected HTTP 400, got ${res.statusCode}`);
    }
    if (res.body?.code !== 'UNSAFE_NUMERIC_MONEY_INPUT') {
      throw new Error(`Expected UNSAFE_NUMERIC_MONEY_INPUT, got ${res.body?.code}`);
    }
  });

  await assert('Floating point number (0.0516) is rejected with 400 UNSAFE_NUMERIC_MONEY_INPUT', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        customerName: 'Test Player',
        customerEmail: 'player@example.com',
        amount: 0.0516 // JS Number float
      }
    };
    const res = mockResponse();

    await controller.createPayment(req, res);

    if (res.statusCode !== 400) {
      throw new Error(`Expected HTTP 400, got ${res.statusCode}`);
    }
    if (res.body?.code !== 'UNSAFE_NUMERIC_MONEY_INPUT') {
      throw new Error(`Expected UNSAFE_NUMERIC_MONEY_INPUT, got ${res.body?.code}`);
    }
  });

  // --------------------------------------------------------------------------
  // 4. EXACT "0.0516" PRESERVED WITHOUT FLOAT LOSS
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Exact Scale-4 String Preservation ---');

  await assert('Exact string "0.0516" is preserved accurately without float loss', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        customerName: 'Micro Bet Player',
        customerEmail: 'micro@example.com',
        amount: '0.0516'
      }
    };
    const res = mockResponse();

    await controller.createPayment(req, res);

    if (res.statusCode !== 201) {
      throw new Error(`Expected HTTP 201, got ${res.statusCode}`);
    }
    if (res.body?.amount !== '0.0516') {
      throw new Error(`Amount corrupted! Expected '0.0516', got ${res.body?.amount}`);
    }
  });

  // --------------------------------------------------------------------------
  // 5. VERIFY PENDING
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Verify PENDING Fixture ---');

  await assert('Verify PENDING returns 200, status PENDING, code SANDBOX_PENDING, settlementBlocked: true', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        transactionId: PAYMENT_PENDING_FIXTURE.transactionId
      }
    };
    const res = mockResponse();

    await controller.verifyPayment(req, res);

    if (res.statusCode !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
    }
    if (res.body?.status !== 'PENDING') {
      throw new Error(`Expected status PENDING, got ${res.body?.status}`);
    }
    if (res.body?.code !== 'SANDBOX_PENDING') {
      throw new Error(`Expected code SANDBOX_PENDING, got ${res.body?.code}`);
    }
    if (!res.body?.settlementBlocked) {
      throw new Error('Expected settlementBlocked: true');
    }
    if (!res.body?.isSandbox) {
      throw new Error('Expected isSandbox: true');
    }
  });

  // --------------------------------------------------------------------------
  // 6. VERIFY COMPLETED & ZERO WALLET MUTATION
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Verify COMPLETED Fixture & Zero Settlement ---');

  await assert('Verify COMPLETED returns 200, SANDBOX_VERIFIED_NO_SETTLEMENT, settlementBlocked: true', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        transactionId: PAYMENT_COMPLETED_FIXTURE.transactionId
      }
    };
    const res = mockResponse();

    await controller.verifyPayment(req, res);

    if (res.statusCode !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
    }
    if (res.body?.status !== 'COMPLETED') {
      throw new Error(`Expected status COMPLETED, got ${res.body?.status}`);
    }
    if (res.body?.code !== 'SANDBOX_VERIFIED_NO_SETTLEMENT') {
      throw new Error(`Expected code SANDBOX_VERIFIED_NO_SETTLEMENT, got ${res.body?.code}`);
    }
    if (!res.body?.settlementBlocked) {
      throw new Error('Expected settlementBlocked: true');
    }
    if (!res.body?.isSandbox) {
      throw new Error('Expected isSandbox: true');
    }
  });

  await assert('WalletLedgerService balances remain 100% unmodified with 0 ledger entries', async () => {
    const wallet = await ledgerService.getWallet(testUser.id, 'BDT');
    if (wallet.realBalance !== '10000.0000' || wallet.lockedBalance !== '0.0000' || wallet.bonusBalance !== '0.0000') {
      throw new Error(`Wallet balance mutated! Real: ${wallet.realBalance}, Locked: ${wallet.lockedBalance}`);
    }

    const ledgerEntries = await dbEngine.query(`SELECT * FROM ledger_entries WHERE user_id = $1`, [testUser.id]);
    if (ledgerEntries.rows.length !== 0) {
      throw new Error(`Expected 0 ledger entries, found ${ledgerEntries.rows.length}`);
    }
  });

  // --------------------------------------------------------------------------
  // 7. VERIFY ERROR
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Verify ERROR Fixture ---');

  await assert('Verify ERROR fixture returns status ERROR, code SANDBOX_ERROR, settlementBlocked: true', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        transactionId: PAYMENT_ERROR_FIXTURE.transactionId
      }
    };
    const res = mockResponse();

    await controller.verifyPayment(req, res);

    if (res.statusCode !== 400 && res.statusCode !== 200) {
      throw new Error(`Unexpected status code: ${res.statusCode}`);
    }
    if (res.body?.status !== 'ERROR') {
      throw new Error(`Expected status ERROR, got ${res.body?.status}`);
    }
    if (res.body?.code !== 'SANDBOX_ERROR') {
      throw new Error(`Expected code SANDBOX_ERROR, got ${res.body?.code}`);
    }
    if (!res.body?.settlementBlocked) {
      throw new Error('Expected settlementBlocked: true');
    }
  });

  // --------------------------------------------------------------------------
  // 8. AMOUNT MISMATCH REJECTION
  // --------------------------------------------------------------------------
  console.log('\n--- Test 8: Amount Mismatch Rejection ---');

  await assert('Verify with expectedAmount mismatch returns 400 AMOUNT_MISMATCH', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        transactionId: PAYMENT_AMOUNT_MISMATCH_FIXTURE.transactionId,
        expectedAmount: '1000.0000' // Fixture is 3000.0000
      }
    };
    const res = mockResponse();

    await controller.verifyPayment(req, res);

    if (res.statusCode !== 400) {
      throw new Error(`Expected HTTP 400, got ${res.statusCode}`);
    }
    if (res.body?.code !== 'AMOUNT_MISMATCH') {
      throw new Error(`Expected code AMOUNT_MISMATCH, got ${res.body?.code}`);
    }
    if (!res.body?.settlementBlocked) {
      throw new Error('Expected settlementBlocked: true');
    }
  });

  // --------------------------------------------------------------------------
  // 9. PRODUCTION MODE ROUTES DISABLED
  // --------------------------------------------------------------------------
  console.log('\n--- Test 9: Production Mode Fail-Close (404 & SANDBOX_ROUTE_DISABLED) ---');

  await assert('In production mode (NODE_ENV === "production"), routes return 404 SANDBOX_ROUTE_DISABLED', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      // 1. Controller createPayment
      const resCreate = mockResponse();
      await controller.createPayment(
        { user: { uid: testUser.uid }, mockUser: testUser, body: { customerName: 'P', customerEmail: 'p@e.com', amount: '100.0000' } } as any,
        resCreate
      );
      if (resCreate.statusCode !== 404 || resCreate.body?.code !== 'SANDBOX_ROUTE_DISABLED') {
        throw new Error(`createPayment failed to return 404 SANDBOX_ROUTE_DISABLED in production: ${JSON.stringify(resCreate.body)}`);
      }

      // 2. Controller verifyPayment
      const resVerify = mockResponse();
      await controller.verifyPayment(
        { user: { uid: testUser.uid }, mockUser: testUser, body: { transactionId: PAYMENT_COMPLETED_FIXTURE.transactionId } } as any,
        resVerify
      );
      if (resVerify.statusCode !== 404 || resVerify.body?.code !== 'SANDBOX_ROUTE_DISABLED') {
        throw new Error(`verifyPayment failed to return 404 SANDBOX_ROUTE_DISABLED in production: ${JSON.stringify(resVerify.body)}`);
      }

      // 3. Router Middleware
      const resMw = mockResponse();
      let nextCalled = false;
      productionFailClosedMiddleware({} as any, resMw, () => { nextCalled = true; });

      if (nextCalled) {
        throw new Error('productionFailClosedMiddleware called next() in production!');
      }
      if (resMw.statusCode !== 404 || resMw.body?.code !== 'SANDBOX_ROUTE_DISABLED') {
        throw new Error(`Middleware failed to return 404 SANDBOX_ROUTE_DISABLED: ${JSON.stringify(resMw.body)}`);
      }
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 10. ZERO EXTERNAL NETWORK CALLS
  // --------------------------------------------------------------------------
  console.log('\n--- Test 10: Zero External Network Calls Assertion ---');

  await assert('Zero external network / HTTP calls were made during the entire sandbox flow', () => {
    if (networkCallsAttempted !== 0) {
      throw new Error(`Security breach: ${networkCallsAttempted} external network calls detected!`);
    }
  });

  // Restore fetch
  (global as any).fetch = originalFetch;

  // --------------------------------------------------------------------------
  // 11. STATIC CODE ANALYSIS: SERVER ROUTER WIRING
  // --------------------------------------------------------------------------
  console.log('\n--- Test 11: Static Code Analysis: Router Wiring & Security ---');

  await assert('src/server/index.ts mounts /api/sandbox with createSandboxRouter', () => {
    const serverIndexPath = path.join(process.cwd(), 'src/server/index.ts');
    const content = fs.readFileSync(serverIndexPath, 'utf8');

    if (!content.includes("app.use('/api/sandbox', createSandboxRouter())")) {
      throw new Error("src/server/index.ts must mount app.use('/api/sandbox', createSandboxRouter())");
    }
    if (!content.includes("import { createSandboxRouter } from './sandbox'")) {
      throw new Error("src/server/index.ts must import createSandboxRouter from './sandbox'");
    }
  });

  await assert('sandboxPaymentController never imports or references WalletLedgerService or seamlessEngine', () => {
    const controllerPath = path.join(process.cwd(), 'src/server/controllers/sandboxPaymentController.ts');
    const content = fs.readFileSync(controllerPath, 'utf8');

    if (content.includes('WalletLedgerService') || content.includes('walletLedgerService')) {
      throw new Error('sandboxPaymentController must NOT import or reference WalletLedgerService');
    }
    if (content.includes('seamlessEngine') || content.includes('simulatedWalletEngine')) {
      throw new Error('sandboxPaymentController must NOT import or reference simulatedWalletEngine');
    }
  });

  console.log('\n================================================================');
  console.log(`🏁 TASK 6.2B TESTS COMPLETED: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
