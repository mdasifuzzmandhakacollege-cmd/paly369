/**
 * @file sandboxPaymentContractTask62A.test.ts
 * @description Comprehensive Verification Suite for PLAY369 Task 6.2A: Sandbox-Only Payment Contract Harness.
 * 
 * Invariants & Requirements:
 * 1. NO live payment API calls
 * 2. NO production credentials
 * 3. NO real-money settlement / zero WalletLedgerService credits
 * 4. Exact scale-4 decimal strings (no Number, parseFloat, or toFixed)
 * 5. Deterministic fixtures: CREATED, PENDING, COMPLETED, ERROR, DUPLICATE, AMOUNT_MISMATCH
 * 6. Even mock COMPLETED must return SANDBOX_VERIFIED_NO_SETTLEMENT
 * 7. Explicit production fail-close returning SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION
 * 8. NEVER treat browser redirect as payment authority
 */

import {
  SandboxPaymentAdapter,
  sandboxPaymentAdapter,
  PAYMENT_CREATED_FIXTURE,
  PAYMENT_PENDING_FIXTURE,
  PAYMENT_COMPLETED_FIXTURE,
  PAYMENT_ERROR_FIXTURE,
  PAYMENT_DUPLICATE_FIXTURE,
  PAYMENT_AMOUNT_MISMATCH_FIXTURE
} from '../sandbox';
import { InMemoryPostgresLedgerEngine } from '../ledger/db';
import { WalletLedgerService } from '../ledger/walletLedgerService';

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

async function runSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING PLAY369 TASK 6.2A: SANDBOX-ONLY PAYMENT CONTRACT HARNESS');
  console.log('================================================================\n');

  // Setup Fresh Ledger to verify zero ledger mutations
  const dbEngine = new InMemoryPostgresLedgerEngine();
  const ledgerService = new WalletLedgerService(dbEngine);

  // Seed a test user and wallet
  const testUser = { id: 9001, uid: 'fb_sandbox_user_9001', username: 'sandbox_tester' };
  await dbEngine.query(
    `INSERT INTO users (id, firebase_uid, username, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [testUser.id, testUser.uid, testUser.username]
  );
  await dbEngine.query(
    `INSERT INTO wallets (id, user_id, currency, real_balance, bonus_balance, locked_balance, balance_minor, version, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    ['w_9001_bdt', '9001', 'BDT', '10000.0000', '0.0000', '0.0000', '100000000', 1, 'ACTIVE']
  );

  const adapter = new SandboxPaymentAdapter();

  // Network call tracker: Ensure ZERO external network calls
  let networkCallsAttempted = 0;
  const originalFetch = (global as any).fetch;
  (global as any).fetch = async () => {
    networkCallsAttempted++;
    throw new Error('CRITICAL SECURITY VIOLATION: Sandbox adapter attempted an external network call!');
  };

  // --------------------------------------------------------------------------
  // TEST 1: CREATE PAYMENT REQUEST & RESPONSE MODELING
  // --------------------------------------------------------------------------
  console.log('--- Test 1: Create Payment Request & Response Modeling ---');

  await assert('createPayment returns valid SandboxCreatePaymentResponse with exact scale-4 amount', async () => {
    const res = await adapter.createPayment({
      customerName: 'Rahim Khan',
      customerEmail: 'rahim.khan@example.com',
      amount: '1250.5000',
      successCallbackUrl: 'https://gameplay365.local/payment/success',
      cancelCallbackUrl: 'https://gameplay365.local/payment/cancel',
      metadata: { orderId: 'ORD_99182', tier: 'SILVER' }
    });

    if (res.status !== 'CREATED') {
      throw new Error(`Expected status CREATED, got ${res.status}`);
    }
    if (!res.isSandbox) {
      throw new Error('Expected isSandbox: true');
    }
    if (res.amount !== '1250.5000') {
      throw new Error(`Expected exact amount '1250.5000', got ${res.amount}`);
    }
    if (!res.paymentUrl || !res.paymentUrl.startsWith('https://sandbox.')) {
      throw new Error(`Invalid paymentUrl: ${res.paymentUrl}`);
    }
    if (!res.transactionId || !res.transactionId.startsWith('SBX_TX_PAY_')) {
      throw new Error(`Invalid transactionId: ${res.transactionId}`);
    }
  });

  await assert('createPayment rejects malformed or missing customer parameters', async () => {
    let errName = false;
    try {
      await adapter.createPayment({
        customerName: '',
        customerEmail: 'test@example.com',
        amount: '100.0000',
        successCallbackUrl: 'https://local/success',
        cancelCallbackUrl: 'https://local/cancel'
      });
    } catch {
      errName = true;
    }
    if (!errName) throw new Error('Failed to reject empty customerName');

    let errEmail = false;
    try {
      await adapter.createPayment({
        customerName: 'Valid Name',
        customerEmail: 'invalid-email',
        amount: '100.0000',
        successCallbackUrl: 'https://local/success',
        cancelCallbackUrl: 'https://local/cancel'
      });
    } catch {
      errEmail = true;
    }
    if (!errEmail) throw new Error('Failed to reject malformed email');
  });

  // --------------------------------------------------------------------------
  // TEST 2: PENDING VERIFICATION FIXTURE
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Pending Verification Fixture ---');

  await assert('verifyPayment on PENDING fixture returns status PENDING with code SANDBOX_PENDING', async () => {
    const res = await adapter.verifyPayment({
      transactionId: PAYMENT_PENDING_FIXTURE.transactionId
    });

    if (res.status !== 'PENDING') {
      throw new Error(`Expected status PENDING, got ${res.status}`);
    }
    if (res.code !== 'SANDBOX_PENDING') {
      throw new Error(`Expected code SANDBOX_PENDING, got ${res.code}`);
    }
    if (res.amount !== PAYMENT_PENDING_FIXTURE.amount) {
      throw new Error(`Amount mismatch: expected ${PAYMENT_PENDING_FIXTURE.amount}, got ${res.amount}`);
    }
    if (!res.settlementBlocked) {
      throw new Error('Expected settlementBlocked: true');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: COMPLETED VERIFICATION FIXTURE & ZERO WALLET MUTATION
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Completed Verification & Zero Wallet Mutation ---');

  await assert('verifyPayment on COMPLETED fixture returns SANDBOX_VERIFIED_NO_SETTLEMENT', async () => {
    const res = await adapter.verifyPayment({
      transactionId: PAYMENT_COMPLETED_FIXTURE.transactionId
    });

    if (res.status !== 'COMPLETED') {
      throw new Error(`Expected status COMPLETED, got ${res.status}`);
    }
    if (res.code !== 'SANDBOX_VERIFIED_NO_SETTLEMENT') {
      throw new Error(`Expected code 'SANDBOX_VERIFIED_NO_SETTLEMENT', got ${res.code}`);
    }
    if (!res.settlementBlocked) {
      throw new Error('Expected settlementBlocked: true');
    }
    if (res.customerName !== PAYMENT_COMPLETED_FIXTURE.customerName) {
      throw new Error(`Customer name mismatch: ${res.customerName}`);
    }
  });

  await assert('WalletLedgerService balance remains completely unchanged (Zero Credit Invariant)', async () => {
    const wallet = await ledgerService.getWallet(testUser.id, 'BDT');
    if (wallet.realBalance !== '10000.0000' || wallet.lockedBalance !== '0.0000' || wallet.bonusBalance !== '0.0000') {
      throw new Error(`Wallet balance was mutated! Found: real=${wallet.realBalance}, locked=${wallet.lockedBalance}`);
    }

    const ledgerEntries = await dbEngine.query(`SELECT * FROM ledger_entries WHERE user_id = $1`, [testUser.id]);
    if (ledgerEntries.rows.length !== 0) {
      throw new Error(`Expected 0 ledger entries, found ${ledgerEntries.rows.length}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: ERROR VERIFICATION FIXTURE
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Error Verification Fixture ---');

  await assert('verifyPayment on ERROR fixture returns status ERROR and code SANDBOX_ERROR', async () => {
    const res = await adapter.verifyPayment({
      transactionId: PAYMENT_ERROR_FIXTURE.transactionId
    });

    if (res.status !== 'ERROR') {
      throw new Error(`Expected status ERROR, got ${res.status}`);
    }
    if (res.code !== 'SANDBOX_ERROR') {
      throw new Error(`Expected code SANDBOX_ERROR, got ${res.code}`);
    }
    if (!res.settlementBlocked) {
      throw new Error('Expected settlementBlocked: true');
    }
  });

  await assert('verifyPayment on non-existent transaction ID returns FIXTURE_NOT_FOUND', async () => {
    const res = await adapter.verifyPayment({
      transactionId: 'SBX_TX_NON_EXISTENT_999'
    });

    if (res.status !== 'ERROR' || res.code !== 'FIXTURE_NOT_FOUND') {
      throw new Error(`Expected 404 FIXTURE_NOT_FOUND, got status=${res.status}, code=${res.code}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: AMOUNT MISMATCH REJECTION
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Amount Mismatch Rejection ---');

  await assert('verifyPayment rejects request when expectedAmount differs from fixture amount', async () => {
    const res = await adapter.verifyPayment({
      transactionId: PAYMENT_AMOUNT_MISMATCH_FIXTURE.transactionId,
      expectedAmount: '2000.0000' // Fixture is 3000.0000
    });

    if (res.status !== 'ERROR' || res.code !== 'AMOUNT_MISMATCH') {
      throw new Error(`Expected AMOUNT_MISMATCH error, got status=${res.status}, code=${res.code}`);
    }
  });

  await assert('verifyPayment succeeds when expectedAmount matches fixture amount exactly', async () => {
    const res = await adapter.verifyPayment({
      transactionId: PAYMENT_AMOUNT_MISMATCH_FIXTURE.transactionId,
      expectedAmount: '3000.0000' // Exact match
    });

    if (res.status !== 'COMPLETED' || res.code !== 'SANDBOX_VERIFIED_NO_SETTLEMENT') {
      throw new Error(`Expected COMPLETED match, got status=${res.status}, code=${res.code}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: DETERMINISTIC DUPLICATE VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Deterministic Duplicate Verification ---');

  await assert('Repeated verifications increment verification count deterministically with zero mutations', async () => {
    adapter.resetFixtures();

    const res1 = await adapter.verifyPayment({ transactionId: PAYMENT_DUPLICATE_FIXTURE.transactionId });
    const res2 = await adapter.verifyPayment({ transactionId: PAYMENT_DUPLICATE_FIXTURE.transactionId });
    const res3 = await adapter.verifyPayment({ transactionId: PAYMENT_DUPLICATE_FIXTURE.transactionId });

    if (res1.verificationCount !== 1 || res2.verificationCount !== 2 || res3.verificationCount !== 3) {
      throw new Error(`Verification count incorrect: [${res1.verificationCount}, ${res2.verificationCount}, ${res3.verificationCount}]`);
    }

    if (res1.status !== 'COMPLETED' || res2.status !== 'COMPLETED' || res3.status !== 'COMPLETED') {
      throw new Error('Non-deterministic status across duplicate calls');
    }

    // Check wallet balance again
    const wallet = await ledgerService.getWallet(testUser.id, 'BDT');
    if (wallet.realBalance !== '10000.0000') {
      throw new Error('Wallet mutated during duplicate verifications');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: PRODUCTION MODE FAIL-CLOSED
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Production Mode Fail-Closed ---');

  await assert('Adapter refuses execution when NODE_ENV === "production"', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const createRes = await adapter.createPayment({
        customerName: 'Prod User',
        customerEmail: 'prod@example.com',
        amount: '100.0000',
        successCallbackUrl: 'https://gameplay365.com/success',
        cancelCallbackUrl: 'https://gameplay365.com/cancel'
      });

      if (createRes.status !== 'SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION') {
        throw new Error(`Expected createPayment to fail-close in production, got ${createRes.status}`);
      }

      const verifyRes = await adapter.verifyPayment({
        transactionId: PAYMENT_COMPLETED_FIXTURE.transactionId
      });

      if (verifyRes.status !== 'SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION' || verifyRes.code !== 'SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION') {
        throw new Error(`Expected verifyPayment to fail-close in production, got status=${verifyRes.status}, code=${verifyRes.code}`);
      }
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: BROWSER REDIRECT INDEPENDENCE
  // --------------------------------------------------------------------------
  console.log('\n--- Test 8: Browser Redirect Parameter Independence ---');

  await assert('evaluateRedirectCallback returns isAuthoritative: false and INFORMATIONAL_ONLY', () => {
    const redirectParams = {
      status: 'success',
      trxId: 'FAKED_BROWSER_REDIRECT_TRX_999',
      amount: '99999.0000',
      credited: 'true'
    };

    const analysis = adapter.evaluateRedirectCallback(redirectParams);

    if (analysis.isAuthoritative !== false) {
      throw new Error('Security defect: redirect params treated as authoritative!');
    }
    if (analysis.status !== 'INFORMATIONAL_ONLY') {
      throw new Error(`Expected status INFORMATIONAL_ONLY, got ${analysis.status}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: ZERO EXTERNAL NETWORK CALLS
  // --------------------------------------------------------------------------
  console.log('\n--- Test 9: Zero External Network Calls ---');

  await assert('Adapter executed zero live HTTP / fetch calls across entire harness run', () => {
    if (networkCallsAttempted !== 0) {
      throw new Error(`Expected 0 network calls, detected ${networkCallsAttempted} calls`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 10: EXACT SCALE-4 DECIMAL MONEY & REJECTION OF NUMERIC TYPES
  // --------------------------------------------------------------------------
  console.log('\n--- Test 10: Exact Scale-4 Decimal Money Input Validation ---');

  await assert('Rejects Javascript numbers and over-precision decimals', async () => {
    let rejectedNumber = false;
    try {
      await adapter.createPayment({
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        amount: 500 as any, // Unsafe number
        successCallbackUrl: 'https://local/success',
        cancelCallbackUrl: 'https://local/cancel'
      });
    } catch (err: any) {
      if (err.message.includes('UNSAFE_NUMERIC_MONEY_INPUT') || err.message.includes('Invalid payment amount')) {
        rejectedNumber = true;
      }
    }
    if (!rejectedNumber) {
      throw new Error('Failed to reject JS number input in createPayment');
    }

    let rejectedPrecision = false;
    try {
      await adapter.createPayment({
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        amount: '100.12345', // > 4 decimals
        successCallbackUrl: 'https://local/success',
        cancelCallbackUrl: 'https://local/cancel'
      });
    } catch {
      rejectedPrecision = true;
    }
    if (!rejectedPrecision) {
      throw new Error('Failed to reject >4 decimal precision');
    }
  });

  // Restore fetch
  (global as any).fetch = originalFetch;

  // Final summary
  console.log('\n================================================================');
  console.log(`🏁 TESTS COMPLETED: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
