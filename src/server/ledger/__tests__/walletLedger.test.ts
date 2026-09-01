/**
 * @file walletLedger.test.ts
 * @description Comprehensive Test Suite for PLAY369 Wallet Ledger Foundation.
 * 
 * Verifies:
 * 1. Sequential Ledger Operations (Debit, Credit, Reversal)
 * 2. Balance Non-Negative Invariant & Overdraft Prevention
 * 3. Strict Idempotency Handling (Duplicate transaction IDs)
 * 4. High-Concurrency Race Condition Protection (Simultaneous row-locked mutations)
 * 5. Input Validation (Currencies, non-positive amounts, invalid types)
 * 6. Audit Trail & Ledger Balance Reconciliation
 */

import { InMemoryPostgresLedgerEngine } from '../db';
import { WalletLedgerService } from '../walletLedgerService';
import { InsufficientFundsError, LedgerValidationError } from '../types';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 PLAY369 WALLET LEDGER FOUNDATION - VERIFICATION SUITE');
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
  const ledgerService = new WalletLedgerService(engine);

  // Setup test user
  const userId = 'test_player_01';
  const currency = 'BDT';

  // 1. Initial State Check
  await assert('1. Retrieve initial player wallet balance (500.0000 BDT / 5000000 minor)', async () => {
    const wallet = await ledgerService.getWallet(userId, currency);
    if (wallet.balanceMinor !== 5000000n) {
      throw new Error(`Expected balance 5000000n, got ${wallet.balanceMinor}`);
    }
  });

  // 2. Sequential Debit
  await assert('2. Process atomic DEBIT of 150.0000 BDT (1500000 minor)', async () => {
    const result = await ledgerService.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_debit_001',
      type: 'DEBIT',
      amountMinor: 1500000n,
      auditMetadata: { reason: 'Test wager' }
    });

    if (result.afterBalanceMinor !== '3500000' || result.afterBalanceMajor !== '350.0000') {
      throw new Error(`Expected after balance 350.0000, got ${result.afterBalanceMajor}`);
    }
    if (result.isIdempotent) {
      throw new Error('First execution should not be marked idempotent');
    }
  });

  // 3. Strict Idempotency on Duplicate Transaction
  await assert('3. Strict Idempotency: Re-submitting identical tx_debit_001 returns exact cached outcome without altering balance', async () => {
    const initialWallet = await ledgerService.getWallet(userId, currency);

    const dupResult = await ledgerService.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_debit_001',
      type: 'DEBIT',
      amountMinor: 1500000n,
      auditMetadata: { reason: 'Test wager retry' }
    });

    if (!dupResult.isIdempotent) {
      throw new Error('Duplicate transaction must be flagged as idempotent');
    }
    if (dupResult.afterBalanceMinor !== '3500000') {
      throw new Error(`Expected cached balance 3500000, got ${dupResult.afterBalanceMinor}`);
    }

    const currentWallet = await ledgerService.getWallet(userId, currency);
    if (currentWallet.balanceMinor !== initialWallet.balanceMinor) {
      throw new Error(`Wallet balance was mutated during idempotent retry! Before=${initialWallet.balanceMinor}, After=${currentWallet.balanceMinor}`);
    }
  });

  // 4. Sequential Credit
  await assert('4. Process atomic CREDIT of 200.0000 BDT (2000000 minor)', async () => {
    const result = await ledgerService.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_credit_001',
      type: 'CREDIT',
      amountMinor: 2000000n,
      auditMetadata: { reason: 'Test payout' }
    });

    if (result.afterBalanceMinor !== '5500000' || result.afterBalanceMajor !== '550.0000') {
      throw new Error(`Expected after balance 550.0000, got ${result.afterBalanceMajor}`);
    }
  });

  // 5. Reversal / Refund
  await assert('5. Process REVERSAL of 150.0000 BDT referencing tx_debit_001', async () => {
    const result = await ledgerService.executeTransaction({
      userId,
      currency,
      transactionId: 'tx_reversal_001',
      referenceTransactionId: 'tx_debit_001',
      type: 'REVERSAL',
      amountMinor: 1500000n,
      auditMetadata: { reason: 'Cancelled round refund' }
    });

    if (result.afterBalanceMinor !== '7000000' || result.afterBalanceMajor !== '700.0000') {
      throw new Error(`Expected after balance 700.0000, got ${result.afterBalanceMajor}`);
    }
  });

  // 6. Overdraft & Insufficient Funds Guard
  await assert('6. Reject DEBIT exceeding available balance with InsufficientFundsError', async () => {
    try {
      await ledgerService.executeTransaction({
        userId,
        currency,
        transactionId: 'tx_overdraft_fail',
        type: 'DEBIT',
        amountMinor: 99999999n // Far exceeding 700.0000 BDT
      });
      throw new Error('Should have thrown InsufficientFundsError');
    } catch (err: any) {
      if (!(err instanceof InsufficientFundsError)) {
        throw new Error(`Expected InsufficientFundsError, got ${err.name || err}`);
      }
    }
  });

  // 7. Input Validation: Zero or Negative Amounts
  await assert('7. Reject zero or negative amount requests with LedgerValidationError', async () => {
    try {
      await ledgerService.executeTransaction({
        userId,
        currency,
        transactionId: 'tx_invalid_amount',
        type: 'DEBIT',
        amountMinor: 0n
      });
      throw new Error('Should have rejected zero amount');
    } catch (err: any) {
      if (!(err instanceof LedgerValidationError)) {
        throw new Error(`Expected LedgerValidationError, got ${err.name || err}`);
      }
    }
  });

  // 8. Input Validation: Unsupported Currency
  await assert('8. Reject unsupported currency with LedgerValidationError', async () => {
    try {
      await ledgerService.executeTransaction({
        userId,
        currency: 'XYZ_UNKNOWN',
        transactionId: 'tx_invalid_curr',
        type: 'DEBIT',
        amountMinor: 1000n
      });
      throw new Error('Should have rejected invalid currency');
    } catch (err: any) {
      if (!(err instanceof LedgerValidationError)) {
        throw new Error(`Expected LedgerValidationError, got ${err.name || err}`);
      }
    }
  });

  // 9. High-Concurrency Race Condition Protection
  await assert('9. Concurrency: Dispatch 20 concurrent debits and credits simultaneously under row locks', async () => {
    const initialWallet = await ledgerService.getWallet(userId, currency);
    const initialBalance = initialWallet.balanceMinor; // e.g. 70000n

    // 10 concurrent debits of 10.0000 BDT (100000 minor) = -1000000 minor
    // 10 concurrent credits of 15.0000 BDT (150000 minor) = +1500000 minor
    // Expected net change = +500000 minor (50.0000 BDT)
    const promises: Promise<any>[] = [];

    for (let i = 0; i < 10; i++) {
      promises.push(
        ledgerService.executeTransaction({
          userId,
          currency,
          transactionId: `concurrent_debit_${i}_${Date.now()}`,
          type: 'DEBIT',
          amountMinor: 100000n,
          auditMetadata: { index: i }
        })
      );
      promises.push(
        ledgerService.executeTransaction({
          userId,
          currency,
          transactionId: `concurrent_credit_${i}_${Date.now()}`,
          type: 'CREDIT',
          amountMinor: 150000n,
          auditMetadata: { index: i }
        })
      );
    }

    const results = await Promise.all(promises);
    if (results.length !== 20) {
      throw new Error(`Expected 20 successful transactions, got ${results.length}`);
    }

    const finalWallet = await ledgerService.getWallet(userId, currency);
    const expectedFinalBalance = initialBalance + 500000n; // (750.0000 BDT)

    if (finalWallet.balanceMinor !== expectedFinalBalance) {
      throw new Error(`Concurrency race condition detected! Expected ${expectedFinalBalance}, got ${finalWallet.balanceMinor}`);
    }
  });

  // 10. Concurrent Duplicate Idempotency Storm
  await assert('10. Concurrency: 10 simultaneous identical requests with the SAME transaction ID execute exactly once', async () => {
    const startWallet = await ledgerService.getWallet(userId, currency);
    const sharedTxId = `storm_tx_${Date.now()}`;

    const stormPromises = Array.from({ length: 10 }).map(() =>
      ledgerService.executeTransaction({
        userId,
        currency,
        transactionId: sharedTxId,
        type: 'DEBIT',
        amountMinor: 200000n // 20.0000 BDT
      })
    );

    const stormResults = await Promise.all(stormPromises);
    const nonIdempotentCount = stormResults.filter(r => !r.isIdempotent).length;
    const idempotentCount = stormResults.filter(r => r.isIdempotent).length;

    if (nonIdempotentCount !== 1) {
      throw new Error(`Expected exactly 1 non-idempotent execution, but got ${nonIdempotentCount}`);
    }
    if (idempotentCount !== 9) {
      throw new Error(`Expected 9 idempotent cache hits, got ${idempotentCount}`);
    }

    const endWallet = await ledgerService.getWallet(userId, currency);
    if (endWallet.balanceMinor !== startWallet.balanceMinor - 200000n) {
      throw new Error(`Balance deducted multiple times in duplicate storm! Expected ${startWallet.balanceMinor - 200000n}, got ${endWallet.balanceMinor}`);
    }
  });

  // 11. Full Ledger Audit Reconciliation
  await assert('11. Ledger Audit: Sum of all immutable ledger entries reconciles perfectly with wallet balance', async () => {
    const audit = await ledgerService.auditReconciliation(userId, currency);
    if (!audit.isReconciled || audit.discrepancyMinor !== '0') {
      throw new Error(`Audit reconciliation failed: ${JSON.stringify(audit)}`);
    }
  });

  // 12. Atomic Rollback on Failure
  await assert('12. Atomicity: Failed operations roll back completely leaving balance and version intact', async () => {
    const beforeWallet = await ledgerService.getWallet(userId, currency);
    try {
      await ledgerService.executeTransaction({
        userId,
        currency,
        transactionId: 'tx_fail_rollback_test',
        type: 'DEBIT',
        amountMinor: 99999999n // Triggers InsufficientFundsError inside transaction
      });
    } catch {
      // Expected failure
    }

    const afterWallet = await ledgerService.getWallet(userId, currency);
    if (beforeWallet.balanceMinor !== afterWallet.balanceMinor || beforeWallet.version !== afterWallet.version) {
      throw new Error(`Rollback failed! Balance changed from ${beforeWallet.balanceMinor} to ${afterWallet.balanceMinor}`);
    }
  });

  // 13. Direct Database UNIQUE Constraint Enforcement on Ledger Entries
  await assert('13. Database Constraint: Attempting duplicate (user_id, transaction_id) in ledger_entries throws 23505', async () => {
    const client = await engine.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ledger_entries (
           id, wallet_id, user_id, transaction_id, reference_transaction_id,
           type, amount_minor, currency, before_balance_minor, after_balance_minor,
           status, correlation_id, audit_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'COMMITTED', $11, $12)`,
        [
          'test_entry_dup_1',
          1,
          userId,
          'tx_debit_001', // Already exists in ledger
          null,
          'DEBIT',
          '1000',
          currency,
          '5000000',
          '4999000',
          'cid_test',
          '{}'
        ]
      );
      await client.query('COMMIT');
      throw new Error('Should have thrown 23505 unique constraint violation');
    } catch (err: any) {
      if (err.code !== '23505') {
        throw new Error(`Expected error code 23505, got ${err.code || err.message}`);
      }
    } finally {
      client.release();
    }
  });

  // 14. Sensitive Data Masking Verification
  await assert('14. Security: Sensitive data in audit metadata is masked and redacted', async () => {
    const result = await ledgerService.executeTransaction({
      userId,
      currency,
      transactionId: `tx_masking_${Date.now()}`,
      type: 'CREDIT',
      amountMinor: 500n,
      auditMetadata: {
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        cardNumber: '4111111111111234',
        userNotes: 'Safe public note'
      }
    });

    const client = await engine.connect();
    try {
      const res = await client.query(
        `SELECT audit_metadata FROM ledger_entries WHERE transaction_id = $1`,
        [result.transactionId]
      );
      const auditMeta = res.rows[0]?.audit_metadata;
      if (auditMeta.password === 'SuperSecretPassword123!' || auditMeta.token.includes('eyJhbGciOiJIUzI1Ni')) {
        throw new Error(`Sensitive data was not masked: ${JSON.stringify(auditMeta)}`);
      }
    } finally {
      client.release();
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
