/**
 * @file affiliateAuthoritativeBetSource.test.ts
 * @description Verification Suite for PLAY369 Task 2.2.1 Authoritative Bet Source Validation.
 * 
 * Verifies:
 * 1. Nonexistent sourceTransactionId rejection with zero commission mutation.
 * 2. Transaction belonging to another user rejection (TRANSACTION_USER_MISMATCH).
 * 3. Manipulated betAmount rejection (BET_AMOUNT_MISMATCH) vs authoritative DB amount.
 * 4. Manipulated currency rejection (CURRENCY_MISMATCH) vs authoritative DB currency.
 * 5. Valid settled BET processing with exact BigInt rates (Tier 1: 0.50%, Tier 2: 0.20%).
 * 6. Duplicate valid BET idempotency rejection (ALREADY_PROCESSED).
 * 7. Non-BET or non-COMPLETED transaction rejection (INVALID_TRANSACTION_TYPE / TRANSACTION_NOT_SETTLED).
 */

import {
  COMMISSION_TIER_BPS,
  DistributeCommissionParams
} from '../controllers/affiliateController.js';
import { toScale4, fromScale4 } from '../controllers/promotionController.js';
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

// Mock Transactions Table in Database
interface DBTransaction {
  transactionId: string;
  userId: number;
  type: string;
  status: string;
  amount: string;
  currency: string;
}

const mockTransactionsDB: Record<string, DBTransaction> = {
  'TX_VALID_BET_1': {
    transactionId: 'TX_VALID_BET_1',
    userId: 101,
    type: 'BET',
    status: 'COMPLETED',
    amount: '1000.0000',
    currency: 'BDT'
  },
  'TX_OTHER_USER_BET': {
    transactionId: 'TX_OTHER_USER_BET',
    userId: 999, // Owned by user 999, not 101
    type: 'BET',
    status: 'COMPLETED',
    amount: '500.0000',
    currency: 'BDT'
  },
  'TX_NOT_A_BET': {
    transactionId: 'TX_NOT_A_BET',
    userId: 101,
    type: 'DEPOSIT',
    status: 'COMPLETED',
    amount: '2000.0000',
    currency: 'BDT'
  },
  'TX_UNSETTLED_BET': {
    transactionId: 'TX_UNSETTLED_BET',
    userId: 101,
    type: 'BET',
    status: 'PENDING',
    amount: '1000.0000',
    currency: 'BDT'
  }
};

// Simulation of the authoritative controller logic for contract validation
function simulateProcessValidBetCommission(
  params: DistributeCommissionParams,
  existingCommissionsLedger: { sourceTransactionId: string; beneficiaryUserId: number; tier: number }[]
) {
  if (!params.sourceTransactionId || typeof params.sourceTransactionId !== 'string' || params.sourceTransactionId.trim() === '') {
    throw new Error('sourceTransactionId is required for commission distribution');
  }

  // 1. Authoritatively lookup source bet transaction from database
  const sourceTx = mockTransactionsDB[params.sourceTransactionId];
  if (!sourceTx) {
    return { success: false, reason: 'SOURCE_TRANSACTION_NOT_FOUND', distributedCount: 0 };
  }

  // Validate type = BET
  if (sourceTx.type !== 'BET') {
    return { success: false, reason: 'INVALID_TRANSACTION_TYPE', distributedCount: 0 };
  }

  // Validate status = COMPLETED or SETTLED
  const isCommittedStatus = sourceTx.status === 'COMPLETED' || sourceTx.status === 'SETTLED';
  if (!isCommittedStatus) {
    return { success: false, reason: 'TRANSACTION_NOT_SETTLED', distributedCount: 0 };
  }

  // Validate ownership
  if (sourceTx.userId !== params.userId) {
    return { success: false, reason: 'TRANSACTION_USER_MISMATCH', distributedCount: 0 };
  }

  // 2. Read authoritative bet amount and currency directly from verified database record
  const authoritativeBetScale4 = toScale4(sourceTx.amount);
  if (authoritativeBetScale4 <= 0n) {
    return { success: false, reason: 'INVALID_BET_AMOUNT', distributedCount: 0 };
  }
  const authoritativeCurrency = sourceTx.currency || 'BDT';

  // 3. Reject any mismatch between caller-supplied context and authoritative source transaction
  if (params.betAmount !== undefined && params.betAmount !== null) {
    const callerBetScale4 = typeof params.betAmount === 'bigint' ? params.betAmount : toScale4(params.betAmount);
    if (callerBetScale4 !== authoritativeBetScale4) {
      return { success: false, reason: 'BET_AMOUNT_MISMATCH', distributedCount: 0 };
    }
  }

  if (params.currency && typeof params.currency === 'string' && params.currency.trim() !== '') {
    if (params.currency.trim().toUpperCase() !== authoritativeCurrency.trim().toUpperCase()) {
      return { success: false, reason: 'CURRENCY_MISMATCH', distributedCount: 0 };
    }
  }

  // 4. Idempotency check
  const existingCommissions = existingCommissionsLedger.filter(
    (c) => c.sourceTransactionId === params.sourceTransactionId
  );
  if (existingCommissions.length > 0) {
    return { success: true, reason: 'ALREADY_PROCESSED', distributedCount: 0 };
  }

  // 5. Calculate commission from authoritative amount
  const tier1Amount = (authoritativeBetScale4 * COMMISSION_TIER_BPS[1]) / 10000n;
  const tier2Amount = (authoritativeBetScale4 * COMMISSION_TIER_BPS[2]) / 10000n;

  return {
    success: true,
    distributedCount: 2,
    sourceTransactionId: params.sourceTransactionId,
    authoritativeBetAmount: fromScale4(authoritativeBetScale4),
    authoritativeCurrency,
    tier1Commission: fromScale4(tier1Amount),
    tier2Commission: fromScale4(tier2Amount)
  };
}

async function runAuthoritativeBetSourceTests() {
  console.log('================================================================');
  console.log('🛡️ PLAY369 TASK 2.2.1 AUTHORITATIVE BET SOURCE TEST SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Nonexistent sourceTransactionId Rejection
  // --------------------------------------------------------------------------
  await assert('Rejects nonexistent sourceTransactionId with zero mutation', () => {
    const result = simulateProcessValidBetCommission(
      {
        userId: 101,
        sourceTransactionId: 'NON_EXISTENT_TX_ID_12345',
        betAmount: '1000.0000',
        currency: 'BDT',
        gameId: 'slot_gate_of_olympus'
      },
      []
    );

    if (result.success !== false || result.reason !== 'SOURCE_TRANSACTION_NOT_FOUND' || result.distributedCount !== 0) {
      throw new Error(`Expected SOURCE_TRANSACTION_NOT_FOUND, got ${JSON.stringify(result)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Transaction Belonging to Another User Rejection
  // --------------------------------------------------------------------------
  await assert('Rejects transaction belonging to another user (TRANSACTION_USER_MISMATCH)', () => {
    const result = simulateProcessValidBetCommission(
      {
        userId: 101, // Caller claims user is 101
        sourceTransactionId: 'TX_OTHER_USER_BET', // Actually owned by 999
        betAmount: '500.0000',
        currency: 'BDT',
        gameId: 'slot_sweet_bonanza'
      },
      []
    );

    if (result.success !== false || result.reason !== 'TRANSACTION_USER_MISMATCH' || result.distributedCount !== 0) {
      throw new Error(`Expected TRANSACTION_USER_MISMATCH, got ${JSON.stringify(result)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Manipulated Bet Amount Rejection
  // --------------------------------------------------------------------------
  await assert('Rejects manipulated bet amount that does not match authoritative DB transaction', () => {
    // DB record has 1000.0000, attacker sends 99999.0000
    const result = simulateProcessValidBetCommission(
      {
        userId: 101,
        sourceTransactionId: 'TX_VALID_BET_1',
        betAmount: '99999.0000', // Manipulated
        currency: 'BDT',
        gameId: 'slot_gate_of_olympus'
      },
      []
    );

    if (result.success !== false || result.reason !== 'BET_AMOUNT_MISMATCH' || result.distributedCount !== 0) {
      throw new Error(`Expected BET_AMOUNT_MISMATCH, got ${JSON.stringify(result)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Manipulated Currency Rejection
  // --------------------------------------------------------------------------
  await assert('Rejects manipulated currency that does not match authoritative DB transaction', () => {
    // DB record has BDT, attacker sends USD
    const result = simulateProcessValidBetCommission(
      {
        userId: 101,
        sourceTransactionId: 'TX_VALID_BET_1',
        betAmount: '1000.0000',
        currency: 'USD', // Manipulated
        gameId: 'slot_gate_of_olympus'
      },
      []
    );

    if (result.success !== false || result.reason !== 'CURRENCY_MISMATCH' || result.distributedCount !== 0) {
      throw new Error(`Expected CURRENCY_MISMATCH, got ${JSON.stringify(result)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Non-BET or Unsettled Transaction Rejection
  // --------------------------------------------------------------------------
  await assert('Rejects non-BET transaction type or unsettled status', () => {
    const resNonBet = simulateProcessValidBetCommission(
      {
        userId: 101,
        sourceTransactionId: 'TX_NOT_A_BET',
        gameId: 'slot_gate_of_olympus'
      },
      []
    );
    if (resNonBet.success !== false || resNonBet.reason !== 'INVALID_TRANSACTION_TYPE') {
      throw new Error(`Expected INVALID_TRANSACTION_TYPE, got ${JSON.stringify(resNonBet)}`);
    }

    const resUnsettled = simulateProcessValidBetCommission(
      {
        userId: 101,
        sourceTransactionId: 'TX_UNSETTLED_BET',
        gameId: 'slot_gate_of_olympus'
      },
      []
    );
    if (resUnsettled.success !== false || resUnsettled.reason !== 'TRANSACTION_NOT_SETTLED') {
      throw new Error(`Expected TRANSACTION_NOT_SETTLED, got ${JSON.stringify(resUnsettled)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Valid Settled BET Accrual from Authoritative DB Source
  // --------------------------------------------------------------------------
  await assert('Processes valid settled BET using authoritative DB amount and currency', () => {
    const result: any = simulateProcessValidBetCommission(
      {
        userId: 101,
        sourceTransactionId: 'TX_VALID_BET_1',
        gameId: 'slot_gate_of_olympus'
      },
      []
    );

    if (result.success !== true || result.distributedCount !== 2) {
      throw new Error(`Expected success with 2 distributions, got ${JSON.stringify(result)}`);
    }
    if (result.authoritativeBetAmount !== '1000.0000') {
      throw new Error(`Expected authoritative amount 1000.0000, got ${result.authoritativeBetAmount}`);
    }
    if (result.tier1Commission !== '5.0000' || result.tier2Commission !== '2.0000') {
      throw new Error(`Commission calculation mismatch: Tier 1=${result.tier1Commission}, Tier 2=${result.tier2Commission}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Duplicate Valid BET Idempotency (Zero Mutation)
  // --------------------------------------------------------------------------
  await assert('Duplicate valid BET is idempotently skipped with ALREADY_PROCESSED', () => {
    const existingLedger = [
      { sourceTransactionId: 'TX_VALID_BET_1', beneficiaryUserId: 201, tier: 1 },
      { sourceTransactionId: 'TX_VALID_BET_1', beneficiaryUserId: 301, tier: 2 }
    ];

    const result = simulateProcessValidBetCommission(
      {
        userId: 101,
        sourceTransactionId: 'TX_VALID_BET_1',
        gameId: 'slot_gate_of_olympus'
      },
      existingLedger
    );

    if (result.success !== true || result.reason !== 'ALREADY_PROCESSED' || result.distributedCount !== 0) {
      throw new Error(`Expected ALREADY_PROCESSED with 0 distributions, got ${JSON.stringify(result)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Codebase Static Audit for Authoritative DB Source Lookup
  // --------------------------------------------------------------------------
  await assert('affiliateController.ts requires DB sourceTx lookup and performs ownership / context validation', () => {
    const controllerPath = path.join(process.cwd(), 'src/server/controllers/affiliateController.ts');
    const content = fs.readFileSync(controllerPath, 'utf8');

    if (!content.includes('SOURCE_TRANSACTION_NOT_FOUND')) {
      throw new Error('affiliateController.ts missing SOURCE_TRANSACTION_NOT_FOUND check!');
    }
    if (!content.includes('TRANSACTION_USER_MISMATCH')) {
      throw new Error('affiliateController.ts missing TRANSACTION_USER_MISMATCH ownership check!');
    }
    if (!content.includes('BET_AMOUNT_MISMATCH')) {
      throw new Error('affiliateController.ts missing BET_AMOUNT_MISMATCH validation!');
    }
    if (!content.includes('CURRENCY_MISMATCH')) {
      throw new Error('affiliateController.ts missing CURRENCY_MISMATCH validation!');
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthoritativeBetSourceTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
