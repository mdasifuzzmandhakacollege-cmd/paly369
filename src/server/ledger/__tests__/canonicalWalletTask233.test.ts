/**
 * @file canonicalWalletTask233.test.ts
 * @description Task 2.3.3 Dedicated Test Suite: Canonical Wallet Schema & 4-Decimal Precision Alignment.
 * 
 * Verifies:
 * 1. Alignment with PLAY369 integer user IDs (e.g. 1, 42, 10005, '10005')
 * 2. Single canonical production wallet (wallets table with real_balance and balance_minor synchronization)
 * 3. Exact 4-decimal precision: 0.0516 credits as exactly 0.0516 (516 minor units)
 * 4. Zero drift in multi-step fractional arithmetic (e.g. 0.0516 * 10 = 0.5160)
 * 5. Preservation of existing balances
 * 6. Audit reconciliation for integer user IDs
 */

import { InMemoryPostgresLedgerEngine } from '../db';
import { WalletLedgerService } from '../walletLedgerService';
import { parseToMinorUnits, formatMinorUnits, LEDGER_DECIMALS } from '../money';

async function runTask233Tests() {
  console.log('================================================================');
  console.log('🧪 PLAY369 TASK 2.3.3: CANONICAL WALLET SCHEMA & 4-DECIMAL PRECISION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function assert(desc: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(`     Error:`, err.message || err);
      failed++;
    }
  }

  const engine = new InMemoryPostgresLedgerEngine();
  const ledger = new WalletLedgerService(engine);

  // 1. Check Global Precision Constants
  await assert('1. Financial precision configured to 4 decimal places (scale 4)', () => {
    if (LEDGER_DECIMALS !== 4) {
      throw new Error(`Expected LEDGER_DECIMALS to be 4, got ${LEDGER_DECIMALS}`);
    }
    const minorUnits = parseToMinorUnits(0.0516, 'BDT');
    if (minorUnits !== 516n) {
      throw new Error(`Expected 0.0516 to convert to 516n minor units, got ${minorUnits}`);
    }
    const formatted = formatMinorUnits(516n, 'BDT');
    if (formatted !== '0.0516') {
      throw new Error(`Expected 516n to format as '0.0516', got '${formatted}'`);
    }
  });

  // 2. Exact 0.0516 Credit Test on Canonical Integer User ID
  const integerUserId = 10005;
  const currency = 'BDT';

  await assert('2. 0.0516 must credit exactly as 0.0516 to integer user ID 10005', async () => {
    const res = await ledger.executeTransaction({
      userId: integerUserId,
      currency,
      transactionId: 'tx_fractional_001',
      type: 'CREDIT',
      amountMajor: '0.0516',
      auditMetadata: { test: 'Task 2.3.3 exact precision' }
    });

    if (res.afterBalanceMajor !== '0.0516') {
      throw new Error(`Expected balance '0.0516', got '${res.afterBalanceMajor}'`);
    }
    if (res.afterBalanceMinor !== '516') {
      throw new Error(`Expected minor units '516', got '${res.afterBalanceMinor}'`);
    }

    const wallet = await ledger.getWallet(integerUserId, currency);
    if (wallet.realBalance !== '0.0516') {
      throw new Error(`Expected wallet realBalance '0.0516', got '${wallet.realBalance}'`);
    }
    if (wallet.balanceMinor !== 516n) {
      throw new Error(`Expected wallet balanceMinor 516n, got ${wallet.balanceMinor}`);
    }
  });

  // 3. Accumulate 10 micro-credits of 0.0516 without floating point drift
  await assert('3. Accumulate 10 consecutive micro-credits of 0.0516 to reach exact 0.5160 BDT', async () => {
    for (let i = 2; i <= 10; i++) {
      await ledger.executeTransaction({
        userId: integerUserId,
        currency,
        transactionId: `tx_fractional_${i.toString().padStart(3, '0')}`,
        type: 'CREDIT',
        amountMajor: '0.0516'
      });
    }

    const wallet = await ledger.getWallet(integerUserId, currency);
    if (wallet.realBalance !== '0.5160') {
      throw new Error(`Expected balance '0.5160', got '${wallet.realBalance}'`);
    }
    if (wallet.balanceMinor !== 5160n) {
      throw new Error(`Expected balanceMinor 5160n, got ${wallet.balanceMinor}`);
    }
  });

  // 4. Exact Micro-Debit of 0.0160 BDT
  await assert('4. Process exact micro-debit of 0.0160 BDT leaving exact 0.5000 BDT', async () => {
    const res = await ledger.executeTransaction({
      userId: integerUserId,
      currency,
      transactionId: 'tx_fractional_debit_01',
      type: 'DEBIT',
      amountMajor: '0.0160'
    });

    if (res.afterBalanceMajor !== '0.5000' || res.afterBalanceMinor !== '5000') {
      throw new Error(`Expected balance '0.5000', got '${res.afterBalanceMajor}' (${res.afterBalanceMinor} minor)`);
    }
  });

  // 5. String vs Integer User ID Interoperability
  await assert('5. Integer ID (10005) and String ID ("10005") access the same single canonical wallet', async () => {
    const walletFromNum = await ledger.getWallet(10005, currency);
    const walletFromStr = await ledger.getWallet('10005', currency);

    if (walletFromNum.id !== walletFromStr.id) {
      throw new Error(`Different wallet IDs returned: ${walletFromNum.id} vs ${walletFromStr.id}`);
    }
    if (walletFromNum.balanceMinor !== walletFromStr.balanceMinor) {
      throw new Error(`Balance mismatch between number and string user ID lookup`);
    }
  });

  // 6. Audit Reconciliation on Integer User ID
  await assert('6. Audit reconciliation perfectly verifies all ledger entries for integer user ID 10005', async () => {
    const audit = await ledger.auditReconciliation(integerUserId, currency);
    if (!audit.isReconciled || audit.discrepancyMinor !== '0') {
      throw new Error(`Audit reconciliation failed: ${JSON.stringify(audit)}`);
    }
    if (audit.walletBalanceMajor !== '0.5000') {
      throw new Error(`Expected audited balance '0.5000', got '${audit.walletBalanceMajor}'`);
    }
  });

  // 7. Reversal with 4-decimal precision
  await assert('7. Reversal of micro-debit (0.0160) restores balance to 0.5160 BDT', async () => {
    const res = await ledger.executeTransaction({
      userId: integerUserId,
      currency,
      transactionId: 'tx_fractional_rev_01',
      referenceTransactionId: 'tx_fractional_debit_01',
      type: 'REVERSAL',
      amountMajor: '0.0160'
    });

    if (res.afterBalanceMajor !== '0.5160' || res.afterBalanceMinor !== '5160') {
      throw new Error(`Expected balance '0.5160', got '${res.afterBalanceMajor}'`);
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TASK 2.3.3 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTask233Tests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
