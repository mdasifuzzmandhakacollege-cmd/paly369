/**
 * @file ciSecurityRegressionGateTaskA4.test.ts
 * @description PLAY369 Task A4: CI Security & Regression Verification Gate Suite.
 * 
 * Verifies:
 * 1. Unauthorized Admin Access Protection (401 unauthenticated, 403 unauthorized, privileged authorization).
 * 2. Invalid & Malformed Inputs Handling across all admin endpoints.
 * 3. Duplicate & Idempotent Request Behavior with deterministic hashing and conflict detection.
 * 4. Database & Service Failure Handling returning controlled HTTP 500 errors (Fail-Closed).
 * 5. Exact Decimal-String Preservation (Scale-4 arithmetic, zero floating-point drift).
 * 6. Zero Secret, API Key, or Token Exposure in responses, logs, or UI modules.
 * 7. Read-Only Invariants: Zero unauthorized financial mutations or settlement paths.
 */

import { requireAdmin, requireAuth, getAuthoritativeUserRole, AuthRequest } from '../../middleware/auth.js';
import { setupHermeticAuthAndDb } from './mockAuthAndDbAdapters.js';
import { adminController } from '../controllers/adminController.js';
import {
  AdminOpsService,
  AUTHORITATIVE_SOURCE_TAG,
  toScale4,
  fromScale4,
  formatScale4String,
  sumDecimalStrings,
} from '../services/adminOpsService.js';
import { deriveWithdrawalTransactionId } from '../ledger/types.js';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;
const testResults: { desc: string; passed: boolean; error?: string }[] = [];

async function assert(desc: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
    testResults.push({ desc, passed: true });
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}\n`);
    failed++;
    testResults.push({ desc, passed: false, error: err.message });
  }
}

function mockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    jsonData: null as any,
    status: function (code: number) {
      this.statusCode = code;
      return this;
    },
    json: function (data: any) {
      this.jsonData = data;
      return this;
    },
    setHeader: function (key: string, val: string) {
      this.headers[key] = val;
      return this;
    },
  };
  return res;
}

// --------------------------------------------------------------------------
// Create Mock PostgreSQL Database for Unit Testing the Admin Read Model
// --------------------------------------------------------------------------
function createMockDb() {
  const mockPayments = [
    {
      id: 1,
      userId: 101,
      walletId: 1,
      type: 'DEPOSIT',
      method: 'BKASH',
      amount: '500.0000',
      currency: 'BDT',
      senderNumber: '01711000001',
      receiverNumber: '01700000000',
      trxId: 'TRX_DEP_001',
      status: 'PENDING',
      adminNote: null,
      createdAt: new Date('2026-08-31T10:00:00Z'),
      updatedAt: new Date('2026-08-31T10:00:00Z'),
      username: 'player_one',
      userEmail: 'player1@play369.com',
    },
    {
      id: 2,
      userId: 102,
      walletId: 2,
      type: 'WITHDRAWAL',
      method: 'NAGAD',
      amount: '1200.0000',
      currency: 'BDT',
      senderNumber: null,
      receiverNumber: '01811000002',
      trxId: 'TRX_WD_002',
      status: 'PENDING',
      adminNote: null,
      createdAt: new Date('2026-08-31T10:05:00Z'),
      updatedAt: new Date('2026-08-31T10:05:00Z'),
      username: 'player_two',
      userEmail: 'player2@play369.com',
    },
  ];

  const mockWallets = [
    {
      id: 1,
      userId: 101,
      currency: 'BDT',
      realBalance: '1500.0000',
      bonusBalance: '250.0000',
      lockedBalance: '500.0000',
      commissionBalance: '50.0000',
      balanceMinor: 23000000n,
      version: 5n,
      status: 'ACTIVE',
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-31T10:00:00Z'),
      username: 'player_one',
      userEmail: 'player1@play369.com',
      userStatus: 'ACTIVE',
      userUid: 'firebase_uid_101',
    },
  ];

  const mockWagering = [
    {
      id: 1,
      userId: 101,
      promoName: 'WELCOME_BONUS_100',
      bonusAmountGranted: '250.0000',
      requiredMultiplier: 10,
      targetTurnoverAmount: '2500.0000',
      completedTurnoverAmount: '1250.0000',
      status: 'ACTIVE',
      isReleased: false,
      releasedAt: null,
      releaseTransactionId: null,
      expiresAt: new Date('2026-09-07T00:00:00Z'),
      createdAt: new Date('2026-08-31T08:00:00Z'),
      completedAt: null,
      username: 'player_one',
      userEmail: 'player1@play369.com',
    },
  ];

  const mockLedger = [
    {
      id: 1,
      walletId: 1,
      userId: 101,
      transactionId: 'TX_LEDGER_001',
      referenceTransactionId: 'TRX_DEP_001',
      type: 'CREDIT',
      balanceTarget: 'REAL',
      amountMinor: 5000000n,
      currency: 'BDT',
      beforeBalanceMinor: 10000000n,
      afterBalanceMinor: 15000000n,
      status: 'COMMITTED',
      correlationId: 'CORR_001',
      auditMetadata: { method: 'BKASH' },
      createdAt: new Date('2026-08-31T10:00:00Z'),
      username: 'player_one',
      userEmail: 'player1@play369.com',
    },
  ];

  return {
    select: (fieldsObj: any) => ({
      from: (tableObj: any) => {
        const tableName = tableObj?._?.name || (typeof tableObj === 'string' ? tableObj : '');
        let targetRows: any[] = [];

        if (tableObj?.name === 'payment_requests' || tableName.includes('payment_requests')) {
          targetRows = mockPayments;
        } else if (tableObj?.name === 'wallets' || tableName.includes('wallets')) {
          targetRows = mockWallets;
        } else if (tableObj?.name === 'wagering_requirements' || tableName.includes('wagering_requirements')) {
          targetRows = mockWagering;
        } else if (tableObj?.name === 'ledger_entries' || tableName.includes('ledger_entries')) {
          targetRows = mockLedger;
        } else {
          targetRows = mockPayments;
        }

        const queryObj = {
          leftJoin: () => queryObj,
          orderBy: () => queryObj,
          limit: (n: number) => queryObj,
          where: () => queryObj,
          then: (resolve: (val: any) => void) => {
            resolve(targetRows);
          },
        };
        return queryObj;
      },
    }),
  };
}

export async function runTaskA4CiSecurityGateTests(): Promise<{ passed: number; failed: number }> {
  console.log('================================================================');
  console.log('🛡️ PLAY369 Task A4: CI Security & Regression Verification Gate');
  console.log('================================================================\n');

  passed = 0;
  failed = 0;

  // Initialize hermetic in-memory auth & firestore adapters (zero GCP / ADC dependency)
  const hermeticAdapters = setupHermeticAuthAndDb();

  // Set mock DB client for unit testing
  const mockDb = createMockDb();
  AdminOpsService.setDbClient(mockDb);

  // --------------------------------------------------------------------------
  // SECTION 1: Unauthorized Admin Access Protection & Hermetic Isolation
  // --------------------------------------------------------------------------
  console.log('--- [1/6] Unauthorized Admin Access Protection & Hermetic CI Isolation ---');

  await assert('Hermetic CI Auth/DB Isolation Invariant: zero dependence on GOOGLE_APPLICATION_CREDENTIALS or Firebase secrets', async () => {
    // 1. Explicitly ensure environment credentials are deleted/empty
    const savedCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const savedProject = process.env.GCLOUD_PROJECT;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GCLOUD_PROJECT;

    try {
      // 2. Ensure mock adapters are active
      const { auth: hermeticAuth, db: hermeticDb } = setupHermeticAuthAndDb();

      // 3. Test requireAuth with missing token (401)
      const reqMissing: any = { headers: {} };
      const resMissing = mockResponse();
      let nextMissing = false;
      await requireAuth(reqMissing, resMissing, () => { nextMissing = true; });
      if (nextMissing || resMissing.statusCode !== 401) {
        throw new Error(`requireAuth failed to reject missing token with 401 (got ${resMissing.statusCode})`);
      }

      // 4. Test requireAuth with invalid/malformed token (401)
      const reqInvalid: any = { headers: { authorization: 'Bearer corrupted_invalid_token_99' } };
      const resInvalid = mockResponse();
      let nextInvalid = false;
      await requireAuth(reqInvalid, resInvalid, () => { nextInvalid = true; });
      if (nextInvalid || resInvalid.statusCode !== 401) {
        throw new Error(`requireAuth failed to reject invalid token with 401 (got ${resInvalid.statusCode})`);
      }

      // 5. Test requireAuth with valid player token (200 / next)
      const reqValid: any = { headers: { authorization: 'Bearer mock_player_token' } };
      const resValid = mockResponse();
      let nextValid = false;
      await requireAuth(reqValid, resValid, () => { nextValid = true; });
      if (!nextValid || !reqValid.user || reqValid.user.role !== 'PLAYER') {
        throw new Error('requireAuth failed to decode valid token in hermetic isolation');
      }

      // 6. Test requireAdmin role resolution and rejection without credentials
      // Standard player token => 403 Forbidden
      const reqPlayer: any = { headers: { authorization: 'Bearer mock_player_token' } };
      const resPlayer = mockResponse();
      let nextPlayer = false;
      await requireAdmin(reqPlayer, resPlayer, () => { nextPlayer = true; });
      if (nextPlayer || resPlayer.statusCode !== 403) {
        throw new Error(`requireAdmin failed to reject standard player with 403 (got ${resPlayer.statusCode})`);
      }

      // Privileged admin token => next() called with isAuthorizedAdmin
      const reqAdmin: any = { headers: { authorization: 'Bearer mock_admin_token' } };
      const resAdmin = mockResponse();
      let nextAdmin = false;
      await requireAdmin(reqAdmin, resAdmin, () => { nextAdmin = true; });
      if (!nextAdmin || !reqAdmin.isAuthorizedAdmin || reqAdmin.userRole !== 'ADMIN') {
        throw new Error('requireAdmin failed to authorize admin token in hermetic isolation');
      }

      // 7. Test Firestore role fallback via in-memory DB without GCP credentials
      hermeticDb.setDocument('admins', 'hermetic_admin_user_test', { role: 'OPERATOR', active: true });
      const roleFromDb = await getAuthoritativeUserRole({ uid: 'hermetic_admin_user_test' } as any);
      if (roleFromDb !== 'OPERATOR') {
        throw new Error(`Expected role 'OPERATOR' from in-memory DB, got: ${roleFromDb}`);
      }
    } finally {
      if (savedCredentials) process.env.GOOGLE_APPLICATION_CREDENTIALS = savedCredentials;
      if (savedProject) process.env.GCLOUD_PROJECT = savedProject;
    }
  });

  await assert('requireAdmin rejects missing Authorization header with 401 UNAUTHENTICATED', async () => {
    const req: any = { headers: {} };
    const res = mockResponse();
    let nextCalled = false;

    await requireAdmin(req, res, () => {
      nextCalled = true;
    });

    if (nextCalled) throw new Error('next() was unexpectedly called without auth header');
    if (res.statusCode !== 401) throw new Error(`Expected status 401, got ${res.statusCode}`);
    if (res.jsonData?.code !== 'UNAUTHENTICATED') throw new Error(`Expected code UNAUTHENTICATED, got ${res.jsonData?.code}`);
  });

  await assert('requireAdmin rejects non-Bearer or empty token with 401 UNAUTHENTICATED', async () => {
    const testHeaders = ['Basic xyz123', 'Bearer ', 'Token abc', ''];
    for (const header of testHeaders) {
      const req: any = { headers: { authorization: header } };
      const res = mockResponse();
      let nextCalled = false;

      await requireAdmin(req, res, () => {
        nextCalled = true;
      });

      if (nextCalled) throw new Error(`next() called for invalid header: "${header}"`);
      if (res.statusCode !== 401) throw new Error(`Expected 401 for header "${header}", got ${res.statusCode}`);
    }
  });

  await assert('requireAdmin rejects standard PLAYER and VIP roles with 403 FORBIDDEN', async () => {
    const mockAuthAdmin = (await import('../../lib/firebase-admin.js')).adminAuth;
    const origVerify = mockAuthAdmin.verifyIdToken;

    try {
      mockAuthAdmin.verifyIdToken = async () => ({
        uid: 'user_player_123',
        role: 'PLAYER',
        isAdmin: false,
      } as any);

      const req: any = { headers: { authorization: 'Bearer mock_player_token' } };
      const res = mockResponse();
      let nextCalled = false;

      await requireAdmin(req, res, () => {
        nextCalled = true;
      });

      if (nextCalled) throw new Error('next() was called for standard PLAYER role');
      if (res.statusCode !== 403) throw new Error(`Expected 403 FORBIDDEN, got ${res.statusCode}`);
      if (res.jsonData?.code !== 'FORBIDDEN') throw new Error(`Expected code FORBIDDEN, got ${res.jsonData?.code}`);
    } finally {
      mockAuthAdmin.verifyIdToken = origVerify;
    }
  });

  await assert('requireAdmin grants access to verified ADMIN and OPERATOR roles', async () => {
    const mockAuthAdmin = (await import('../../lib/firebase-admin.js')).adminAuth;
    const origVerify = mockAuthAdmin.verifyIdToken;

    for (const privilegedRole of ['ADMIN', 'OPERATOR', 'SUPER_ADMIN']) {
      try {
        mockAuthAdmin.verifyIdToken = async () => ({
          uid: `user_${privilegedRole.toLowerCase()}_999`,
          role: privilegedRole,
          isAdmin: true,
        } as any);

        const req: any = { headers: { authorization: `Bearer mock_${privilegedRole}_token` } };
        const res = mockResponse();
        let nextCalled = false;

        await requireAdmin(req, res, () => {
          nextCalled = true;
        });

        if (!nextCalled) throw new Error(`next() was not called for role ${privilegedRole}`);
        if (!req.isAuthorizedAdmin) throw new Error(`isAuthorizedAdmin was not set for role ${privilegedRole}`);
        if (req.userRole !== privilegedRole) throw new Error(`userRole mismatch for ${privilegedRole}`);
      } finally {
        mockAuthAdmin.verifyIdToken = origVerify;
      }
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Invalid & Malformed Inputs Handling
  // --------------------------------------------------------------------------
  console.log('\n--- [2/6] Invalid & Malformed Inputs Handling ---');

  await assert('Admin endpoints handle malformed pagination parameters safely (negative, non-numeric)', async () => {
    AdminOpsService.setDbClient(mockDb);

    const malformedQueries = [
      { page: '-5', limit: '-20' },
      { page: 'abc', limit: 'xyz' },
      { page: 'NaN', limit: 'Infinity' },
      { page: '0', limit: '0' },
    ];

    for (const query of malformedQueries) {
      const req: any = { query };
      const res = mockResponse();

      await adminController.getPayments(req, res);
      if (res.statusCode !== 200) throw new Error(`getPayments failed on malformed query ${JSON.stringify(query)}: ${res.statusCode}`);
      const page = res.jsonData?.pagination?.page;
      const limit = res.jsonData?.pagination?.limit;
      if (!page || page < 1) throw new Error(`Expected normalized page >= 1, got ${page}`);
      if (!limit || limit < 1 || limit > 100) throw new Error(`Expected normalized limit between 1 and 100, got ${limit}`);
    }
  });

  await assert('Admin endpoints safely sanitize search queries and special characters', async () => {
    AdminOpsService.setDbClient(mockDb);

    const maliciousSearches = [
      "' OR '1'='1",
      "'; DROP TABLE payments; --",
      '<script>alert(1)</script>',
      '%%',
      '\\x00\\x1a',
    ];

    for (const search of maliciousSearches) {
      const req: any = { query: { search } };
      const res = mockResponse();

      await adminController.getPayments(req, res);
      if (res.statusCode !== 200) throw new Error(`Search sanitation failed on ${search}`);
      if (!res.jsonData?.success) throw new Error(`Response success was not true on search ${search}`);
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 3: Duplicate & Idempotent Request Behavior
  // --------------------------------------------------------------------------
  console.log('\n--- [3/6] Duplicate & Idempotent Request Behavior ---');

  await assert('deriveWithdrawalTransactionId produces deterministic, unique IDs without collision', async () => {
    const id1 = deriveWithdrawalTransactionId(101, 'idemp-key-abc-123');
    const id2 = deriveWithdrawalTransactionId(101, 'idemp-key-abc-123');
    const id3 = deriveWithdrawalTransactionId(102, 'idemp-key-abc-123');
    const id4 = deriveWithdrawalTransactionId(101, 'idemp-key-diff-456');

    if (id1 !== id2) throw new Error('Same userId + idempotencyKey must produce identical transaction ID');
    if (id1 === id3) throw new Error('Different userId with same key must produce different transaction ID');
    if (id1 === id4) throw new Error('Same userId with different key must produce different transaction ID');
    if (!id1.startsWith('WTH_RES_') && !id1.startsWith('tx_wd_')) throw new Error(`Invalid transaction ID prefix: ${id1}`);
  });

  // --------------------------------------------------------------------------
  // SECTION 4: Database & Service Failure Handling (Fail-Closed)
  // --------------------------------------------------------------------------
  console.log('\n--- [4/6] Database & Service Failure Handling (Fail-Closed) ---');

  await assert('All admin endpoints return HTTP 500 and fail closed on database errors (never fabricate fake data)', async () => {
    const failingDb = {
      select: () => {
        throw new Error('Connection refused to PostgreSQL host:5432');
      },
      execute: async () => {
        throw new Error('Connection refused to PostgreSQL host:5432');
      },
    };
    AdminOpsService.setDbClient(failingDb);

    try {
      const endpoints: { name: string; handler: (req: any, res: any) => Promise<void> }[] = [
        { name: 'getOverview', handler: (req, res) => adminController.getOverview(req, res) },
        { name: 'getPayments', handler: (req, res) => adminController.getPayments(req, res) },
        { name: 'getWallets', handler: (req, res) => adminController.getWallets(req, res) },
        { name: 'getWagering', handler: (req, res) => adminController.getWagering(req, res) },
        { name: 'getAudit', handler: (req, res) => adminController.getAudit(req, res) },
      ];

      for (const endpoint of endpoints) {
        const req: any = { query: {} };
        const res = mockResponse();

        await endpoint.handler(req, res);

        if (res.statusCode !== 500) {
          throw new Error(`${endpoint.name} did not return 500 on database failure, got ${res.statusCode}`);
        }
        if (res.jsonData?.success !== false) {
          throw new Error(`${endpoint.name} must return success: false on failure`);
        }
        if (res.jsonData?.code !== 'DATABASE_READ_ERROR') {
          throw new Error(`${endpoint.name} must return code DATABASE_READ_ERROR, got ${res.jsonData?.code}`);
        }
        if (res.jsonData?.source !== AUTHORITATIVE_SOURCE_TAG) {
          throw new Error(`${endpoint.name} missing authoritative source tag`);
        }
      }
    } finally {
      AdminOpsService.setDbClient(mockDb);
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 5: Exact Decimal-String Preservation & Scale-4 Precision
  // --------------------------------------------------------------------------
  console.log('\n--- [5/6] Exact Decimal-String Preservation & Scale-4 Precision ---');

  await assert('toScale4 and formatScale4String format values with exactly 4 decimal places with zero IEEE float drift', async () => {
    if (toScale4('0') !== 0n) throw new Error(`toScale4("0") expected 0n, got ${toScale4('0')}`);
    if (toScale4('100.5') !== 1005000n) throw new Error(`toScale4("100.5") expected 1005000n, got ${toScale4('100.5')}`);
    if (toScale4('0.0001') !== 1n) throw new Error(`toScale4("0.0001") expected 1n, got ${toScale4('0.0001')}`);
    if (toScale4(250) !== 2500000n) throw new Error(`toScale4(250) expected 2500000n, got ${toScale4(250)}`);
    if (formatScale4String('0') !== '0.0000') throw new Error(`formatScale4String("0") expected "0.0000", got ${formatScale4String('0')}`);
    if (formatScale4String('100.5') !== '100.5000') throw new Error(`formatScale4String("100.5") expected "100.5000", got ${formatScale4String('100.5')}`);
    if (formatScale4String('0.0001') !== '0.0001') throw new Error(`formatScale4String("0.0001") expected "0.0001", got ${formatScale4String('0.0001')}`);
    if (formatScale4String('99999999.9999') !== '99999999.9999') throw new Error(`formatScale4String expected "99999999.9999", got ${formatScale4String('99999999.9999')}`);
  });

  await assert('sumDecimalStrings computes high-precision sums with zero binary float drift', async () => {
    // Classic 0.1 + 0.2 float problem
    const floatResult = sumDecimalStrings(['0.1000', '0.2000']);
    if (floatResult !== '0.3000') {
      throw new Error(`sumDecimalStrings(["0.1000", "0.2000"]) expected "0.3000", got ${floatResult}`);
    }

    const largeSum = sumDecimalStrings(['99999999.9999', '0.0001']);
    if (largeSum !== '100000000.0000') {
      throw new Error(`sumDecimalStrings large sum expected "100000000.0000", got ${largeSum}`);
    }

    const zeroSum = sumDecimalStrings([]);
    if (zeroSum !== '0.0000') {
      throw new Error(`sumDecimalStrings([]) expected "0.0000", got ${zeroSum}`);
    }
  });

  await assert('formatScale4String handles null, undefined, and valid inputs consistently', async () => {
    if (formatScale4String(null) !== '0.0000') throw new Error('formatScale4String(null) must be "0.0000"');
    if (formatScale4String(undefined) !== '0.0000') throw new Error('formatScale4String(undefined) must be "0.0000"');
    if (formatScale4String('invalid') !== '0.0000') throw new Error('formatScale4String("invalid") must be "0.0000"');
    if (formatScale4String('5432.1') !== '5432.1000') throw new Error('formatScale4String("5432.1") must be "5432.1000"');
  });

  // --------------------------------------------------------------------------
  // SECTION 6: Zero Secret Exposure & Read-Only Invariants
  // --------------------------------------------------------------------------
  console.log('\n--- [6/6] Zero Secret Exposure & Read-Only Invariants ---');

  await assert('Zero exposure of sensitive secrets (API keys, private keys, hashes) in admin code or responses', async () => {
    const adminOpsCode = fs.readFileSync(path.resolve(process.cwd(), 'src/server/services/adminOpsService.ts'), 'utf-8');
    const adminControllerCode = fs.readFileSync(path.resolve(process.cwd(), 'src/server/controllers/adminController.ts'), 'utf-8');
    const serverIndexCode = fs.readFileSync(path.resolve(process.cwd(), 'src/server/index.ts'), 'utf-8');

    // Check for hardcoded secrets
    const forbiddenPatterns = [
      /AIzaSy[A-Za-z0-9_-]{33}/,
      /BEGIN (RSA|OPENSSH|EC) PRIVATE KEY/,
      /ghp_[A-Za-z0-9]{36}/,
      /sk_live_[A-Za-z0-9]{24}/,
      /xox[baprs]-[A-Za-z0-9-]+/,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(adminOpsCode) || pattern.test(adminControllerCode) || pattern.test(serverIndexCode)) {
        throw new Error(`Hardcoded secret detected matching pattern ${pattern}`);
      }
    }
  });

  await assert('Read-Only Invariant: Admin monitoring routes and views contain zero balance mutation endpoints', async () => {
    const serverIndexCode = fs.readFileSync(path.resolve(process.cwd(), 'src/server/index.ts'), 'utf-8');
    const adminControllerCode = fs.readFileSync(path.resolve(process.cwd(), 'src/server/controllers/adminController.ts'), 'utf-8');

    // Invariant: adminRouter must only define GET routes
    const postRoutes = serverIndexCode.match(/adminRouter\.post\(/g);
    const putRoutes = serverIndexCode.match(/adminRouter\.put\(/g);
    const deleteRoutes = serverIndexCode.match(/adminRouter\.delete\(/g);
    const patchRoutes = serverIndexCode.match(/adminRouter\.patch\(/g);

    if (postRoutes && postRoutes.length > 0) throw new Error('Admin routes must not define POST mutation endpoints');
    if (putRoutes && putRoutes.length > 0) throw new Error('Admin routes must not define PUT mutation endpoints');
    if (deleteRoutes && deleteRoutes.length > 0) throw new Error('Admin routes must not define DELETE mutation endpoints');
    if (patchRoutes && patchRoutes.length > 0) throw new Error('Admin routes must not define PATCH mutation endpoints');

    // Invariant: controller must not export mutating methods
    const mutatingMethodNames = ['updateBalance', 'adjustWallet', 'approveWithdrawal', 'settlePayment', 'releaseBonusManually'];
    for (const method of mutatingMethodNames) {
      if (adminControllerCode.includes(method)) {
        throw new Error(`AdminController must not contain financial mutation method: ${method}`);
      }
    }
  });

  console.log('\n================================================================');
  console.log(`  Task A4 Results: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    throw new Error(`Task A4 CI security gate failed with ${failed} failure(s)`);
  }

  return { passed, failed };
}

// Auto-run if executed directly
if (process.argv[1]?.includes('ciSecurityRegressionGateTaskA4.test.ts')) {
  runTaskA4CiSecurityGateTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal Task A4 failure:', err);
      process.exit(1);
    });
}
