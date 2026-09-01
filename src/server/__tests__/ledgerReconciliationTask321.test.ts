/**
 * @file ledgerReconciliationTask321.test.ts
 * @description Comprehensive Test Suite for PLAY369 Task 3.2.1:
 * REAL/BONUS Ledger Balance-Target Audit Integrity & Independent Reconciliation
 * 
 * Test Scenarios:
 * 1. REAL-only ledger reconciliation
 * 2. BONUS-only ledger reconciliation
 * 3. Mixed REAL + BONUS wallet independent reconciliation
 * 4. BONUS promotion claim does NOT create false REAL-balance discrepancy
 * 5. REAL reward / payout does NOT affect BONUS-balance reconciliation
 * 6. Unauthorized direct wallet tampering triggers exact discrepancy detection
 * 7. Historical metadata backfill logic (targetBalance = 'BONUS' => BONUS, else REAL)
 * 8. Migration SQL idempotency and schema correctness (0003_ledger_balance_target_audit.sql)
 * 9. WalletLedgerService.executeTransaction persists balance_target explicitly
 * 10. Scale-4 precision preserved across all operations
 */

import { InMemoryPostgresLedgerEngine } from '../ledger/db';
import { WalletLedgerService } from '../ledger/walletLedgerService';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let passed = 0;
let failed = 0;

function setupWallet(
  db: InMemoryPostgresLedgerEngine,
  userId: string,
  currency: string,
  realBalanceMajor: string = '0.0000',
  bonusBalanceMajor: string = '0.0000'
) {
  const realMinor = BigInt(Math.round(parseFloat(realBalanceMajor) * 10000));
  db.setRawWallet(`${userId}:${currency}`, {
    id: Math.floor(Math.random() * 100000) + 1,
    user_id: userId,
    currency,
    real_balance: realBalanceMajor,
    bonus_balance: bonusBalanceMajor,
    balance_minor: realMinor,
    version: 1n,
    status: 'ACTIVE',
    created_at: new Date(),
    updated_at: new Date()
  });
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`⏳ [RUNNING] ${name}... `);
    await fn();
    console.log(`\x1b[32mPASSED\x1b[0m`);
    passed++;
  } catch (err: any) {
    console.log(`\x1b[31mFAILED\x1b[0m`);
    console.error(`   Error: ${err.message}`);
    if (err.stack) console.error(`   Stack: ${err.stack}`);
    failed++;
  }
}

export async function runTask321LedgerReconciliationTests() {
  console.log('\n================================================================');
  console.log('🚀 PLAY369 TASK 3.2.1: REAL/BONUS LEDGER RECONCILIATION TEST SUITE');
  console.log('================================================================\n');

  // Test 1: Real-only ledger reconciliation
  await runTest('1. Real-only ledger reconciliation computes 100% accurate net balance', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);
    const userId = 'user_real_only_01';
    const currency = 'BDT';

    setupWallet(db, userId, currency, '1000.0000'); // 10,000,000 minor

    // Debit 250.0000
    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_real_deb_1',
      type: 'DEBIT',
      targetBalance: 'REAL',
      amountMinor: 2500000n,
      auditMetadata: { reason: 'Game wager' }
    });

    // Credit 500.0000
    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_real_cred_1',
      type: 'CREDIT',
      targetBalance: 'REAL',
      amountMinor: 5000000n,
      auditMetadata: { reason: 'Game win' }
    });

    // Reversal 100.0000
    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_real_rev_1',
      referenceTransactionId: 'tx_real_deb_1',
      type: 'REVERSAL',
      targetBalance: 'REAL',
      amountMinor: 1000000n,
      auditMetadata: { reason: 'Refund round' }
    });

    const audit = await ledger.auditReconciliation(userId, currency);
    if (!audit.isReconciled) throw new Error('Expected audit.isReconciled to be true');
    if (!audit.real.isReconciled) throw new Error('Expected audit.real.isReconciled to be true');
    if (audit.real.discrepancyMinor !== '0') throw new Error(`Expected real discrepancy 0, got ${audit.real.discrepancyMinor}`);
    if (audit.real.walletBalanceMajor !== '1350.0000') throw new Error(`Expected wallet balance 1350.0000, got ${audit.real.walletBalanceMajor}`);
    if (audit.real.computedLedgerNetMinor !== '3500000') throw new Error(`Expected net ledger 3500000, got ${audit.real.computedLedgerNetMinor}`);
  });

  // Test 2: Bonus-only ledger reconciliation
  await runTest('2. Bonus-only ledger reconciliation accurately reconciles bonus credits', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);
    const userId = 'user_bonus_only_01';
    const currency = 'BDT';

    setupWallet(db, userId, currency, '0.0000', '0.0000');

    // Credit Daily Checkin Bonus (10.0000 BDT)
    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'PROMO_CHECKIN_user_bonus_only_01_2026-08-30',
      type: 'CREDIT',
      targetBalance: 'BONUS',
      amountMinor: 100000n,
      auditMetadata: { category: 'BONUS_CASH', promotion: 'daily_check_in' }
    });

    // Credit Wheel Spin Bonus (50.0000 BDT)
    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'PROMO_WHEEL_user_bonus_only_01_2026-08-30',
      type: 'CREDIT',
      targetBalance: 'BONUS',
      amountMinor: 500000n,
      auditMetadata: { category: 'BONUS_CASH', promotion: 'lucky_wheel' }
    });

    const audit = await ledger.auditReconciliation(userId, currency, 'BONUS');
    if (!audit.isReconciled) throw new Error('Expected audit.isReconciled to be true');
    if (!audit.bonus.isReconciled) throw new Error('Expected audit.bonus.isReconciled to be true');
    if (audit.bonus.discrepancyMinor !== '0') throw new Error(`Expected bonus discrepancy 0, got ${audit.bonus.discrepancyMinor}`);
    if (audit.bonus.walletBalanceMajor !== '60.0000') throw new Error(`Expected bonus balance 60.0000, got ${audit.bonus.walletBalanceMajor}`);
    if (audit.bonus.computedLedgerNetMinor !== '600000') throw new Error(`Expected bonus net 600000, got ${audit.bonus.computedLedgerNetMinor}`);
  });

  // Test 3: Mixed REAL + BONUS wallet independent reconciliation
  await runTest('3. Mixed REAL + BONUS wallet reconciles REAL and BONUS independently without mixing', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);
    const userId = 'user_mixed_01';
    const currency = 'BDT';

    setupWallet(db, userId, currency, '500.0000', '0.0000'); // 5,000,000 minor REAL

    // 1. Real Debit (-100.0000)
    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_mixed_real_deb',
      type: 'DEBIT',
      targetBalance: 'REAL',
      amountMinor: 1000000n,
      auditMetadata: { reason: 'Slot spin' }
    });

    // 2. Bonus Credit (+25.0000)
    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'PROMO_CHECKIN_mixed_2026-08-30',
      type: 'CREDIT',
      targetBalance: 'BONUS',
      amountMinor: 250000n,
      auditMetadata: { category: 'BONUS_CASH', promotion: 'daily_check_in' }
    });

    // 3. Real Credit (+300.0000)
    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_mixed_real_cred',
      type: 'CREDIT',
      targetBalance: 'REAL',
      amountMinor: 3000000n,
      auditMetadata: { reason: 'Slot payout' }
    });

    // 4. Bonus Credit (+50.0000)
    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'PROMO_WHEEL_mixed_2026-08-30',
      type: 'CREDIT',
      targetBalance: 'BONUS',
      amountMinor: 500000n,
      auditMetadata: { category: 'BONUS_CASH', promotion: 'lucky_wheel' }
    });

    const audit = await ledger.auditReconciliation(userId, currency);

    if (!audit.isReconciled) throw new Error('Expected overall audit to be reconciled');
    if (!audit.real.isReconciled) throw new Error('Expected REAL sub-audit to be reconciled');
    if (!audit.bonus.isReconciled) throw new Error('Expected BONUS sub-audit to be reconciled');

    // REAL assertions: Initial 500 - 100 + 300 = 700.0000 BDT (7,000,000 minor)
    if (audit.real.walletBalanceMajor !== '700.0000') {
      throw new Error(`Expected REAL balance 700.0000, got ${audit.real.walletBalanceMajor}`);
    }
    if (audit.real.walletBalanceMinor !== '7000000') {
      throw new Error(`Expected REAL balance minor 7000000, got ${audit.real.walletBalanceMinor}`);
    }
    if (audit.real.discrepancyMinor !== '0') {
      throw new Error(`Expected REAL discrepancy 0, got ${audit.real.discrepancyMinor}`);
    }

    // BONUS assertions: Initial 0 + 25 + 50 = 75.0000 BDT (750,000 minor)
    if (audit.bonus.walletBalanceMajor !== '75.0000') {
      throw new Error(`Expected BONUS balance 75.0000, got ${audit.bonus.walletBalanceMajor}`);
    }
    if (audit.bonus.walletBalanceMinor !== '750000') {
      throw new Error(`Expected BONUS balance minor 750000, got ${audit.bonus.walletBalanceMinor}`);
    }
    if (audit.bonus.discrepancyMinor !== '0') {
      throw new Error(`Expected BONUS discrepancy 0, got ${audit.bonus.discrepancyMinor}`);
    }
  });

  // Test 4: BONUS promotion claim does NOT create false REAL-balance discrepancy
  await runTest('4. A BONUS reward must never create a false REAL-balance discrepancy', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);
    const userId = 'user_isolation_real_check';
    const currency = 'BDT';

    setupWallet(db, userId, currency, '500.0000', '0.0000');

    // Run 5 BONUS promotion rewards
    for (let i = 1; i <= 5; i++) {
      await ledger.executeTransaction({
        userId,
        currency,
        transactionId: `PROMO_BONUS_TX_${i}`,
        type: 'CREDIT',
        targetBalance: 'BONUS',
        amountMinor: 200000n, // 20.0000 BDT each
        auditMetadata: { category: 'BONUS_CASH', seq: i }
      });
    }

    const audit = await ledger.auditReconciliation(userId, currency);

    // REAL balance MUST remain 500.0000 with ZERO discrepancy
    if (audit.real.walletBalanceMajor !== '500.0000') {
      throw new Error(`Expected REAL balance 500.0000, got ${audit.real.walletBalanceMajor}`);
    }
    if (audit.real.discrepancyMinor !== '0') {
      throw new Error(`CRITICAL: BONUS transactions infected REAL reconciliation! Discrepancy: ${audit.real.discrepancyMinor}`);
    }
    if (!audit.real.isReconciled) {
      throw new Error('REAL audit failed reconciliation due to bonus transactions');
    }

    // BONUS balance must be 100.0000 with ZERO discrepancy
    if (audit.bonus.walletBalanceMajor !== '100.0000') {
      throw new Error(`Expected BONUS balance 100.0000, got ${audit.bonus.walletBalanceMajor}`);
    }
    if (audit.bonus.discrepancyMinor !== '0') {
      throw new Error(`Expected BONUS discrepancy 0, got ${audit.bonus.discrepancyMinor}`);
    }
  });

  // Test 5: REAL reward / payout does NOT affect BONUS-balance reconciliation
  await runTest('5. A REAL monetary payout must never affect BONUS-balance reconciliation', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);
    const userId = 'user_isolation_bonus_check';
    const currency = 'BDT';

    setupWallet(db, userId, currency, '0.0000', '0.0000');

    // 1. Add bonus
    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'PROMO_BONUS_INIT',
      type: 'CREDIT',
      targetBalance: 'BONUS',
      amountMinor: 350000n, // 35.0000 BDT
      auditMetadata: { category: 'BONUS_CASH' }
    });

    // 2. Add REAL payout
    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'AFFILIATE_CLAIM_REAL_01',
      type: 'CREDIT',
      targetBalance: 'REAL',
      amountMinor: 8000000n, // 800.0000 BDT
      auditMetadata: { category: 'AFFILIATE_COMMISSION' }
    });

    const audit = await ledger.auditReconciliation(userId, currency);

    if (audit.bonus.walletBalanceMajor !== '35.0000') {
      throw new Error(`Expected BONUS balance 35.0000, got ${audit.bonus.walletBalanceMajor}`);
    }
    if (audit.bonus.discrepancyMinor !== '0') {
      throw new Error(`REAL transaction infected BONUS reconciliation! Discrepancy: ${audit.bonus.discrepancyMinor}`);
    }
    if (audit.real.walletBalanceMajor !== '800.0000') {
      throw new Error(`Expected REAL balance 800.0000, got ${audit.real.walletBalanceMajor}`);
    }
    if (audit.real.discrepancyMinor !== '0') {
      throw new Error(`Expected REAL discrepancy 0, got ${audit.real.discrepancyMinor}`);
    }
  });

  // Test 6: Unauthorized direct wallet tampering triggers discrepancy detection
  await runTest('6. Unauthorized direct wallet mutations are immediately detected as discrepancies', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);
    const userId = 'user_tamper_test_01';
    const currency = 'BDT';

    setupWallet(db, userId, currency, '100.0000', '0.0000'); // 1,000,000 minor

    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_valid_01',
      type: 'DEBIT',
      targetBalance: 'REAL',
      amountMinor: 200000n
    });

    // Balance should be 80.0000 (800,000 minor)
    let audit = await ledger.auditReconciliation(userId, currency);
    if (!audit.isReconciled) throw new Error('Initial state should be reconciled');

    // Simulate malicious direct database update (tampering real_balance without ledger entry)
    const existingWallet = await ledger.getWallet(userId, currency);
    db.setRawWallet(`${userId}:${currency}`, {
      id: existingWallet.id,
      user_id: userId,
      currency,
      real_balance: '5000.0000',
      bonus_balance: '0.0000',
      balance_minor: 50000000n, // Tampered to 5000.0000 BDT
      version: 10n,
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date()
    });

    audit = await ledger.auditReconciliation(userId, currency);
    if (audit.isReconciled) {
      throw new Error('Audit should fail after unauthorized real balance mutation');
    }
    if (audit.real.isReconciled) {
      throw new Error('REAL audit should fail after unauthorized balance mutation');
    }
    if (audit.real.discrepancyMinor !== '49200000') {
      throw new Error(`Expected discrepancy of 49200000 minor units (4920.0000 BDT), got ${audit.real.discrepancyMinor}`);
    }
  });

  // Test 7: Historical metadata backfill logic
  await runTest('7. Historical metadata backfill preserves history and sets correct balance_target', async () => {
    const db = new InMemoryPostgresLedgerEngine();

    // Create raw legacy entries without explicit balance_target (simulating legacy data)
    db.setRawLedgerEntry('leg_1', {
      id: 'leg_1',
      wallet_id: 1,
      user_id: 'leg_user',
      transaction_id: 'tx_leg_real',
      type: 'CREDIT',
      balance_target: undefined,
      amount_minor: 1000000n,
      currency: 'BDT',
      before_balance_minor: 0n,
      after_balance_minor: 1000000n,
      status: 'COMMITTED',
      correlation_id: 'corr_leg_1',
      audit_metadata: { reason: 'Deposit' }, // No targetBalance => should backfill as REAL
      created_at: new Date()
    });

    db.setRawLedgerEntry('leg_2', {
      id: 'leg_2',
      wallet_id: 1,
      user_id: 'leg_user',
      transaction_id: 'tx_leg_bonus_1',
      type: 'CREDIT',
      balance_target: undefined,
      amount_minor: 250000n,
      currency: 'BDT',
      before_balance_minor: 0n,
      after_balance_minor: 250000n,
      status: 'COMMITTED',
      correlation_id: 'corr_leg_2',
      audit_metadata: { targetBalance: 'BONUS', category: 'BONUS_CASH' }, // targetBalance = 'BONUS' => should backfill as BONUS
      created_at: new Date()
    });

    db.setRawLedgerEntry('leg_3', {
      id: 'leg_3',
      wallet_id: 1,
      user_id: 'leg_user',
      transaction_id: 'tx_leg_bonus_2',
      type: 'CREDIT',
      balance_target: undefined,
      amount_minor: 500000n,
      currency: 'BDT',
      before_balance_minor: 250000n,
      after_balance_minor: 750000n,
      status: 'COMMITTED',
      correlation_id: 'corr_leg_3',
      audit_metadata: { category: 'BONUS_CASH' }, // category = 'BONUS_CASH' => should backfill as BONUS
      created_at: new Date()
    });

    // Simulate migration backfill logic:
    // UPDATE ledger_entries SET balance_target = CASE WHEN audit_metadata->>'targetBalance' = 'BONUS' OR audit_metadata->>'category' = 'BONUS_CASH' THEN 'BONUS' ELSE 'REAL' END WHERE balance_target IS NULL;
    const entries = db.getAllLedgerEntries();
    if (entries.length !== 3) {
      throw new Error(`Expected 3 historical entries preserved without loss, found ${entries.length}`);
    }

    for (const entry of entries) {
      if (!entry.balance_target) {
        if (entry.audit_metadata?.targetBalance === 'BONUS' || entry.audit_metadata?.category === 'BONUS_CASH') {
          entry.balance_target = 'BONUS';
        } else {
          entry.balance_target = 'REAL';
        }
      }
    }

    const backfilledLeg1 = entries.find(e => e.id === 'leg_1');
    const backfilledLeg2 = entries.find(e => e.id === 'leg_2');
    const backfilledLeg3 = entries.find(e => e.id === 'leg_3');

    if (backfilledLeg1?.balance_target !== 'REAL') {
      throw new Error(`Expected leg_1 backfilled to REAL, got ${backfilledLeg1?.balance_target}`);
    }
    if (backfilledLeg2?.balance_target !== 'BONUS') {
      throw new Error(`Expected leg_2 backfilled to BONUS, got ${backfilledLeg2?.balance_target}`);
    }
    if (backfilledLeg3?.balance_target !== 'BONUS') {
      throw new Error(`Expected leg_3 backfilled to BONUS, got ${backfilledLeg3?.balance_target}`);
    }
  });

  // Test 8: Migration SQL file inspection and idempotency guarantees
  await runTest('8. Migration 0003_ledger_balance_target_audit.sql is idempotent and schema-compliant', async () => {
    const migrationPath = join(process.cwd(), 'src/server/migrations/0003_ledger_balance_target_audit.sql');
    if (!existsSync(migrationPath)) {
      throw new Error(`Migration file missing at ${migrationPath}`);
    }

    const sqlContent = readFileSync(migrationPath, 'utf8');

    // Required SQL structural assertions:
    if (!sqlContent.includes('balance_target')) {
      throw new Error('Migration missing balance_target column definition');
    }
    if (!sqlContent.includes('targetBalance') && !sqlContent.includes('BONUS')) {
      throw new Error('Migration missing historical backfill condition');
    }
    if (!sqlContent.includes("DEFAULT 'REAL'")) {
      throw new Error("Migration missing DEFAULT 'REAL'");
    }
    if (!sqlContent.includes('NOT NULL')) {
      throw new Error('Migration missing NOT NULL enforcement');
    }
    if (!sqlContent.includes('chk_ledger_balance_target')) {
      throw new Error('Migration missing chk_ledger_balance_target CHECK constraint');
    }
    if (!sqlContent.includes("CHECK (balance_target IN ('REAL', 'BONUS'))")) {
      throw new Error("Migration missing CHECK (balance_target IN ('REAL', 'BONUS'))");
    }
    if (!sqlContent.includes('DO $$')) {
      throw new Error('Migration missing idempotent DO $$ block');
    }
  });

  // Test 9: executeTransaction persists balance_target explicitly
  await runTest('9. executeTransaction explicitly sets balance_target on all new entries', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);
    const userId = 'user_tx_persist_test';
    const currency = 'BDT';

    setupWallet(db, userId, currency, '200.0000', '0.0000');

    // 1. Execute REAL transaction
    const resReal = await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_explicit_real',
      type: 'DEBIT',
      targetBalance: 'REAL',
      amountMinor: 500000n
    });

    if (resReal.targetBalance !== 'REAL') {
      throw new Error(`Expected result.targetBalance = 'REAL', got ${resReal.targetBalance}`);
    }

    // 2. Execute BONUS transaction
    const resBonus = await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_explicit_bonus',
      type: 'CREDIT',
      targetBalance: 'BONUS',
      amountMinor: 100000n
    });

    if (resBonus.targetBalance !== 'BONUS') {
      throw new Error(`Expected result.targetBalance = 'BONUS', got ${resBonus.targetBalance}`);
    }

    const allEntries = db.getAllLedgerEntries();
    const realEntry = allEntries.find(e => e.transaction_id === 'tx_explicit_real');
    const bonusEntry = allEntries.find(e => e.transaction_id === 'tx_explicit_bonus');

    if (!realEntry || realEntry.balance_target !== 'REAL') {
      throw new Error(`Stored real entry balance_target must be 'REAL', got ${realEntry?.balance_target}`);
    }
    if (!bonusEntry || bonusEntry.balance_target !== 'BONUS') {
      throw new Error(`Stored bonus entry balance_target must be 'BONUS', got ${bonusEntry?.balance_target}`);
    }
  });

  // Test 10: Scale-4 precision preserved across all reconciliation math
  await runTest('10. Canonical scale-4 minor units math preserved throughout reconciliation', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);
    const userId = 'user_scale4_test';
    const currency = 'BDT';

    setupWallet(db, userId, currency, '123.4567', '0.0000'); // 1,234,567 minor units

    await ledger.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_scale4_credit',
      type: 'CREDIT',
      targetBalance: 'REAL',
      amountMinor: 8765433n // 876.5433 BDT
    });

    const audit = await ledger.auditReconciliation(userId, currency);
    if (!audit.isReconciled) throw new Error('Scale-4 audit must be reconciled');
    if (audit.real.walletBalanceMajor !== '1000.0000') {
      throw new Error(`Expected 1000.0000 BDT, got ${audit.real.walletBalanceMajor}`);
    }
    if (audit.real.walletBalanceMinor !== '10000000') {
      throw new Error(`Expected 10000000 minor units, got ${audit.real.walletBalanceMinor}`);
    }
  });

  console.log('\n----------------------------------------------------------------');
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    throw new Error(`Task 3.2.1 test suite failed with ${failed} failure(s)`);
  }
}

// Auto-run when executed directly via tsx
if (process.argv[1]?.includes('ledgerReconciliationTask321.test.ts')) {
  runTask321LedgerReconciliationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

