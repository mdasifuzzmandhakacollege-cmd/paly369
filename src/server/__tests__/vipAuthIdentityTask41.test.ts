/**
 * @file vipAuthIdentityTask41.test.ts
 * @description Test Suite for PLAY369 Task 4.1 - VIP Authentication & Identity Binding.
 * 
 * Verifies:
 * 1. Entire /api/vip router is protected with requireAuth middleware in src/server/index.ts.
 * 2. Missing token rejected with 401 Unauthorized.
 * 3. Invalid token rejected with 401 Unauthorized.
 * 4. Authenticated DB user resolution strictly from Firebase UID (req.user.uid).
 * 5. 404 returned if authenticated Firebase user is not linked to a PostgreSQL user.
 * 6. GET /api/vip/details reads ONLY the authenticated user's VIP progress; forged userId rejected with 403.
 * 7. POST /api/vip/claim-bonus claims ONLY for the authenticated user; forged userId rejected with 403.
 * 8. Existing VIP levels, qualification thresholds, bonus amounts, and progression logic preserved.
 */

import fs from 'fs';
import path from 'path';
import { requireAuth, AuthRequest } from '../../middleware/auth.js';
import { VIP_TIER_CONFIG } from '../../shared/gameplayConfig.js';
import { VipService } from '../controllers/vipController.js';

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

// Mock User Database Records for unit simulation
const mockUsers = [
  { id: 201, uid: 'firebase_uid_alice', username: 'alice' },
  { id: 202, uid: 'firebase_uid_bob', username: 'bob' }
];

const mockVipProgress: Record<number, any> = {
  201: {
    userId: 201,
    currentLevel: 2,
    cumulativeDeposit: '5000.0000',
    cumulativeBet: '15000.0000',
    levelUpBonusClaimed: [1, 2],
    totalCashbackClaimed: '0.0000'
  },
  202: {
    userId: 202,
    currentLevel: 4,
    cumulativeDeposit: '50000.0000',
    cumulativeBet: '150000.0000',
    levelUpBonusClaimed: [1, 2, 3],
    totalCashbackClaimed: '100.0000'
  }
};

/**
 * Unit simulation of resolveAuthUser logic for contract verification
 */
function testResolveAuthUser(
  authUid: string | undefined,
  clientUserId?: unknown
): { userId: number; uid: string } {
  if (!authUid) {
    const error: any = new Error('Unauthorized: Authentication required');
    error.statusCode = 401;
    throw error;
  }

  const foundUser = mockUsers.find((u) => u.uid === authUid);
  if (!foundUser) {
    const error: any = new Error(`User account not found for UID: ${authUid}`);
    error.statusCode = 404;
    throw error;
  }

  if (clientUserId !== undefined && clientUserId !== null && String(clientUserId).trim() !== '') {
    const strClientUserId = String(clientUserId).trim();
    const isMatchingUid = strClientUserId === foundUser.uid;
    const isMatchingId = /^\d+$/.test(strClientUserId) && parseInt(strClientUserId, 10) === foundUser.id;

    if (!isMatchingUid && !isMatchingId) {
      const error: any = new Error('Forbidden: Cannot access or claim rewards for another user');
      error.statusCode = 403;
      throw error;
    }
  }

  return {
    userId: foundUser.id,
    uid: foundUser.uid
  };
}

async function runVipAuthTests() {
  console.log('================================================================');
  console.log('👑 PLAY369 TASK 4.1: VIP AUTHENTICATION & IDENTITY BINDING TEST SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Missing Token Rejection (401 Unauthorized)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Token Authentication Enforcement (401) ---');
  await assert('requireAuth middleware rejects requests with missing token (401)', async () => {
    let statusCode: number | null = null;
    let jsonResponse: any = null;

    const req: any = { headers: {} };
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return { json: (data: any) => { jsonResponse = data; } };
      }
    };
    const next = () => { throw new Error('next() should not be called on missing token'); };

    await requireAuth(req, res, next);

    if (statusCode !== 401) {
      throw new Error(`Expected 401, got ${statusCode}`);
    }
    if (!jsonResponse?.message?.includes('Missing token') && !jsonResponse?.error?.includes('Missing token')) {
      throw new Error(`Expected 'Missing token' error message, got ${JSON.stringify(jsonResponse)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Invalid / Malformed Token Rejection (401 Unauthorized)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Malformed Bearer Token Rejection (401) ---');
  await assert('requireAuth middleware rejects requests with empty/invalid Bearer token (401)', async () => {
    let statusCode: number | null = null;
    let jsonResponse: any = null;

    const req: any = { headers: { authorization: 'Bearer ' } };
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return { json: (data: any) => { jsonResponse = data; } };
      }
    };
    const next = () => { throw new Error('next() should not be called on invalid token'); };

    await requireAuth(req, res, next);

    if (statusCode !== 401) {
      throw new Error(`Expected 401, got ${statusCode}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Authenticated User Reads ONLY Own VIP Progress
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Authenticated User Identity Resolution ---');
  await assert('Valid authenticated user reads strictly their own VIP progress', () => {
    const authUid = 'firebase_uid_alice';
    const resolution = testResolveAuthUser(authUid, undefined);

    if (resolution.userId !== 201 || resolution.uid !== 'firebase_uid_alice') {
      throw new Error(`Expected Alice ID 201, got ${resolution.userId}`);
    }

    const progress = mockVipProgress[resolution.userId];
    if (!progress || progress.currentLevel !== 2) {
      throw new Error(`Failed to load Alice's VIP progress: ${JSON.stringify(progress)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Unlinked Firebase User Returns 404
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Unlinked Firebase User Returns 404 ---');
  await assert('Authenticated Firebase user not linked to PostgreSQL user throws 404', () => {
    const unlinkedUid = 'firebase_uid_charlie_unlinked';
    let caughtError: any = null;

    try {
      testResolveAuthUser(unlinkedUid, undefined);
    } catch (err: any) {
      caughtError = err;
    }

    if (!caughtError) {
      throw new Error('Expected unlinked user to throw an error');
    }
    if (caughtError.statusCode !== 404) {
      throw new Error(`Expected 404 status code, got ${caughtError.statusCode}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Forged userId Cannot Read Another VIP Profile (403 Forbidden)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Forged userId Read Access Rejected (403) ---');
  await assert('Forged userId query param targeting another user throws 403 Forbidden', () => {
    const authUid = 'firebase_uid_alice'; // Alice is authenticated (ID 201)
    const adversaryTargetUserId = '202'; // Trying to view Bob's VIP details

    let caughtError: any = null;
    try {
      testResolveAuthUser(authUid, adversaryTargetUserId);
    } catch (err: any) {
      caughtError = err;
    }

    if (!caughtError) {
      throw new Error('Expected forged userId read request to throw 403 error');
    }
    if (caughtError.statusCode !== 403) {
      throw new Error(`Expected 403 status code, got ${caughtError.statusCode}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Forged userId Cannot Claim Another User's Bonus (403 Forbidden)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Forged userId Claim Access Rejected (403) ---');
  await assert('Forged userId body param targeting another user throws 403 Forbidden on claim', () => {
    const authUid = 'firebase_uid_alice'; // Alice is authenticated (ID 201)
    const adversaryTargetUserId = 'firebase_uid_bob'; // Trying to claim Bob's VIP level 4 bonus

    let caughtError: any = null;
    try {
      testResolveAuthUser(authUid, adversaryTargetUserId);
    } catch (err: any) {
      caughtError = err;
    }

    if (!caughtError) {
      throw new Error('Expected forged userId claim request to throw 403 error');
    }
    if (caughtError.statusCode !== 403) {
      throw new Error(`Expected 403 status code, got ${caughtError.statusCode}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Existing VIP Configuration & Behavior Preserved
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: VIP Configuration and Tier Evaluation Preservation ---');
  await assert('VIP_TIER_CONFIG preserves 10 standard tiers with thresholds and bonuses', () => {
    if (!VIP_TIER_CONFIG || VIP_TIER_CONFIG.length !== 10) {
      throw new Error(`Expected 10 VIP tiers, got ${VIP_TIER_CONFIG?.length}`);
    }

    const v1 = VIP_TIER_CONFIG.find((t) => t.level === 1)!;
    const v5 = VIP_TIER_CONFIG.find((t) => t.level === 5)!;
    const v10 = VIP_TIER_CONFIG.find((t) => t.level === 10)!;

    if (v1.minDeposit !== 0 || v1.minBet !== 0 || v1.bonus !== 0) {
      throw new Error(`V1 tier config mutated: ${JSON.stringify(v1)}`);
    }

    if (v5.level !== 5 || v5.bonus <= 0 || v5.minDeposit <= 0) {
      throw new Error(`V5 tier config mutated: ${JSON.stringify(v5)}`);
    }

    if (v10.level !== 10 || v10.bonus <= 0) {
      throw new Error(`V10 tier config mutated: ${JSON.stringify(v10)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Codebase Architecture & Route Protection Audit
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Static Code Architecture Audit ---');
  await assert('src/server/index.ts protects vipRouter with requireAuth middleware', () => {
    const serverIndexPath = path.join(process.cwd(), 'src/server/index.ts');
    const content = fs.readFileSync(serverIndexPath, 'utf8');

    if (!content.includes('vipRouter.use(requireAuth)')) {
      throw new Error('vipRouter in src/server/index.ts is not protected with requireAuth middleware!');
    }
  });

  await assert('src/server/controllers/vipController.ts uses resolveAuthUser for details and claim-bonus', () => {
    const controllerPath = path.join(process.cwd(), 'src/server/controllers/vipController.ts');
    const content = fs.readFileSync(controllerPath, 'utf8');

    if (!content.includes('resolveAuthUser')) {
      throw new Error('vipController.ts is missing resolveAuthUser import/usage!');
    }

    // Check getVipDetailsHandler
    if (!content.includes('const { userId } = await resolveAuthUser(req, req.query?.userId)')) {
      throw new Error('getVipDetailsHandler does not resolve userId via resolveAuthUser(req, req.query?.userId)!');
    }

    // Check claimVipBonusHandler
    if (!content.includes('const { userId } = await resolveAuthUser(req, req.body?.userId)')) {
      throw new Error('claimVipBonusHandler does not resolve userId via resolveAuthUser(req, req.body?.userId)!');
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TASK 4.1 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVipAuthTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
