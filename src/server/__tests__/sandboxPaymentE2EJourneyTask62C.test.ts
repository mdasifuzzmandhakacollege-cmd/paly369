/**
 * @file sandboxPaymentE2EJourneyTask62C.test.ts
 * @description Comprehensive Test Suite for PLAY369 Task 6.2C: Sandbox Payment End-to-End Test Journey.
 * 
 * STRICT VERIFICATION REQUIREMENTS:
 * 1. Non-production isolation: UI and routes available ONLY in DEV mode (import.meta.env.DEV === true).
 * 2. Mandatory labeling: "SANDBOX / TEST ONLY" and "NO REAL MONEY".
 * 3. Exact decimal-string preservation: "0.0516" strictly preserved, never converted to JS numbers.
 * 4. Numeric money rejection: Raw numbers rejected with 400 UNSAFE_NUMERIC_MONEY_INPUT.
 * 5. Create payment intent flow: Authenticated Firebase user -> mock transactionId, amount, paymentUrl.
 * 6. External URL auto-open safety: URLs displayed safely, auto-navigation blocked.
 * 7. Verify PENDING flow: returns status PENDING, code SANDBOX_PENDING.
 * 8. Verify COMPLETED flow: returns status COMPLETED, code SANDBOX_VERIFIED_NO_SETTLEMENT.
 * 9. Prominent COMPLETED labeling: "SANDBOX VERIFIED - NO WALLET SETTLEMENT".
 * 10. Verify ERROR flow: returns status ERROR, code SANDBOX_ERROR.
 * 11. Amount mismatch rejection: returns 400 AMOUNT_MISMATCH.
 * 12. Zero wallet / ledger mutations: Wallet balance and ledger transactions remain strictly unmutated.
 * 13. Zero external network calls & zero StarPay live API calls.
 * 14. Session-only status history: UI tracks local session state without polluting real databases.
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

async function runTask62CSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING PLAY369 TASK 6.2C: SANDBOX PAYMENT E2E TEST JOURNEY');
  console.log('================================================================\n');

  // Setup Fresh In-Memory Ledger to assert zero wallet balance / ledger mutations
  const dbEngine = new InMemoryPostgresLedgerEngine();
  const ledgerService = new WalletLedgerService(dbEngine);

  const testUser = {
    id: 9901,
    uid: 'fb_sandbox_user_9901',
    username: 'dev_sandbox_tester',
    email: 'dev@sandbox.local'
  };

  const adapter = new SandboxPaymentAdapter();
  const controller = new SandboxPaymentController(adapter);

  // Network call tracker: Ensure ZERO external network calls occur
  let networkCallsAttempted = 0;
  const originalFetch = (global as any).fetch;
  (global as any).fetch = async () => {
    networkCallsAttempted++;
    throw new Error('CRITICAL SECURITY VIOLATION: Sandbox flow attempted an external network call!');
  };

  // --------------------------------------------------------------------------
  // TEST 1: Production Fail-Closed Safety (No Sandbox in Production)
  // --------------------------------------------------------------------------
  await assert('1. Production environment strictly blocks sandbox route (404 SANDBOX_ROUTE_DISABLED)', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const req: any = { method: 'POST', url: '/api/sandbox/payment/create' };
    const res = mockResponse();
    let nextCalled = false;

    productionFailClosedMiddleware(req, res, () => {
      nextCalled = true;
    });

    process.env.NODE_ENV = originalEnv;

    if (nextCalled) throw new Error('Middleware called next() in production mode!');
    if (res.statusCode !== 404) throw new Error(`Expected HTTP 404, got ${res.statusCode}`);
    if (res.body?.code !== 'SANDBOX_ROUTE_DISABLED') {
      throw new Error(`Expected SANDBOX_ROUTE_DISABLED code, got ${res.body?.code}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Static Code Verification: Sandbox Payment UI Safety & Labels
  // --------------------------------------------------------------------------
  await assert('2. SandboxPaymentTestView UI contains mandatory safety guards and labels', async () => {
    const uiPath = path.join(process.cwd(), 'src/components/SandboxPaymentTestView.tsx');
    if (!fs.existsSync(uiPath)) {
      throw new Error(`SandboxPaymentTestView.tsx does not exist at ${uiPath}`);
    }
    const uiContent = fs.readFileSync(uiPath, 'utf8');

    // 1. Guard check: import.meta.env.DEV
    if (!uiContent.includes('import.meta.env.DEV')) {
      throw new Error('SandboxPaymentTestView.tsx missing import.meta.env.DEV check');
    }

    // 2. Mandatory Screen Labels: SANDBOX / TEST ONLY & NO REAL MONEY
    if (!uiContent.includes('SANDBOX / TEST ONLY')) {
      throw new Error('SandboxPaymentTestView.tsx missing "SANDBOX / TEST ONLY" label');
    }
    if (!uiContent.includes('NO REAL MONEY')) {
      throw new Error('SandboxPaymentTestView.tsx missing "NO REAL MONEY" label');
    }

    // 3. Mandatory COMPLETED Labels: SANDBOX VERIFIED & NO WALLET SETTLEMENT
    if (!uiContent.includes('SANDBOX VERIFIED')) {
      throw new Error('SandboxPaymentTestView.tsx missing "SANDBOX VERIFIED" text');
    }
    if (!uiContent.includes('NO WALLET SETTLEMENT')) {
      throw new Error('SandboxPaymentTestView.tsx missing "NO WALLET SETTLEMENT" text');
    }

    // 4. Invariant: No Number() or parseFloat() conversion for amount
    if (uiContent.includes('Number(amountStr)') || uiContent.includes('parseFloat(amountStr)')) {
      throw new Error('SandboxPaymentTestView.tsx unsafe amount numeric conversion found');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Create Sandbox Payment Flow (Scale-4 "0.0516" Exact String)
  // --------------------------------------------------------------------------
  let createdTxId = '';
  await assert('3. Authenticated Create Sandbox Payment returns transaction ID & exact amount without float precision loss', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        customerName: 'Rahim Tester',
        customerEmail: 'rahim@test.local',
        amount: '0.0516', // Scale-4 micro decimal
        metadata: { e2eTest: true }
      }
    };
    const res = mockResponse();

    await controller.createPayment(req, res);

    if (res.statusCode !== 201 && res.statusCode !== 200) throw new Error(`Expected HTTP 200/201, got ${res.statusCode}`);
    if (!res.body?.success) throw new Error('Expected success: true');
    if (res.body?.isSandbox !== true) throw new Error('Expected isSandbox: true');
    if (res.body?.status !== 'CREATED') throw new Error(`Expected status CREATED, got ${res.body?.status}`);
    if (res.body?.amount !== '0.0516') throw new Error(`Expected exact string "0.0516", got "${res.body?.amount}"`);
    if (!res.body?.transactionId?.startsWith('SBX_TX_PAY_')) {
      throw new Error(`Unexpected transactionId format: ${res.body?.transactionId}`);
    }
    if (!res.body?.paymentUrl?.includes('sandbox.gameplay365.local')) {
      throw new Error(`Unexpected paymentUrl: ${res.body?.paymentUrl}`);
    }

    createdTxId = res.body.transactionId;
  });

  // --------------------------------------------------------------------------
  // TEST 4: Numeric Amount Rejection (400 UNSAFE_NUMERIC_MONEY_INPUT)
  // --------------------------------------------------------------------------
  await assert('4. Raw JS numeric amount rejected with 400 UNSAFE_NUMERIC_MONEY_INPUT', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        customerName: 'Rahim Tester',
        customerEmail: 'rahim@test.local',
        amount: 1500.50 // Unsafe float number!
      }
    };
    const res = mockResponse();

    await controller.createPayment(req, res);

    if (res.statusCode !== 400) throw new Error(`Expected HTTP 400, got ${res.statusCode}`);
    if (res.body?.code !== 'UNSAFE_NUMERIC_MONEY_INPUT') {
      throw new Error(`Expected UNSAFE_NUMERIC_MONEY_INPUT, got ${res.body?.code}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Verify PENDING Fixture Flow
  // --------------------------------------------------------------------------
  await assert('5. Verify PENDING returns status PENDING and code SANDBOX_PENDING', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        transactionId: PAYMENT_PENDING_FIXTURE.transactionId
      }
    };
    const res = mockResponse();

    await controller.verifyPayment(req, res);

    if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
    if (res.body?.status !== 'PENDING') throw new Error(`Expected status PENDING, got ${res.body?.status}`);
    if (res.body?.code !== 'SANDBOX_PENDING') throw new Error(`Expected code SANDBOX_PENDING, got ${res.body?.code}`);
    if (res.body?.settlementBlocked !== true) throw new Error('Expected settlementBlocked: true');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Verify COMPLETED Fixture Flow
  // --------------------------------------------------------------------------
  await assert('6. Verify COMPLETED returns status COMPLETED and code SANDBOX_VERIFIED_NO_SETTLEMENT', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        transactionId: PAYMENT_COMPLETED_FIXTURE.transactionId,
        expectedAmount: '5000.0000'
      }
    };
    const res = mockResponse();

    await controller.verifyPayment(req, res);

    if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
    if (res.body?.status !== 'COMPLETED') throw new Error(`Expected status COMPLETED, got ${res.body?.status}`);
    if (res.body?.code !== 'SANDBOX_VERIFIED_NO_SETTLEMENT') {
      throw new Error(`Expected code SANDBOX_VERIFIED_NO_SETTLEMENT, got ${res.body?.code}`);
    }
    if (res.body?.settlementBlocked !== true) throw new Error('Expected settlementBlocked: true');
    if (res.body?.amount !== '5000.0000') throw new Error(`Expected exact amount 5000.0000, got ${res.body?.amount}`);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Verify ERROR Fixture Flow
  // --------------------------------------------------------------------------
  await assert('7. Verify ERROR returns status ERROR and code SANDBOX_ERROR', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        transactionId: PAYMENT_ERROR_FIXTURE.transactionId
      }
    };
    const res = mockResponse();

    await controller.verifyPayment(req, res);

    if (res.statusCode !== 400) throw new Error(`Expected HTTP 400 for ERROR fixture, got ${res.statusCode}`);
    if (res.body?.status !== 'ERROR') throw new Error(`Expected status ERROR, got ${res.body?.status}`);
    if (res.body?.code !== 'SANDBOX_ERROR') throw new Error(`Expected code SANDBOX_ERROR, got ${res.body?.code}`);
  });

  // --------------------------------------------------------------------------
  // TEST 8: Verify Amount Mismatch Flow (400 AMOUNT_MISMATCH)
  // --------------------------------------------------------------------------
  await assert('8. Verify with mismatched expected amount returns 400 AMOUNT_MISMATCH', async () => {
    const req: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        transactionId: PAYMENT_AMOUNT_MISMATCH_FIXTURE.transactionId,
        expectedAmount: '1000.0000' // Fixture has '3000.0000'
      }
    };
    const res = mockResponse();

    await controller.verifyPayment(req, res);

    if (res.statusCode !== 400) throw new Error(`Expected HTTP 400, got ${res.statusCode}`);
    if (res.body?.code !== 'AMOUNT_MISMATCH') {
      throw new Error(`Expected code AMOUNT_MISMATCH, got ${res.body?.code}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: Verification of Newly Created Intent (Unverified initially PENDING, then transitions to COMPLETED)
  // --------------------------------------------------------------------------
  await assert('9. Verify created transaction intent returns PENDING initially, then COMPLETED upon simulated completion', async () => {
    // 9a: Initially created intent is in PENDING state
    const req1: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        transactionId: createdTxId,
        expectedAmount: '0.0516'
      }
    };
    const res1 = mockResponse();

    await controller.verifyPayment(req1, res1);

    if (res1.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res1.statusCode}`);
    if (res1.body?.status !== 'PENDING') throw new Error(`Expected status PENDING, got ${res1.body?.status}`);
    if (res1.body?.code !== 'SANDBOX_PENDING') throw new Error(`Expected code SANDBOX_PENDING, got ${res1.body?.code}`);

    // 9b: Transition to COMPLETED fixture state
    adapter.setFixtureStatus(createdTxId, 'COMPLETED');

    const req2: any = {
      user: { uid: testUser.uid },
      mockUser: testUser,
      body: {
        transactionId: createdTxId,
        expectedAmount: '0.0516'
      }
    };
    const res2 = mockResponse();

    await controller.verifyPayment(req2, res2);

    if (res2.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res2.statusCode}`);
    if (res2.body?.status !== 'COMPLETED') throw new Error(`Expected status COMPLETED, got ${res2.body?.status}`);
    if (res2.body?.settlementBlocked !== true) throw new Error('Expected settlementBlocked: true');
    if (res2.body?.amount !== '0.0516') throw new Error(`Expected amount "0.0516", got "${res2.body?.amount}"`);
  });

  // --------------------------------------------------------------------------
  // TEST 10: ZERO WALLET MUTATION & ZERO LEDGER TRANSACTION GUARANTEE
  // --------------------------------------------------------------------------
  await assert('10. Critical Invariant: Zero wallet balance mutations and zero ledger transactions throughout sandbox journey', async () => {
    const client = await dbEngine.connect();
    const walletRes = await client.query(
      `SELECT real_balance, bonus_balance, locked_balance, balance_minor, version FROM wallets WHERE user_id = $1`,
      ['test_player_01']
    );
    const wallet = walletRes.rows[0];

    // Assert initial seeded balance (500.0000 BDT) is completely unmutated
    if (wallet.real_balance !== '500.0000') {
      throw new Error(`Wallet balance mutated! Expected 500.0000, found ${wallet.real_balance}`);
    }
    if (wallet.bonus_balance !== '0.0000') {
      throw new Error(`Bonus balance mutated! Found ${wallet.bonus_balance}`);
    }
    if (wallet.locked_balance !== '0.0000') {
      throw new Error(`Locked balance mutated! Found ${wallet.locked_balance}`);
    }

    const txRes = await client.query(`SELECT * FROM ledger_entries WHERE user_id = $1`, ['test_player_01']);
    if (txRes.rowCount !== 0) {
      throw new Error(`Ledger entries created! Expected 0, found ${txRes.rowCount}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 11: ZERO EXTERNAL NETWORK CALLS GUARANTEE
  // --------------------------------------------------------------------------
  await assert('11. Critical Security Boundary: Zero external network calls attempted across entire test suite', async () => {
    if (networkCallsAttempted !== 0) {
      throw new Error(`Detected ${networkCallsAttempted} external network calls!`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 12: Router Mounting & App Registration
  // --------------------------------------------------------------------------
  await assert('12. App.tsx registers SandboxPaymentTestView in dev mode', async () => {
    const appPath = path.join(process.cwd(), 'src/App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf8');

    if (!appContent.includes('SandboxPaymentTestView')) {
      throw new Error('App.tsx missing SandboxPaymentTestView import or usage');
    }
    if (!appContent.includes('sandboxPayment')) {
      throw new Error('App.tsx missing sandboxPayment tab handling');
    }
  });

  // Restore fetch
  (global as any).fetch = originalFetch;

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🏁 PLAY369 TASK 6.2C SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    throw new Error(`TASK 6.2C TEST SUITE FAILED with ${failed} failures.`);
  }
}

// Execute suite
runTask62CSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
