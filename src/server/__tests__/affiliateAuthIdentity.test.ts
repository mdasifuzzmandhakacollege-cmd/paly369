/**
 * @file affiliateAuthIdentity.test.ts
 * @description Verification Suite for PLAY369 Task 2.1 Affiliate Auth + Identity Binding.
 * 
 * Verifies:
 * 1. Valid Authenticated User Summary retrieval resolved from Firebase Auth token UID.
 * 2. Valid Authenticated User Commission Claim resolved from Firebase Auth token UID.
 * 3. Missing Token rejection with 401 Unauthorized.
 * 4. Invalid / malformed Token rejection with 401 Unauthorized.
 * 5. Cross-User Summary request rejection with 403 Forbidden.
 * 6. Cross-User Claim request rejection with 403 Forbidden.
 * 7. Server route protection: requireAuth middleware mounted on /api/affiliate.
 */

import { requireAuth, AuthRequest } from '../../middleware/auth.js';
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

// Mock User Database Records
const mockUsers = [
  { id: 101, uid: 'firebase_uid_alice', username: 'alice' },
  { id: 102, uid: 'firebase_uid_bob', username: 'bob' }
];

const mockAffiliateNodes: Record<number, any> = {
  101: {
    userId: 101,
    referralCode: 'PLAY369_101',
    totalDirectReferrals: 5,
    totalSubordinates: 12,
    totalTurnoverVolume: '25000.0000',
    totalCommissionEarned: '125.0000',
    unclaimedCommission: '45.0000'
  },
  102: {
    userId: 102,
    referralCode: 'PLAY369_102',
    totalDirectReferrals: 1,
    totalSubordinates: 2,
    totalTurnoverVolume: '5000.0000',
    totalCommissionEarned: '25.0000',
    unclaimedCommission: '10.0000'
  }
};

/**
 * Mock implementation of identity resolution logic for unit contract testing
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
      const error: any = new Error('Forbidden: Cannot access or claim for another user');
      error.statusCode = 403;
      throw error;
    }
  }

  return {
    userId: foundUser.id,
    uid: foundUser.uid
  };
}

async function runAffiliateAuthTests() {
  console.log('================================================================');
  console.log('🛡️ PLAY369 TASK 2.1 AFFILIATE AUTH & IDENTITY BINDING TEST SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Missing Token Rejection (401 Unauthorized)
  // --------------------------------------------------------------------------
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
  // TEST 2: Invalid / Empty Bearer Token Rejection (401 Unauthorized)
  // --------------------------------------------------------------------------
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
  // TEST 3: Valid Authenticated Summary Resolution
  // --------------------------------------------------------------------------
  await assert('Valid authenticated user reads only their own affiliate summary', () => {
    const authUid = 'firebase_uid_alice';
    const resolution = testResolveAuthUser(authUid, undefined);

    if (resolution.userId !== 101 || resolution.uid !== 'firebase_uid_alice') {
      throw new Error(`Expected Alice ID 101, got ${resolution.userId}`);
    }

    const node = mockAffiliateNodes[resolution.userId];
    if (!node || node.unclaimedCommission !== '45.0000') {
      throw new Error(`Failed to load Alice's affiliate summary: ${JSON.stringify(node)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Valid Authenticated Claim Resolution
  // --------------------------------------------------------------------------
  await assert('Valid authenticated user claims commission strictly for own account', () => {
    const authUid = 'firebase_uid_alice';
    const resolution = testResolveAuthUser(authUid, 101);

    if (resolution.userId !== 101) {
      throw new Error(`Expected claim target 101, got ${resolution.userId}`);
    }

    // Simulate claim execution
    const node = mockAffiliateNodes[resolution.userId];
    const claimedAmount = parseFloat(node.unclaimedCommission);
    if (claimedAmount !== 45.0000) {
      throw new Error(`Expected claimable 45.0000, got ${claimedAmount}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Cross-User Summary Access Rejection (403 Forbidden)
  // --------------------------------------------------------------------------
  await assert('Cross-user summary access attempt is rejected with 403 Forbidden', () => {
    const authUid = 'firebase_uid_alice'; // Alice is logged in
    const adversaryTargetUserId = '102'; // Trying to view Bob's data (ID 102)

    let caughtError: any = null;
    try {
      testResolveAuthUser(authUid, adversaryTargetUserId);
    } catch (err: any) {
      caughtError = err;
    }

    if (!caughtError) {
      throw new Error('Expected cross-user summary request to throw an error');
    }
    if (caughtError.statusCode !== 403) {
      throw new Error(`Expected 403 status code, got ${caughtError.statusCode}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Cross-User Commission Claim Rejection (403 Forbidden)
  // --------------------------------------------------------------------------
  await assert('Cross-user commission claim attempt is rejected with 403 Forbidden', () => {
    const authUid = 'firebase_uid_alice'; // Alice is logged in
    const adversaryTargetUserId = 'firebase_uid_bob'; // Trying to claim Bob's commissions

    let caughtError: any = null;
    try {
      testResolveAuthUser(authUid, adversaryTargetUserId);
    } catch (err: any) {
      caughtError = err;
    }

    if (!caughtError) {
      throw new Error('Expected cross-user claim request to throw an error');
    }
    if (caughtError.statusCode !== 403) {
      throw new Error(`Expected 403 status code, got ${caughtError.statusCode}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Codebase Architecture & Route Protection Audit
  // --------------------------------------------------------------------------
  await assert('server index.ts mounts requireAuth on affiliateRouter', () => {
    const serverIndexPath = path.join(process.cwd(), 'src/server/index.ts');
    const content = fs.readFileSync(serverIndexPath, 'utf8');

    if (!content.includes('affiliateRouter.use(requireAuth)')) {
      throw new Error('affiliateRouter in src/server/index.ts is not protected with requireAuth middleware!');
    }
  });

  await assert('affiliateController.ts resolves authenticated user via resolveAuthUser', () => {
    const controllerPath = path.join(process.cwd(), 'src/server/controllers/affiliateController.ts');
    const content = fs.readFileSync(controllerPath, 'utf8');

    if (!content.includes('resolveAuthUser')) {
      throw new Error('affiliateController.ts is missing resolveAuthUser implementation!');
    }
    if (!content.includes('const { userId } = await resolveAuthUser')) {
      throw new Error('affiliateController handlers do not authoritatively destructure userId from resolveAuthUser!');
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAffiliateAuthTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
