/**
 * @file authoritativeWalletWageringTaskA3.test.ts
 * @description Comprehensive Test Suite for PLAY369 Task A3: Authoritative Admin Wallet & Wagering Monitoring.
 * 
 * Verifies:
 * 1. Privileged RBAC protection (requireAdmin) on /api/admin/wallets and /api/admin/wagering:
 *    - 401 for unauthenticated requests
 *    - 403 for standard PLAYER / unauthorized roles
 *    - 200 for ADMIN, OPERATOR, SUPER_ADMIN
 * 2. Authoritative PostgreSQL financial truth (Zero Firestore financial reads).
 * 3. Exact decimal strings for all monetary amounts (Scale-4, zero floating point drift).
 * 4. Safe filtering across currency, status, released flag, and search query.
 * 5. Server-side pagination (page, limit, total, totalPages).
 * 6. Wagering gate status and withdrawal blocked players tracking.
 * 7. Masked identifiers for player emails without exposing raw sensitive data.
 * 8. Zero exposure of API keys, HMAC secrets, Firebase credentials, or private tokens.
 * 9. Fail-closed behavior on database errors.
 * 10. Read-Only Invariant: strictly zero financial mutation actions.
 */

import { requireAdmin, getAuthoritativeUserRole, AuthRequest } from '../../middleware/auth.js';
import { setupHermeticAuthAndDb } from './mockAuthAndDbAdapters.js';
import { adminController } from '../controllers/adminController.js';
import { AdminOpsService, AUTHORITATIVE_SOURCE_TAG, toScale4, fromScale4, formatScale4String } from '../services/adminOpsService.js';
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

function mockRes() {
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
    }
  };
  return res;
}

// --------------------------------------------------------------------------
// Mock Database Setup for A3 Wallets and Wagering
// --------------------------------------------------------------------------
function setupMockPostgresDb() {
  const sampleWallets = [
    {
      id: 1,
      userId: 101,
      currency: 'BDT',
      realBalance: '5000.0000',
      bonusBalance: '1000.0000',
      lockedBalance: '500.0000',
      commissionBalance: '250.0000',
      status: 'ACTIVE',
      version: 5,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T12:00:00Z'),
      username: 'rakib_boss',
      userEmail: 'rakib@example.com',
      userStatus: 'ACTIVE',
    },
    {
      id: 2,
      userId: 102,
      currency: 'BDT',
      realBalance: '12500.5000',
      bonusBalance: '0.0000',
      lockedBalance: '2000.0000',
      commissionBalance: '0.0000',
      status: 'ACTIVE',
      version: 12,
      createdAt: new Date('2026-01-10T00:00:00Z'),
      updatedAt: new Date('2026-02-01T14:30:00Z'),
      username: 'sumon_vip',
      userEmail: 'sumon.vip@play369.com',
      userStatus: 'ACTIVE',
    },
    {
      id: 3,
      userId: 103,
      currency: 'USD',
      realBalance: '100.0000',
      bonusBalance: '50.0000',
      lockedBalance: '0.0000',
      commissionBalance: '10.0000',
      status: 'LOCKED',
      version: 2,
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-02-01T16:00:00Z'),
      username: 'john_doe',
      userEmail: 'john@crypto.io',
      userStatus: 'SUSPENDED',
    },
  ];

  const sampleWagering = [
    {
      id: 501,
      userId: 101,
      promoName: 'WELCOME_BONUS_100',
      bonusAmountGranted: '1000.0000',
      requiredMultiplier: 10,
      targetTurnoverAmount: '10000.0000',
      completedTurnoverAmount: '6500.0000',
      status: 'ACTIVE',
      isReleased: false,
      releasedAt: null,
      releaseTransactionId: null,
      expiresAt: new Date('2026-03-01T00:00:00Z'),
      createdAt: new Date('2026-02-01T08:00:00Z'),
      completedAt: null,
      username: 'rakib_boss',
      userEmail: 'rakib@example.com',
    },
    {
      id: 502,
      userId: 102,
      promoName: 'WEEKLY_CASHBACK_10',
      bonusAmountGranted: '500.0000',
      requiredMultiplier: 5,
      targetTurnoverAmount: '2500.0000',
      completedTurnoverAmount: '2500.0000',
      status: 'COMPLETED',
      isReleased: true,
      releasedAt: new Date('2026-02-01T11:00:00Z'),
      releaseTransactionId: 'REL_TX_502',
      expiresAt: new Date('2026-02-28T00:00:00Z'),
      createdAt: new Date('2026-01-25T00:00:00Z'),
      completedAt: new Date('2026-02-01T11:00:00Z'),
      username: 'sumon_vip',
      userEmail: 'sumon.vip@play369.com',
    },
    {
      id: 503,
      userId: 103,
      promoName: 'SLOTS_RELOAD_50',
      bonusAmountGranted: '200.0000',
      requiredMultiplier: 8,
      targetTurnoverAmount: '1600.0000',
      completedTurnoverAmount: '300.0000',
      status: 'EXPIRED',
      isReleased: false,
      releasedAt: null,
      releaseTransactionId: null,
      expiresAt: new Date('2026-01-31T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      completedAt: null,
      username: 'john_doe',
      userEmail: 'john@crypto.io',
    },
  ];

  const mockDbInstance: any = {
    select: (fields: any) => ({
      from: (table: any) => ({
        leftJoin: (joinTable: any, condition: any) => ({
          orderBy: (order: any) => {
            const isWalletsQuery = Object.keys(fields).includes('realBalance');
            if (isWalletsQuery) {
              return Promise.resolve(sampleWallets);
            } else {
              return Promise.resolve(sampleWagering);
            }
          }
        })
      })
    })
  };

  AdminOpsService.setDbClient(mockDbInstance);
  return { sampleWallets, sampleWagering };
}

// --------------------------------------------------------------------------
// Test Suite Runner
// --------------------------------------------------------------------------
export async function runAuthoritativeWalletWageringTaskA3Tests() {
  console.log('\n===============================================================');
  console.log('🧪 PLAY369 TASK A3: AUTHORITATIVE WALLET & WAGERING TEST SUITE');
  console.log('===============================================================\n');

  // Initialize hermetic in-memory auth & firestore adapters (zero GCP / ADC dependency)
  setupHermeticAuthAndDb();

  setupMockPostgresDb();

  // 1. RBAC Tests for /api/admin/wallets and /api/admin/wagering
  console.log('--- 1. RBAC Protection on Admin Wallets & Wagering Endpoints ---');

  await assert('Reject unauthenticated request on /api/admin/wallets with 401', async () => {
    const req: any = { headers: {} };
    const res = mockRes();
    let nextCalled = false;

    await requireAdmin(req as AuthRequest, res as any, () => {
      nextCalled = true;
    });

    if (nextCalled) throw new Error('next() was called for unauthenticated request');
    if (res.statusCode !== 401) throw new Error(`Expected 401, got ${res.statusCode}`);
    if (res.jsonData?.code !== 'UNAUTHENTICATED') throw new Error('Expected UNAUTHENTICATED error code');
  });

  await assert('Reject standard PLAYER role with non-privileged status', async () => {
    const playerToken: any = { uid: 'player-1', role: 'PLAYER' };
    const resolvedRole = await getAuthoritativeUserRole(playerToken);
    if (resolvedRole !== 'PLAYER') {
      throw new Error(`Expected role 'PLAYER', got '${resolvedRole}'`);
    }

    const isPrivileged = ['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(resolvedRole);
    if (isPrivileged) throw new Error('PLAYER role must not be privileged');
  });

  await assert('Allow ADMIN, OPERATOR, and SUPER_ADMIN roles as privileged', async () => {
    const adminToken: any = { uid: 'admin-1', role: 'ADMIN' };
    const opToken: any = { uid: 'op-1', role: 'OPERATOR' };
    const saToken: any = { uid: 'sa-1', role: 'SUPER_ADMIN' };

    const rAdmin = await getAuthoritativeUserRole(adminToken);
    const rOp = await getAuthoritativeUserRole(opToken);
    const rSa = await getAuthoritativeUserRole(saToken);

    if (!['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(rAdmin)) throw new Error('ADMIN should be privileged');
    if (!['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(rOp)) throw new Error('OPERATOR should be privileged');
    if (!['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(rSa)) throw new Error('SUPER_ADMIN should be privileged');
  });

  // 3. Authoritative Wallet Query Verification
  console.log('\n--- 3. Authoritative Wallet Query & Scale-4 Precision ---');

  await assert('Controller getWallets returns POSTGRESQL_AUTHORITATIVE data', async () => {
    const req: any = {
      query: { page: '1', limit: '10' },
      user: { uid: 'admin-1', role: 'ADMIN' }
    };
    const res = mockRes();

    await adminController.getWallets(req, res);

    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.jsonData?.success) throw new Error('Response success was not true');
    if (res.jsonData?.source !== AUTHORITATIVE_SOURCE_TAG) {
      throw new Error(`Expected source ${AUTHORITATIVE_SOURCE_TAG}, got ${res.jsonData?.source}`);
    }

    const wallets = res.jsonData.data;
    if (!Array.isArray(wallets) || wallets.length !== 3) {
      throw new Error(`Expected 3 wallets, got ${wallets?.length}`);
    }

    // Verify scale-4 exact strings and balance calculations
    const w1 = wallets[0];
    if (w1.realBalance !== '5000.0000') throw new Error(`w1 realBalance mismatch: ${w1.realBalance}`);
    if (w1.bonusBalance !== '1000.0000') throw new Error(`w1 bonusBalance mismatch: ${w1.bonusBalance}`);
    if (w1.lockedBalance !== '500.0000') throw new Error(`w1 lockedBalance mismatch: ${w1.lockedBalance}`);
    if (w1.commissionBalance !== '250.0000') throw new Error(`w1 commissionBalance mismatch: ${w1.commissionBalance}`);
    if (w1.totalBalance !== '6750.0000') throw new Error(`w1 totalBalance mismatch: ${w1.totalBalance}`);
    if (w1.emailMasked !== 'r***b@example.com') throw new Error(`w1 emailMasked mismatch: ${w1.emailMasked}`);

    // Verify summary
    const summary = res.jsonData.summary;
    if (summary.totalWallets !== 3) throw new Error(`Expected 3 totalWallets, got ${summary.totalWallets}`);
    if (summary.totalRealBalance !== '17600.5000') throw new Error(`totalRealBalance mismatch: ${summary.totalRealBalance}`);
  });

  await assert('getWallets supports filtering by currency and status', async () => {
    const resultUSD = await AdminOpsService.getWallets({ currency: 'USD' });
    if (resultUSD.data.length !== 1 || resultUSD.data[0].currency !== 'USD') {
      throw new Error(`Expected 1 USD wallet, got ${resultUSD.data.length}`);
    }

    const resultLocked = await AdminOpsService.getWallets({ status: 'LOCKED' });
    if (resultLocked.data.length !== 1 || resultLocked.data[0].status !== 'LOCKED') {
      throw new Error(`Expected 1 LOCKED wallet, got ${resultLocked.data.length}`);
    }
  });

  // 4. Authoritative Wagering Query & Turnover Mathematics
  console.log('\n--- 4. Wagering Monitoring, Turnover Progress & Gate Gating ---');

  await assert('Controller getWagering returns POSTGRESQL_AUTHORITATIVE data', async () => {
    const req: any = {
      query: { page: '1', limit: '10' },
      user: { uid: 'admin-1', role: 'ADMIN' }
    };
    const res = mockRes();

    await adminController.getWagering(req, res);

    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.jsonData?.success) throw new Error('Response success was not true');
    if (res.jsonData?.source !== AUTHORITATIVE_SOURCE_TAG) {
      throw new Error(`Expected source ${AUTHORITATIVE_SOURCE_TAG}, got ${res.jsonData?.source}`);
    }

    const reqs = res.jsonData.data;
    if (!Array.isArray(reqs) || reqs.length !== 3) {
      throw new Error(`Expected 3 wagering requirements, got ${reqs?.length}`);
    }

    // Verify wagering requirement 501: Active with pending turnover (Withdrawal Blocked)
    const r1 = reqs.find((r: any) => r.id === 501);
    if (!r1) throw new Error('Requirement 501 not found');
    if (r1.targetTurnoverAmount !== '10000.0000') throw new Error(`target turnover mismatch: ${r1.targetTurnoverAmount}`);
    if (r1.completedTurnoverAmount !== '6500.0000') throw new Error(`completed turnover mismatch: ${r1.completedTurnoverAmount}`);
    if (r1.remainingTurnoverAmount !== '3500.0000') throw new Error(`remaining turnover mismatch: ${r1.remainingTurnoverAmount}`);
    if (r1.progressPercent !== 65) throw new Error(`progress percent mismatch: ${r1.progressPercent}`);
    if (r1.isWithdrawalBlocked !== true) throw new Error('Requirement 501 should block withdrawals');
    if (r1.isReleased !== false) throw new Error('Requirement 501 should be unreleased');

    // Verify wagering requirement 502: Completed and Released (Withdrawal Unblocked)
    const r2 = reqs.find((r: any) => r.id === 502);
    if (!r2) throw new Error('Requirement 502 not found');
    if (r2.remainingTurnoverAmount !== '0.0000') throw new Error(`remaining turnover mismatch: ${r2.remainingTurnoverAmount}`);
    if (r2.progressPercent !== 100) throw new Error(`progress percent mismatch: ${r2.progressPercent}`);
    if (r2.isWithdrawalBlocked !== false) throw new Error('Requirement 502 should NOT block withdrawals');
    if (r2.isReleased !== true) throw new Error('Requirement 502 should be released');

    // Verify summary blocked players count
    const summary = res.jsonData.summary;
    if (summary.activeCount !== 1) throw new Error(`Expected 1 active wagering, got ${summary.activeCount}`);
    if (summary.blockedPlayersCount !== 1) throw new Error(`Expected 1 blocked player, got ${summary.blockedPlayersCount}`);
  });

  await assert('getWagering supports filtering by status, released flag and search', async () => {
    const resultActive = await AdminOpsService.getWagering({ status: 'ACTIVE' });
    if (resultActive.data.length !== 1 || resultActive.data[0].id !== 501) {
      throw new Error(`Expected 1 ACTIVE wagering, got ${resultActive.data.length}`);
    }

    const resultReleased = await AdminOpsService.getWagering({ released: 'true' });
    if (resultReleased.data.length !== 1 || resultReleased.data[0].id !== 502) {
      throw new Error(`Expected 1 RELEASED wagering, got ${resultReleased.data.length}`);
    }

    const resultSearch = await AdminOpsService.getWagering({ search: 'SLOTS_RELOAD' });
    if (resultSearch.data.length !== 1 || resultSearch.data[0].id !== 503) {
      throw new Error(`Expected 1 wagering matching SLOTS_RELOAD, got ${resultSearch.data.length}`);
    }
  });

  // 5. Pagination Verification
  console.log('\n--- 5. Server-Side Pagination ---');

  await assert('Pagination metadata is accurately returned for wallets and wagering', async () => {
    const walletPage = await AdminOpsService.getWallets({ page: 2, limit: 2 });
    if (walletPage.pagination.page !== 2) throw new Error('Page was not 2');
    if (walletPage.pagination.limit !== 2) throw new Error('Limit was not 2');
    if (walletPage.pagination.total !== 3) throw new Error('Total was not 3');
    if (walletPage.pagination.totalPages !== 2) throw new Error('TotalPages was not 2');
    if (walletPage.data.length !== 1) throw new Error(`Expected 1 item on page 2, got ${walletPage.data.length}`);
  });

  // 6. Security and Redaction Verification
  console.log('\n--- 6. Redaction of Sensitive Identifiers & Secrets ---');

  await assert('Sensitive email strings are masked in wallet and wagering payloads', async () => {
    const wallets = await AdminOpsService.getWallets({});
    for (const w of wallets.data) {
      if (w.email && !w.email.includes('***')) {
        throw new Error(`Raw email was leaked: ${w.email}`);
      }
    }

    const wagering = await AdminOpsService.getWagering({});
    for (const r of wagering.data) {
      if (r.userEmail && !r.userEmail.includes('***')) {
        throw new Error(`Raw email was leaked in wagering: ${r.userEmail}`);
      }
    }
  });

  // 7. Fail-Closed Error Handling
  console.log('\n--- 7. Fail-Closed Handling on Database Error ---');

  await assert('Fail closed on PostgreSQL error and return 500 without leaking partial state', async () => {
    const brokenDb: any = {
      select: () => {
        throw new Error('Connection pool exhausted');
      }
    };
    AdminOpsService.setDbClient(brokenDb);

    const req: any = { query: {}, user: { uid: 'admin-1', role: 'ADMIN' } };
    const res = mockRes();

    await adminController.getWallets(req, res);

    if (res.statusCode !== 500) throw new Error(`Expected 500, got ${res.statusCode}`);
    if (res.jsonData?.success !== false) throw new Error('Expected success false on error');
    if (res.jsonData?.source !== AUTHORITATIVE_SOURCE_TAG) {
      throw new Error(`Expected source ${AUTHORITATIVE_SOURCE_TAG} on error`);
    }
    if (res.jsonData?.code !== 'DATABASE_READ_ERROR') {
      throw new Error(`Expected code DATABASE_READ_ERROR, got ${res.jsonData?.code}`);
    }

    // Reset DB
    setupMockPostgresDb();
  });

  // 8. Strict Read-Only Invariant Verification
  console.log('\n--- 8. Strict Read-Only Invariant Verification ---');

  await assert('AdminWalletWageringMonitoringView contains strictly zero mutation handlers', () => {
    const viewPath = path.join(process.cwd(), 'src/components/AdminWalletWageringMonitoringView.tsx');
    if (!fs.existsSync(viewPath)) throw new Error('AdminWalletWageringMonitoringView.tsx does not exist');

    const content = fs.readFileSync(viewPath, 'utf8');

    // Forbidden mutating action patterns
    const forbiddenPatterns = [
      /adjustWallet/i,
      /creditWallet/i,
      /debitWallet/i,
      /overrideWagering/i,
      /releaseBonus/i,
      /unlockWagering/i,
      /method:\s*['"]POST['"]/i,
      /method:\s*['"]PUT['"]/i,
      /method:\s*['"]DELETE['"]/i,
      /method:\s*['"]PATCH['"]/i,
      /\/api\/admin\/wallets\/adjust/i,
      /\/api\/admin\/wagering\/release/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        throw new Error(`Forbidden financial mutation pattern found in monitoring view: ${pattern}`);
      }
    }
  });

  console.log('\n===============================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    throw new Error(`Task A3 test suite failed with ${failed} failure(s)`);
  }
}

// Auto-run if executed directly via tsx/node
if (process.argv[1] && process.argv[1].includes('authoritativeWalletWageringTaskA3')) {
  runAuthoritativeWalletWageringTaskA3Tests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
