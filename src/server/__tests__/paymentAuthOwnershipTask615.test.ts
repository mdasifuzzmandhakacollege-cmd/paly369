/**
 * @file paymentAuthOwnershipTask615.test.ts
 * @description Comprehensive Verification Suite for PLAY369 Task 6.1.5 Authenticated Payment Ownership Boundary.
 * 
 * Verifies:
 * 1. Missing authentication token rejects with 401 UNAUTHENTICATED on all 5 player routes.
 * 2. Unregistered Firebase UID (no DB record) fails closed with 404 USER_PROFILE_NOT_FOUND.
 * 3. Client supplying another player's userId returns 403 ACCOUNT_OWNERSHIP_MISMATCH.
 * 4. Client omitting body.userId succeeds with authoritative user identity resolution.
 * 5. Client supplying matching userId or matching UID succeeds.
 * 6. deposit/intent, deposit/verify-trx, and withdraw/request enforce ownership binding to resolved user.id.
 * 7. Webhook endpoint POST /api/v2/payment/webhook/:provider has NO requireAuth middleware.
 * 8. Admin routes preserve requireAdmin middleware.
 * 9. Static code analysis: verify route wiring in src/server/index.ts.
 */

import { paymentGatewayController } from '../controllers/paymentGatewayController';
import { paymentController } from '../controllers/paymentController';
import { resolveAuthPaymentUser, PaymentAuthError } from '../utils/paymentAuth';
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

async function runTests() {
  console.log('================================================================');
  console.log('🛡️ RUNNING PLAY369 TASK 6.1.5: AUTHENTICATED PAYMENT OWNERSHIP BOUNDARY');
  console.log('================================================================\n');

  const aliceDbUser = { id: 101, uid: 'fb_uid_alice', username: 'alice', email: 'alice@play369.com' };
  const bobDbUser = { id: 102, uid: 'fb_uid_bob', username: 'bob', email: 'bob@play369.com' };

  // --------------------------------------------------------------------------
  // TEST 1: resolveAuthPaymentUser rejects unauthenticated requests
  // --------------------------------------------------------------------------
  await assert('1. resolveAuthPaymentUser rejects missing auth with 401 UNAUTHENTICATED', async () => {
    const unauthReq: any = { headers: {} };
    let threw = false;
    try {
      await resolveAuthPaymentUser(unauthReq);
    } catch (err: any) {
      threw = true;
      if (err.statusCode !== 401 || err.code !== 'UNAUTHENTICATED') {
        throw new Error(`Expected 401 UNAUTHENTICATED, got ${err.statusCode} ${err.code}`);
      }
    }
    if (!threw) throw new Error('Expected resolveAuthPaymentUser to throw for unauthenticated request');
  });

  // --------------------------------------------------------------------------
  // TEST 2: resolveAuthPaymentUser fails closed on unknown UID (USER_PROFILE_NOT_FOUND)
  // --------------------------------------------------------------------------
  await assert('2. resolveAuthPaymentUser fails closed with 404 USER_PROFILE_NOT_FOUND when UID has no PostgreSQL user', async () => {
    const ghostReq: any = {
      user: { uid: 'ghost_unregistered_uid' },
      mockUser: null,
      headers: {}
    };
    let threw = false;
    try {
      await resolveAuthPaymentUser(ghostReq);
    } catch (err: any) {
      threw = true;
      if (err.statusCode !== 404 || err.code !== 'USER_PROFILE_NOT_FOUND') {
        throw new Error(`Expected 404 USER_PROFILE_NOT_FOUND, got ${err.statusCode} ${err.code}`);
      }
    }
    if (!threw) throw new Error('Expected resolveAuthPaymentUser to throw 404 for unknown UID');
  });

  // --------------------------------------------------------------------------
  // TEST 3: resolveAuthPaymentUser rejects account ownership mismatch (403)
  // --------------------------------------------------------------------------
  await assert('3. resolveAuthPaymentUser throws 403 ACCOUNT_OWNERSHIP_MISMATCH when client supplies another user ID', async () => {
    const maliciousReq: any = {
      user: { uid: 'fb_uid_alice' },
      mockUser: aliceDbUser,
      headers: {}
    };

    // Alice tries to specify Bob's numeric ID (102)
    let threwId = false;
    try {
      await resolveAuthPaymentUser(maliciousReq, 102);
    } catch (err: any) {
      threwId = true;
      if (err.statusCode !== 403 || err.code !== 'ACCOUNT_OWNERSHIP_MISMATCH') {
        throw new Error(`Expected 403 ACCOUNT_OWNERSHIP_MISMATCH, got ${err.statusCode} ${err.code}`);
      }
    }
    if (!threwId) throw new Error('Expected 403 when trying to operate on another user numeric ID');

    // Alice tries to specify Bob's UID ('fb_uid_bob')
    let threwUid = false;
    try {
      await resolveAuthPaymentUser(maliciousReq, 'fb_uid_bob');
    } catch (err: any) {
      threwUid = true;
      if (err.statusCode !== 403 || err.code !== 'ACCOUNT_OWNERSHIP_MISMATCH') {
        throw new Error(`Expected 403 ACCOUNT_OWNERSHIP_MISMATCH, got ${err.statusCode} ${err.code}`);
      }
    }
    if (!threwUid) throw new Error('Expected 403 when trying to operate on another user UID');
  });

  // --------------------------------------------------------------------------
  // TEST 4: resolveAuthPaymentUser succeeds when body.userId is omitted (optional)
  // --------------------------------------------------------------------------
  await assert('4. resolveAuthPaymentUser succeeds when body.userId is omitted or undefined', async () => {
    const validReq: any = {
      user: { uid: 'fb_uid_alice' },
      mockUser: aliceDbUser,
      headers: {}
    };

    const resolved = await resolveAuthPaymentUser(validReq, undefined);
    if (resolved.id !== 101 || resolved.uid !== 'fb_uid_alice' || resolved.username !== 'alice') {
      throw new Error(`Unexpected user resolution: ${JSON.stringify(resolved)}`);
    }

    const resolvedNull = await resolveAuthPaymentUser(validReq, null);
    if (resolvedNull.id !== 101) {
      throw new Error('Failed to resolve with null clientUserId');
    }

    const resolvedEmpty = await resolveAuthPaymentUser(validReq, '');
    if (resolvedEmpty.id !== 101) {
      throw new Error('Failed to resolve with empty clientUserId');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: resolveAuthPaymentUser succeeds when client supplies own matching ID or UID
  // --------------------------------------------------------------------------
  await assert('5. resolveAuthPaymentUser succeeds when client supplies matching userId (101 or fb_uid_alice)', async () => {
    const validReq: any = {
      user: { uid: 'fb_uid_alice' },
      mockUser: aliceDbUser,
      headers: {}
    };

    const res1 = await resolveAuthPaymentUser(validReq, 101);
    if (res1.id !== 101) throw new Error('Failed matching numeric ID');

    const res2 = await resolveAuthPaymentUser(validReq, '101');
    if (res2.id !== 101) throw new Error('Failed matching numeric string ID');

    const res3 = await resolveAuthPaymentUser(validReq, 'fb_uid_alice');
    if (res3.id !== 101) throw new Error('Failed matching UID string');
  });

  // --------------------------------------------------------------------------
  // TEST 6: PaymentGatewayController.createDepositIntent enforces auth & ownership
  // --------------------------------------------------------------------------
  await assert('6. PaymentGatewayController.createDepositIntent binds intent to resolved auth user.id and rejects unauth/mismatch', async () => {
    // 6a: Unauthenticated -> 401
    const unauthReq: any = {
      body: { provider: 'bkash', amount: '100.0000' },
      headers: {},
      socket: {}
    };
    const res1 = mockResponse();
    await paymentGatewayController.createDepositIntent(unauthReq, res1);
    if (res1.statusCode !== 401 || res1.body?.code !== 'UNAUTHENTICATED') {
      throw new Error(`Expected 401 UNAUTHENTICATED, got ${res1.statusCode} ${JSON.stringify(res1.body)}`);
    }

    // 6b: User profile not found -> 404
    const unknownReq: any = {
      user: { uid: 'ghost_user' },
      mockUser: null,
      body: { provider: 'bkash', amount: '100.0000' },
      headers: {},
      socket: {}
    };
    const res2 = mockResponse();
    await paymentGatewayController.createDepositIntent(unknownReq, res2);
    if (res2.statusCode !== 404 || res2.body?.code !== 'USER_PROFILE_NOT_FOUND') {
      throw new Error(`Expected 404 USER_PROFILE_NOT_FOUND, got ${res2.statusCode} ${JSON.stringify(res2.body)}`);
    }

    // 6c: Account mismatch (Alice sends Bob's userId) -> 403
    const mismatchReq: any = {
      user: { uid: 'fb_uid_alice' },
      mockUser: aliceDbUser,
      body: { userId: 102, provider: 'bkash', amount: '100.0000' },
      headers: {},
      socket: {}
    };
    const res3 = mockResponse();
    await paymentGatewayController.createDepositIntent(mismatchReq, res3);
    if (res3.statusCode !== 403 || res3.body?.code !== 'ACCOUNT_OWNERSHIP_MISMATCH') {
      throw new Error(`Expected 403 ACCOUNT_OWNERSHIP_MISMATCH, got ${res3.statusCode} ${JSON.stringify(res3.body)}`);
    }

    // 6d: Valid authenticated user without userId in body -> 201 with intent.userId === '101'
    const validReq: any = {
      user: { uid: 'fb_uid_alice' },
      mockUser: aliceDbUser,
      body: { provider: 'bkash', amount: '100.0000' },
      headers: {},
      socket: {}
    };
    const res4 = mockResponse();
    await paymentGatewayController.createDepositIntent(validReq, res4);
    if (res4.statusCode !== 201 || !res4.body?.success || res4.body?.data?.userId !== '101') {
      throw new Error(`Expected 201 with userId '101', got ${res4.statusCode} ${JSON.stringify(res4.body)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: PaymentGatewayController.verifyTrxId rejects attempts to verify another user's deposit intent
  // --------------------------------------------------------------------------
  await assert('7. PaymentGatewayController.verifyTrxId rejects verifying intent owned by another user with 403', async () => {
    // Create intent owned by Alice (101)
    const aliceReq: any = {
      user: { uid: 'fb_uid_alice' },
      mockUser: aliceDbUser,
      body: { provider: 'bkash', amount: '250.0000' },
      headers: {},
      socket: {}
    };
    const createRes = mockResponse();
    await paymentGatewayController.createDepositIntent(aliceReq, createRes);
    const depositId = createRes.body.data.id;

    // Bob (102) tries to verify Alice's deposit intent
    const bobReq: any = {
      user: { uid: 'fb_uid_bob' },
      mockUser: bobDbUser,
      body: { depositId, trxId: 'TRX_BOB_ATTEMPT_1' },
      headers: {},
      socket: {}
    };
    const verifyRes = mockResponse();
    await paymentGatewayController.verifyTrxId(bobReq, verifyRes);
    if (verifyRes.statusCode !== 403 || verifyRes.body?.code !== 'ACCOUNT_OWNERSHIP_MISMATCH') {
      throw new Error(`Expected 403 ACCOUNT_OWNERSHIP_MISMATCH when Bob verifies Alice intent, got ${verifyRes.statusCode} ${JSON.stringify(verifyRes.body)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: PaymentGatewayController.requestWithdrawal enforces auth & ownership
  // --------------------------------------------------------------------------
  await assert('8. PaymentGatewayController.requestWithdrawal rejects unauth/mismatch and binds to auth user.id', async () => {
    // 8a: Unauthenticated -> 401
    const unauthReq: any = {
      body: { provider: 'bkash', amount: '50.0000', recipientAccount: '01711223344' },
      headers: {},
      socket: {}
    };
    const res1 = mockResponse();
    await paymentGatewayController.requestWithdrawal(unauthReq, res1);
    if (res1.statusCode !== 401 || res1.body?.code !== 'UNAUTHENTICATED') {
      throw new Error(`Expected 401 UNAUTHENTICATED, got ${res1.statusCode}`);
    }

    // 8b: Mismatch (Alice submits Bob's userId) -> 403
    const mismatchReq: any = {
      user: { uid: 'fb_uid_alice' },
      mockUser: aliceDbUser,
      body: { userId: 102, provider: 'bkash', amount: '50.0000', recipientAccount: '01711223344' },
      headers: {},
      socket: {}
    };
    const res2 = mockResponse();
    await paymentGatewayController.requestWithdrawal(mismatchReq, res2);
    if (res2.statusCode !== 403 || res2.body?.code !== 'ACCOUNT_OWNERSHIP_MISMATCH') {
      throw new Error(`Expected 403 ACCOUNT_OWNERSHIP_MISMATCH, got ${res2.statusCode}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: PaymentController deposit & withdrawal enforce auth & ownership
  // --------------------------------------------------------------------------
  await assert('9. PaymentController deposit & withdrawal reject unauth (401) and mismatch (403)', async () => {
    // 9a: Deposit unauthenticated -> 401
    const unauthDepReq: any = {
      body: { method: 'BKASH', amount: '100.0000', trxId: 'TRX_UNAUTH_1' },
      headers: {}
    };
    const res1 = mockResponse();
    await paymentController.submitDeposit(unauthDepReq, res1);
    if (res1.statusCode !== 401 || res1.body?.code !== 'UNAUTHENTICATED') {
      throw new Error(`Expected 401 UNAUTHENTICATED for unauthenticated deposit, got ${res1.statusCode}`);
    }

    // 9b: Deposit mismatch -> 403
    const mismatchDepReq: any = {
      user: { uid: 'fb_uid_alice' },
      mockUser: aliceDbUser,
      body: { userId: 102, method: 'BKASH', amount: '100.0000', trxId: 'TRX_MISMATCH_1' },
      headers: {}
    };
    const res2 = mockResponse();
    await paymentController.submitDeposit(mismatchDepReq, res2);
    if (res2.statusCode !== 403 || res2.body?.code !== 'ACCOUNT_OWNERSHIP_MISMATCH') {
      throw new Error(`Expected 403 ACCOUNT_OWNERSHIP_MISMATCH for deposit, got ${res2.statusCode}`);
    }

    // 9c: Withdrawal unauthenticated -> 401
    const unauthWthReq: any = {
      body: { method: 'BKASH', amount: '100.0000', receiverNumber: '01711223344' },
      headers: {}
    };
    const res3 = mockResponse();
    await paymentController.submitWithdrawal(unauthWthReq, res3);
    if (res3.statusCode !== 401 || res3.body?.code !== 'UNAUTHENTICATED') {
      throw new Error(`Expected 401 UNAUTHENTICATED for unauthenticated withdrawal, got ${res3.statusCode}`);
    }

    // 9d: Withdrawal mismatch -> 403
    const mismatchWthReq: any = {
      user: { uid: 'fb_uid_alice' },
      mockUser: aliceDbUser,
      body: { userId: 102, method: 'BKASH', amount: '100.0000', receiverNumber: '01711223344' },
      headers: {}
    };
    const res4 = mockResponse();
    await paymentController.submitWithdrawal(mismatchWthReq, res4);
    if (res4.statusCode !== 403 || res4.body?.code !== 'ACCOUNT_OWNERSHIP_MISMATCH') {
      throw new Error(`Expected 403 ACCOUNT_OWNERSHIP_MISMATCH for withdrawal, got ${res4.statusCode}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 10: Static Route Wiring Verification in src/server/index.ts
  // --------------------------------------------------------------------------
  await assert('10. Static Code Analysis: Router wiring in src/server/index.ts matches Task 6.1.5 specifications', () => {
    const indexPath = path.join(process.cwd(), 'src', 'server', 'index.ts');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    // 10a: cashierRouter routes have requireAuth
    if (!indexContent.includes("cashierRouter.post('/deposit', requireAuth,")) {
      throw new Error("POST /api/cashier/deposit must use requireAuth");
    }
    if (!indexContent.includes("cashierRouter.post('/withdraw', requireAuth,")) {
      throw new Error("POST /api/cashier/withdraw must use requireAuth");
    }

    // 10b: paymentV2Router player routes have requireAuth
    if (!indexContent.includes("paymentV2Router.post('/deposit/intent', requireAuth,")) {
      throw new Error("POST /api/v2/payment/deposit/intent must use requireAuth");
    }
    if (!indexContent.includes("paymentV2Router.post('/deposit/verify-trx', requireAuth,")) {
      throw new Error("POST /api/v2/payment/deposit/verify-trx must use requireAuth");
    }
    if (!indexContent.includes("paymentV2Router.post('/withdraw/request', requireAuth,")) {
      throw new Error("POST /api/v2/payment/withdraw/request must use requireAuth");
    }

    // 10c: Webhook route does NOT have requireAuth
    if (indexContent.includes("paymentV2Router.post('/webhook/:provider', requireAuth,")) {
      throw new Error("POST /api/v2/payment/webhook/:provider must NOT use requireAuth (machine-to-machine HMAC)");
    }
    if (!indexContent.includes("paymentV2Router.post('/webhook/:provider', (req, res)")) {
      throw new Error("POST /api/v2/payment/webhook/:provider must route directly to handleWebhook without requireAuth");
    }

    // 10d: Admin routes have requireAdmin
    if (!indexContent.includes("cashierRouter.get('/requests', requireAdmin,")) {
      throw new Error("GET /api/cashier/requests must use requireAdmin");
    }
    if (!indexContent.includes("paymentV2Router.get('/destination-pool', requireAdmin,")) {
      throw new Error("GET /api/v2/payment/destination-pool must use requireAdmin");
    }
    if (!indexContent.includes("paymentV2Router.get('/stats', requireAdmin,")) {
      throw new Error("GET /api/v2/payment/stats must use requireAdmin");
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TASK 6.1.5 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
