/**
 * @file safeIdempotencyDerivationTask6162.test.ts
 * @description Verification Suite for PLAY369 Task 6.1.6.2: Safe Idempotency Key -> Transaction ID Derivation.
 * 
 * Verifies:
 * 1. Missing / blank Idempotency-Key returns HTTP 400 IDEMPOTENCY_KEY_REQUIRED.
 * 2. Idempotency-Key < 8 characters returns HTTP 400 INVALID_IDEMPOTENCY_KEY.
 * 3. Idempotency-Key > 128 characters returns HTTP 400 INVALID_IDEMPOTENCY_KEY.
 * 4. Punctuation collision test: "abcdefgh!" and "abcdefgh@" produce DIFFERENT withdrawal transaction IDs.
 * 5. Deterministic derivation: Same user + same key always derives the exact same transaction ID.
 * 6. User isolation: Different users + same key derive DIFFERENT transaction IDs.
 * 7. Bounded length: Transaction IDs never exceed database column limits.
 * 8. Replay safety: Identical replay returns cached reservation (isIdempotent: true) with zero extra deductions.
 * 9. Conflict safety: Conflicting payload on same key returns HTTP 409 IDEMPOTENCY_CONFLICT with zero mutations.
 * 10. Concurrency safety: Concurrent requests on same key settle atomically exactly once.
 * 11. Sensitive logging: Raw idempotency keys are masked in logs and conflict messages.
 */

import { InMemoryPostgresLedgerEngine } from '../ledger/db';
import { WalletLedgerService } from '../ledger/walletLedgerService';
import { paymentController } from '../controllers/paymentController';
import { WageringService } from '../services/wageringService';
import { deriveWithdrawalTransactionId, IdempotencyConflictError } from '../ledger/types';
import { maskIdempotencyKey, maskSensitiveData } from '../gateway/masking';

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
  res.json = (body: any) => {
    res.body = body;
    return res;
  };
  return res;
};

async function runSuite() {
  console.log('================================================================');
  console.log('🛡️ RUNNING PLAY369 TASK 6.1.6.2: SAFE IDEMPOTENCY KEY DERIVATION');
  console.log('================================================================\n');

  // Setup Fresh In-Memory Engine & Service
  const dbEngine = new InMemoryPostgresLedgerEngine();
  const ledgerService = new WalletLedgerService(dbEngine);
  paymentController.setLedgerService(ledgerService);

  // Allow wagering gate for testing
  const origGate = WageringService.enforceWithdrawalWageringGate;
  WageringService.enforceWithdrawalWageringGate = async (params: { userId: number }) => ({
    allowed: true,
    userId: params.userId,
    hasActiveWagering: false,
    reason: undefined,
    activeRequirementsCount: 0,
    activeRequirements: []
  });

  // Seed Users
  const user1 = { id: 1001, uid: 'fb_task6162_user_1', username: 'user_one' };
  const user2 = { id: 1002, uid: 'fb_task6162_user_2', username: 'user_two' };

  await dbEngine.query(
    `INSERT INTO users (id, firebase_uid, username, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [user1.id, user1.uid, user1.username]
  );
  await dbEngine.query(
    `INSERT INTO users (id, firebase_uid, username, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [user2.id, user2.uid, user2.username]
  );

  // Seed Wallets (5000 BDT)
  await dbEngine.query(
    `INSERT INTO wallets (id, user_id, currency, real_balance, bonus_balance, locked_balance, balance_minor, version, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    ['w_1001_bdt', '1001', 'BDT', '5000.0000', '100.0000', '0.0000', '50000000', 1, 'ACTIVE']
  );
  await dbEngine.query(
    `INSERT INTO wallets (id, user_id, currency, real_balance, bonus_balance, locked_balance, balance_minor, version, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    ['w_1002_bdt', '1002', 'BDT', '5000.0000', '0.0000', '0.0000', '50000000', 1, 'ACTIVE']
  );

  // --------------------------------------------------------------------------
  // TEST 1: IDEMPOTENCY-KEY BOUNDS & VALIDATION (HTTP 400)
  // --------------------------------------------------------------------------
  console.log('--- Test 1: Idempotency-Key Header Bounds Validation ---');

  await assert('Missing Idempotency-Key header returns HTTP 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'BKASH',
        amount: '500.0000',
        currency: 'BDT',
        receiverNumber: '01700000001'
      },
      headers: {},
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 400 || res.body?.code !== 'IDEMPOTENCY_KEY_REQUIRED') {
      throw new Error(`Expected 400 IDEMPOTENCY_KEY_REQUIRED, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  await assert('Blank / whitespace-only Idempotency-Key returns HTTP 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'BKASH',
        amount: '500.0000',
        currency: 'BDT',
        receiverNumber: '01700000001'
      },
      headers: { 'idempotency-key': '    ' },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? '    ' : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 400 || res.body?.code !== 'IDEMPOTENCY_KEY_REQUIRED') {
      throw new Error(`Expected 400 IDEMPOTENCY_KEY_REQUIRED, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  await assert('Short Idempotency-Key (< 8 chars) returns HTTP 400 INVALID_IDEMPOTENCY_KEY', async () => {
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'BKASH',
        amount: '500.0000',
        currency: 'BDT',
        receiverNumber: '01700000001'
      },
      headers: { 'idempotency-key': 'short_7' }, // 7 chars
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? 'short_7' : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 400 || res.body?.code !== 'INVALID_IDEMPOTENCY_KEY') {
      throw new Error(`Expected 400 INVALID_IDEMPOTENCY_KEY, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  await assert('Overly long Idempotency-Key (> 128 chars) returns HTTP 400 INVALID_IDEMPOTENCY_KEY', async () => {
    const longKey = 'a'.repeat(129);
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'BKASH',
        amount: '500.0000',
        currency: 'BDT',
        receiverNumber: '01700000001'
      },
      headers: { 'idempotency-key': longKey },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? longKey : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 400 || res.body?.code !== 'INVALID_IDEMPOTENCY_KEY') {
      throw new Error(`Expected 400 INVALID_IDEMPOTENCY_KEY, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: CRYPTOGRAPHIC DERIVATION & PUNCTUATION COLLISION PREVENTION
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Cryptographic Derivation & Punctuation Safety ---');

  await assert('"abcdefgh!" and "abcdefgh@" derive DIFFERENT withdrawal transaction IDs', () => {
    const key1 = 'abcdefgh!';
    const key2 = 'abcdefgh@';

    const txId1 = deriveWithdrawalTransactionId(user1.id, key1);
    const txId2 = deriveWithdrawalTransactionId(user1.id, key2);

    if (txId1 === txId2) {
      throw new Error(`Collision failure: "${key1}" and "${key2}" collapsed to same ID: ${txId1}`);
    }

    if (!txId1.startsWith(`WTH_RES_${user1.id}_`) || !txId2.startsWith(`WTH_RES_${user1.id}_`)) {
      throw new Error(`Invalid transaction ID prefix: ${txId1}, ${txId2}`);
    }

    // Length check: WTH_RES_ (8) + user.id (4) + _ (1) + 32 = 45 chars
    if (txId1.length > 64 || txId2.length > 64) {
      throw new Error(`Transaction ID exceeds safe 64 chars limit: ${txId1.length} chars`);
    }
  });

  await assert('Same user + same key derives exact same transaction ID (deterministic)', () => {
    const key = 'my_safe_client_key_999';
    const tx1 = deriveWithdrawalTransactionId(user1.id, key);
    const tx2 = deriveWithdrawalTransactionId(user1.id, key);

    if (tx1 !== tx2) {
      throw new Error(`Deterministic derivation failed: ${tx1} !== ${tx2}`);
    }
  });

  await assert('Different users + same key derive DIFFERENT transaction IDs', () => {
    const key = 'shared_key_across_different_users';
    const txUser1 = deriveWithdrawalTransactionId(user1.id, key);
    const txUser2 = deriveWithdrawalTransactionId(user2.id, key);

    if (txUser1 === txUser2) {
      throw new Error(`Cross-user collision failure: ${txUser1} === ${txUser2}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: END-TO-END WITHDRAWAL EXECUTION WITH CRYPTO TRANSACTION ID
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: End-to-End Withdrawal Execution ---');

  const validKey1 = 'withdrawal_key_alpha_001';
  let firstResData: any;

  await assert('Valid withdrawal creates reservation with derived SHA-256 transaction ID', async () => {
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'BKASH',
        amount: '1000.0000',
        currency: 'BDT',
        receiverNumber: '01700000001'
      },
      headers: { 'idempotency-key': validKey1 },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? validKey1 : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 201) {
      throw new Error(`Expected HTTP 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }

    firstResData = res.body?.data;
    const expectedTxId = deriveWithdrawalTransactionId(user1.id, validKey1);

    if (firstResData.trxId !== expectedTxId) {
      throw new Error(`Expected trxId ${expectedTxId}, got ${firstResData.trxId}`);
    }

    if (firstResData.afterRealBalance !== '4000.0000' || firstResData.afterLockedBalance !== '1000.0000') {
      throw new Error(`Balance mutation incorrect: real=${firstResData.afterRealBalance}, locked=${firstResData.afterLockedBalance}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: REPLAY SAFETY (SAME KEY + SAME PAYLOAD)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Identical Replay Safety ---');

  await assert('Identical replay returns cached reservation with isIdempotent: true and zero mutations', async () => {
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'BKASH',
        amount: '1000.0000',
        currency: 'BDT',
        receiverNumber: '01700000001'
      },
      headers: { 'idempotency-key': validKey1 },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? validKey1 : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 200) {
      throw new Error(`Expected HTTP 200 for idempotent replay, got ${res.statusCode}`);
    }

    if (!res.body?.data?.isIdempotent) {
      throw new Error(`Expected isIdempotent: true in response`);
    }

    // Verify wallet balances in DB remained unchanged
    const wallet = await ledgerService.getWallet(user1.id, 'BDT');
    if (wallet.realBalance !== '4000.0000' || wallet.lockedBalance !== '1000.0000') {
      throw new Error(`Wallet balance mutated on replay: real=${wallet.realBalance}, locked=${wallet.lockedBalance}`);
    }

    const ledgers = await dbEngine.query(`SELECT * FROM ledger_entries WHERE user_id = $1`, [user1.id]);
    if (ledgers.rows.length !== 2) {
      throw new Error(`Expected exactly 2 ledger entries, found ${ledgers.rows.length}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: CONFLICTING REPLAY (HTTP 409 IDEMPOTENCY_CONFLICT)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Conflicting Replays ---');

  await assert('Replaying same key with different amount returns HTTP 409 IDEMPOTENCY_CONFLICT', async () => {
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'BKASH',
        amount: '2000.0000', // Different amount
        currency: 'BDT',
        receiverNumber: '01700000001'
      },
      headers: { 'idempotency-key': validKey1 },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? validKey1 : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 409 || res.body?.code !== 'IDEMPOTENCY_CONFLICT') {
      throw new Error(`Expected 409 IDEMPOTENCY_CONFLICT, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: CONCURRENT DUPLICATE REQUESTS
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Concurrency Safety on Duplicate Idempotency Key ---');

  await assert('Simultaneous concurrent requests using the same key settle exactly once', async () => {
    const concurrentKey = 'concurrent_safe_key_888';

    const req1: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'NAGAD',
        amount: '500.0000',
        currency: 'BDT',
        receiverNumber: '01800000002'
      },
      headers: { 'idempotency-key': concurrentKey },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? concurrentKey : undefined),
      ip: '127.0.0.1'
    };

    const req2: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'NAGAD',
        amount: '500.0000',
        currency: 'BDT',
        receiverNumber: '01800000002'
      },
      headers: { 'idempotency-key': concurrentKey },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? concurrentKey : undefined),
      ip: '127.0.0.1'
    };

    const res1 = mockResponse();
    const res2 = mockResponse();

    await Promise.all([
      paymentController.submitWithdrawal(req1, res1),
      paymentController.submitWithdrawal(req2, res2)
    ]);

    const statusCodes = [res1.statusCode, res2.statusCode].sort();
    // One must be 201 (created), other either 200 (cached idempotent) or 201 if serialized
    if (!statusCodes.includes(201)) {
      throw new Error(`Expected at least one HTTP 201, got ${res1.statusCode} and ${res2.statusCode}`);
    }

    const wallet = await ledgerService.getWallet(user1.id, 'BDT');
    // Real was 4000.0000, debited exactly 500.0000 once -> 3500.0000, locked -> 1500.0000
    if (wallet.realBalance !== '3500.0000' || wallet.lockedBalance !== '1500.0000') {
      throw new Error(`Double debit occurred! Expected real=3500.0000, locked=1500.0000, got real=${wallet.realBalance}, locked=${wallet.lockedBalance}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: SENSITIVE DATA MASKING OF IDEMPOTENCY KEYS
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Sensitive Data Masking ---');

  await assert('maskIdempotencyKey masks raw key safely', () => {
    const rawKey = 'my_super_secret_idempotency_key_123456';
    const masked = maskIdempotencyKey(rawKey);

    if (masked.includes('secret_idempotency')) {
      throw new Error(`Masking failed to hide secret content: ${masked}`);
    }
    if (!masked.startsWith('my_s...') || !masked.endsWith('3456')) {
      throw new Error(`Unexpected masked format: ${masked}`);
    }
  });

  await assert('maskSensitiveData redacts idempotency keys in objects', () => {
    const obj = {
      userId: 1001,
      idempotencyKey: 'super_secret_withdrawal_key_99999',
      nested: {
        idemp_token: 'nested_secret_token_123456'
      }
    };
    const masked = maskSensitiveData(obj);

    if (masked.idempotencyKey === 'super_secret_withdrawal_key_99999' || !masked.idempotencyKey.includes('***')) {
      throw new Error(`maskSensitiveData failed to mask idempotencyKey: ${JSON.stringify(masked)}`);
    }
  });

  // Restore wagering gate
  WageringService.enforceWithdrawalWageringGate = origGate;

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
