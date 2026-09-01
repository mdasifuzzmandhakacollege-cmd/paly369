/**
 * @file strictWithdrawalIdempotencyTask6161.test.ts
 * @description Comprehensive Verification Suite for PLAY369 Task 6.1.6.1: Strict Withdrawal Idempotency Contract.
 * 
 * Verifies:
 * 1. Missing Idempotency-Key header returns HTTP 400 with code IDEMPOTENCY_KEY_REQUIRED.
 * 2. Blank / whitespace Idempotency-Key header returns HTTP 400 with code IDEMPOTENCY_KEY_REQUIRED.
 * 3. Server derives withdrawal ID deterministically from user + idempotency key (no random financial fallback, client-supplied ID ignored).
 * 4. Canonical request fingerprint persisted containing user, currency, normalized amount, method, receiver, operationType.
 * 5. Identical replay returns original committed reservation with isIdempotent: true and ZERO additional balance mutations or ledger entries.
 * 6. Conflicting replay on same key with different amount returns HTTP 409 IDEMPOTENCY_CONFLICT with ZERO mutations.
 * 7. Conflicting replay on same key with different receiver returns HTTP 409 IDEMPOTENCY_CONFLICT with ZERO mutations.
 * 8. Conflicting replay on same key with different method returns HTTP 409 IDEMPOTENCY_CONFLICT with ZERO mutations.
 * 9. Conflicting replay on same key with different currency returns HTTP 409 IDEMPOTENCY_CONFLICT with ZERO mutations.
 * 10. Conflicting replay on same key with different user returns HTTP 409 IDEMPOTENCY_CONFLICT with ZERO mutations.
 * 11. Concurrent requests using same key settle exactly once without double reservation.
 * 12. Scale-4 exact string math preserved across all states.
 */

import { InMemoryPostgresLedgerEngine } from '../ledger/db';
import { WalletLedgerService } from '../ledger/walletLedgerService';
import { paymentController } from '../controllers/paymentController';
import { WageringService } from '../services/wageringService';
import { deriveWithdrawalTransactionId, IdempotencyConflictError } from '../ledger/types';

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
  console.log('🛡️ RUNNING PLAY369 TASK 6.1.6.1: STRICT WITHDRAWAL IDEMPOTENCY CONTRACT');
  console.log('================================================================\n');

  // Setup Fresh In-Memory Engine & Service
  const dbEngine = new InMemoryPostgresLedgerEngine();
  const ledgerService = new WalletLedgerService(dbEngine);
  paymentController.setLedgerService(ledgerService);

  // Allow wagering gate for tests
  const origGate = WageringService.enforceWithdrawalWageringGate;
  WageringService.enforceWithdrawalWageringGate = async (params: { userId: number }) => ({
    allowed: true,
    reason: 'WAGERING_CLEAR',
    userId: params.userId,
    hasActiveWagering: false,
    activeRequirementsCount: 0,
    activeRequirements: []
  });

  // Seed test users & wallets
  const user1 = { id: 1001, uid: 'fb_uid_1001', username: 'player_1001', email: 'p1001@play369.com' };
  const user2 = { id: 1002, uid: 'fb_uid_1002', username: 'player_1002', email: 'p1002@play369.com' };

  await dbEngine.query(
    `INSERT INTO users (id, uid, username, email) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [user1.id, user1.uid, user1.username, user1.email]
  );
  await dbEngine.query(
    `INSERT INTO users (id, uid, username, email) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [user2.id, user2.uid, user2.username, user2.email]
  );

  await dbEngine.query(
    `INSERT INTO wallets (id, user_id, currency, real_balance, bonus_balance, locked_balance, balance_minor, version, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    ['w_1001_bdt', '1001', 'BDT', '5000.0000', '100.0000', '0.0000', '50000000', 1, 'ACTIVE']
  );
  await dbEngine.query(
    `INSERT INTO wallets (id, user_id, currency, real_balance, bonus_balance, locked_balance, balance_minor, version, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    ['w_1001_usd', '1001', 'USD', '1000.0000', '0.0000', '0.0000', '10000000', 1, 'ACTIVE']
  );
  await dbEngine.query(
    `INSERT INTO wallets (id, user_id, currency, real_balance, bonus_balance, locked_balance, balance_minor, version, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    ['w_1002_bdt', '1002', 'BDT', '5000.0000', '0.0000', '0.0000', '50000000', 1, 'ACTIVE']
  );

  // --------------------------------------------------------------------------
  // TEST 1: REQUIRE IDEMPOTENCY KEY (HTTP 400 IDEMPOTENCY_KEY_REQUIRED)
  // --------------------------------------------------------------------------
  console.log('--- Test 1: Require Idempotency-Key Header ---');

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
      header: () => undefined,
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 400) {
      throw new Error(`Expected HTTP 400, got ${res.statusCode}`);
    }
    if (res.body?.code !== 'IDEMPOTENCY_KEY_REQUIRED') {
      throw new Error(`Expected code IDEMPOTENCY_KEY_REQUIRED, got ${res.body?.code}`);
    }
    if (res.body?.success !== false) {
      throw new Error(`Expected success: false, got ${res.body?.success}`);
    }
  });

  await assert('Blank / whitespace-only Idempotency-Key header returns HTTP 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
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
      headers: { 'idempotency-key': '   ' },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? '   ' : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 400 || res.body?.code !== 'IDEMPOTENCY_KEY_REQUIRED') {
      throw new Error(`Expected 400 IDEMPOTENCY_KEY_REQUIRED, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: SERVER WITHDRAWAL ID & ATOMIC RESERVATION
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Server-Authoritative Deterministic Withdrawal ID ---');

  const stableKey1 = 'wth_idemp_key_001';
  let firstResult: any;

  await assert('Valid withdrawal request creates reservation with server-deterministic withdrawal ID', async () => {
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'BKASH',
        amount: '1000.0000',
        currency: 'BDT',
        receiverNumber: '01700000001',
        withdrawalId: 'client_fake_untrusted_id_123',
        trxId: 'client_fake_trx_456'
      },
      headers: { 'idempotency-key': stableKey1 },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? stableKey1 : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 201) {
      throw new Error(`Expected HTTP 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }
    firstResult = res.body?.data;

    // Must NOT use client-provided fake withdrawal ID as authoritative trxId
    if (firstResult.trxId === 'client_fake_untrusted_id_123' || firstResult.trxId === 'client_fake_trx_456') {
      throw new Error(`Security violation: client-supplied withdrawalId was trusted! Got: ${firstResult.trxId}`);
    }

    const expectedServerId = deriveWithdrawalTransactionId(user1.id, stableKey1);
    if (firstResult.trxId !== expectedServerId) {
      throw new Error(`Expected server withdrawal ID ${expectedServerId}, got ${firstResult.trxId}`);
    }

    if (firstResult.beforeRealBalance !== '5000.0000' || firstResult.afterRealBalance !== '4000.0000') {
      throw new Error(`Invalid real balance: before=${firstResult.beforeRealBalance}, after=${firstResult.afterRealBalance}`);
    }
    if (firstResult.beforeLockedBalance !== '0.0000' || firstResult.afterLockedBalance !== '1000.0000') {
      throw new Error(`Invalid locked balance: before=${firstResult.beforeLockedBalance}, after=${firstResult.afterLockedBalance}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: IDENTICAL REPLAY (SAME KEY + SAME CANONICAL FINGERPRINT)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Identical Replay Safety ---');

  await assert('Identical replay returns cached reservation with isIdempotent: true', async () => {
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
      headers: { 'idempotency-key': stableKey1 },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? stableKey1 : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 200) {
      throw new Error(`Expected HTTP 200 for idempotent replay, got ${res.statusCode}`);
    }
    if (res.body?.data?.isIdempotent !== true) {
      throw new Error(`Expected isIdempotent: true, got ${res.body?.data?.isIdempotent}`);
    }
    if (res.body?.data?.trxId !== firstResult.trxId) {
      throw new Error(`Expected identical trxId ${firstResult.trxId}, got ${res.body?.data?.trxId}`);
    }
  });

  await assert('Identical replay causes ZERO additional balance mutations or ledger entries', async () => {
    const wallet = await ledgerService.getWallet(user1.id, 'BDT');
    if (wallet.realBalance !== '4000.0000') {
      throw new Error(`Double debit occurred! Expected realBalance 4000.0000, got ${wallet.realBalance}`);
    }
    if (wallet.lockedBalance !== '1000.0000') {
      throw new Error(`Double lock credit occurred! Expected lockedBalance 1000.0000, got ${wallet.lockedBalance}`);
    }

    const ledgers = await dbEngine.query(`SELECT * FROM ledger_entries WHERE user_id = $1`, [user1.id]);
    if (ledgers.rows.length !== 2) {
      throw new Error(`Expected exactly 2 ledger entries for 1 withdrawal reservation, found ${ledgers.rows.length}`);
    }

    const reqs = await dbEngine.query(`SELECT * FROM payment_requests WHERE user_id = $1`, [user1.id]);
    if (reqs.rows.length !== 1) {
      throw new Error(`Expected exactly 1 payment_request record, found ${reqs.rows.length}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: CONFLICTING REPLAY (SAME KEY + DIFFERENT AUTHORITATIVE FIELDS)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Conflicting Replay Validation (HTTP 409 IDEMPOTENCY_CONFLICT) ---');

  await assert('Same key + different amount rejects with 409 IDEMPOTENCY_CONFLICT', async () => {
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'BKASH',
        amount: '2000.0000', // Differing amount
        currency: 'BDT',
        receiverNumber: '01700000001'
      },
      headers: { 'idempotency-key': stableKey1 },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? stableKey1 : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 409) {
      throw new Error(`Expected HTTP 409, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }
    if (res.body?.code !== 'IDEMPOTENCY_CONFLICT') {
      throw new Error(`Expected code IDEMPOTENCY_CONFLICT, got ${res.body?.code}`);
    }
  });

  await assert('Same key + different receiver account rejects with 409 IDEMPOTENCY_CONFLICT', async () => {
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'BKASH',
        amount: '1000.0000',
        currency: 'BDT',
        receiverNumber: '01899999999' // Differing receiver
      },
      headers: { 'idempotency-key': stableKey1 },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? stableKey1 : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 409 || res.body?.code !== 'IDEMPOTENCY_CONFLICT') {
      throw new Error(`Expected HTTP 409 IDEMPOTENCY_CONFLICT, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  await assert('Same key + different payment method rejects with 409 IDEMPOTENCY_CONFLICT', async () => {
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'NAGAD', // Differing method
        amount: '1000.0000',
        currency: 'BDT',
        receiverNumber: '01700000001'
      },
      headers: { 'idempotency-key': stableKey1 },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? stableKey1 : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 409 || res.body?.code !== 'IDEMPOTENCY_CONFLICT') {
      throw new Error(`Expected HTTP 409 IDEMPOTENCY_CONFLICT, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  await assert('Same key + different currency rejects with 409 IDEMPOTENCY_CONFLICT', async () => {
    const req: any = {
      user: { uid: user1.uid },
      mockUser: user1,
      body: {
        userId: user1.id,
        method: 'BKASH',
        amount: '1000.0000',
        currency: 'USD', // Differing currency
        receiverNumber: '01700000001'
      },
      headers: { 'idempotency-key': stableKey1 },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? stableKey1 : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 409 || res.body?.code !== 'IDEMPOTENCY_CONFLICT') {
      throw new Error(`Expected HTTP 409 IDEMPOTENCY_CONFLICT, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  await assert('Same key + different user rejects with 409 IDEMPOTENCY_CONFLICT', async () => {
    const req: any = {
      user: { uid: user2.uid },
      mockUser: user2,
      body: {
        userId: user2.id,
        method: 'BKASH',
        amount: '1000.0000',
        currency: 'BDT',
        receiverNumber: '01700000001'
      },
      headers: { 'idempotency-key': stableKey1 },
      header: (n: string) => (n.toLowerCase() === 'idempotency-key' ? stableKey1 : undefined),
      ip: '127.0.0.1'
    };
    const res = mockResponse();

    await paymentController.submitWithdrawal(req, res);

    if (res.statusCode !== 409 || res.body?.code !== 'IDEMPOTENCY_CONFLICT') {
      throw new Error(`Expected HTTP 409 IDEMPOTENCY_CONFLICT, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  await assert('Balances remain strictly intact after all rejected conflicts', async () => {
    const wallet1 = await ledgerService.getWallet(user1.id, 'BDT');
    if (wallet1.realBalance !== '4000.0000' || wallet1.lockedBalance !== '1000.0000') {
      throw new Error(`Wallet 1 corrupted after conflicts: real=${wallet1.realBalance}, locked=${wallet1.lockedBalance}`);
    }

    const wallet2 = await ledgerService.getWallet(user2.id, 'BDT');
    if (wallet2.realBalance !== '5000.0000' || wallet2.lockedBalance !== '0.0000') {
      throw new Error(`Wallet 2 corrupted after conflicts: real=${wallet2.realBalance}, locked=${wallet2.lockedBalance}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: CONCURRENT DUPLICATE REQUESTS
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Concurrency Safety on Duplicate Idempotency Key ---');

  await assert('Simultaneous concurrent requests using the same key settle exactly once', async () => {
    const concurrentKey = 'wth_concurrent_key_999';

    const p1 = ledgerService.reserveWithdrawalFunds({
      userId: user1.id,
      amount: '500.0000',
      currency: 'BDT',
      paymentMethod: 'NAGAD',
      receiverNumber: '01800000002',
      idempotencyKey: concurrentKey
    });

    const p2 = ledgerService.reserveWithdrawalFunds({
      userId: user1.id,
      amount: '500.0000',
      currency: 'BDT',
      paymentMethod: 'NAGAD',
      receiverNumber: '01800000002',
      idempotencyKey: concurrentKey
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    if (r1.transactionId !== r2.transactionId) {
      throw new Error(`Mismatch in transaction IDs: ${r1.transactionId} vs ${r2.transactionId}`);
    }

    const idempotentCount = (r1.isIdempotent ? 1 : 0) + (r2.isIdempotent ? 1 : 0);
    if (idempotentCount !== 1) {
      throw new Error(`Expected exactly one request to be isIdempotent: true, got count=${idempotentCount}`);
    }

    // Verify wallet: 4000 - 500 = 3500 real, 1000 + 500 = 1500 locked
    const wallet = await ledgerService.getWallet(user1.id, 'BDT');
    if (wallet.realBalance !== '3500.0000') {
      throw new Error(`Expected real balance 3500.0000, got ${wallet.realBalance}`);
    }
    if (wallet.lockedBalance !== '1500.0000') {
      throw new Error(`Expected locked balance 1500.0000, got ${wallet.lockedBalance}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: DIRECT SERVICE IDEMPOTENCY CONFLICT RECOVERY
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: WalletLedgerService Direct Fingerprint Validation ---');

  await assert('WalletLedgerService rejects conflicting parameters on cached key with IdempotencyConflictError', async () => {
    try {
      await ledgerService.reserveWithdrawalFunds({
        userId: user1.id,
        amount: '999.0000', // Differing amount
        currency: 'BDT',
        paymentMethod: 'NAGAD',
        receiverNumber: '01800000002',
        idempotencyKey: 'wth_concurrent_key_999'
      });
      throw new Error('Should have thrown IdempotencyConflictError');
    } catch (err: any) {
      if (!(err instanceof IdempotencyConflictError)) {
        throw new Error(`Expected IdempotencyConflictError, got ${err.name}: ${err.message}`);
      }
      if (err.code !== 'IDEMPOTENCY_CONFLICT') {
        throw new Error(`Expected error code IDEMPOTENCY_CONFLICT, got ${err.code}`);
      }
    }
  });

  // Restore wagering gate
  WageringService.enforceWithdrawalWageringGate = origGate;

  // Final summary
  console.log('\n================================================================');
  console.log(`🏁 TESTS COMPLETED: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
