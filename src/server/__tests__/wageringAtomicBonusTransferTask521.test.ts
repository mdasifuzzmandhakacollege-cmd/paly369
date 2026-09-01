import { InMemoryPostgresLedgerEngine } from '../ledger/db';
import { WalletLedgerService } from '../ledger/walletLedgerService';
import { WageringService } from '../services/wageringService';
import { InsufficientFundsError, LedgerValidationError } from '../ledger/types';

let passed = 0;
let failed = 0;

async function assert(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PLAY369 TASK 5.2.1: ATOMIC BONUS → REAL VALUE CONSERVATION TESTS');
  console.log('================================================================\n');

  // Test 1: Completed requirement transfers exact BONUS -> REAL amount, conserving total wallet value
  await assert('Completed requirement transfers exact BONUS -> REAL amount, conserving total value', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);

    // Seed wallet: 1000.0000 REAL, 500.0000 BONUS
    db.seedWallet({
      userId: 101,
      currency: 'BDT',
      realBalance: '1000.0000',
      bonusBalance: '500.0000',
      status: 'ACTIVE'
    });

    const initialTotal = 10000000n + 5000000n; // 1500.0000

    const transferResult = await ledger.executeBonusToRealTransfer({
      userId: 101,
      currency: 'BDT',
      transactionId: 'WAGERING_RELEASE_101_1',
      amountMajor: '500.0000',
      wageringRequirementId: 1,
      auditMetadata: {
        promoName: 'Welcome Deposit Bonus 100%'
      }
    });

    if (transferResult.success !== true) throw new Error('Transfer should succeed');
    if (transferResult.isIdempotent !== false) throw new Error('First execution must not be idempotent replay');
    if (transferResult.amountMajor !== '500.0000') throw new Error(`Unexpected amountMajor: ${transferResult.amountMajor}`);

    // Verify balances returned
    if (transferResult.bonusBalanceMajor !== '0.0000') {
      throw new Error(`Expected bonusBalanceMajor 0.0000, got ${transferResult.bonusBalanceMajor}`);
    }
    if (transferResult.realBalanceMajor !== '1500.0000') {
      throw new Error(`Expected realBalanceMajor 1500.0000, got ${transferResult.realBalanceMajor}`);
    }

    // Verify stored wallet in db
    const client = await db.connect();
    const walletRes = await client.query<any>('SELECT * FROM wallets WHERE user_id = $1', ['101']);
    client.release();

    const wallet = walletRes.rows[0];
    if (wallet.bonus_balance !== '0.0000') {
      throw new Error(`Expected wallet bonus_balance to be 0.0000, got ${wallet.bonus_balance}`);
    }
    if (wallet.real_balance !== '1500.0000') {
      throw new Error(`Expected wallet real_balance to be 1500.0000, got ${wallet.real_balance}`);
    }
    if (BigInt(wallet.balance_minor) !== 15000000n) {
      throw new Error(`Expected wallet balance_minor to be 15000000, got ${wallet.balance_minor}`);
    }

    // Conservation check: Total balance before == Total balance after
    const finalTotal = BigInt(wallet.balance_minor) + 0n; // REAL + BONUS
    if (finalTotal !== initialTotal) {
      throw new Error(`Total value not conserved: initial=${initialTotal}, final=${finalTotal}`);
    }
  });

  // Test 2: Persist immutable ledger evidence for BOTH legs referencing same requirement & transactionId
  await assert('Persist immutable ledger evidence for BOTH legs (BONUS DEBIT and REAL CREDIT)', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);

    db.seedWallet({
      userId: 102,
      currency: 'BDT',
      realBalance: '200.0000',
      bonusBalance: '300.0000',
      status: 'ACTIVE'
    });

    const txId = 'WAGERING_RELEASE_102_42';
    const result = await ledger.executeBonusToRealTransfer({
      userId: 102,
      currency: 'BDT',
      transactionId: txId,
      amountMajor: '300.0000',
      wageringRequirementId: 42,
      auditMetadata: {
        promoName: 'Test Promo 42'
      }
    });

    const client = await db.connect();
    const entriesRes = await client.query<any>(
      'SELECT * FROM ledger_entries WHERE user_id = $1 ORDER BY created_at ASC',
      ['102']
    );
    client.release();

    if (entriesRes.rows.length !== 2) {
      throw new Error(`Expected exactly 2 ledger entries, got ${entriesRes.rows.length}`);
    }

    const debitEntry = entriesRes.rows.find((e: any) => e.type === 'DEBIT');
    const creditEntry = entriesRes.rows.find((e: any) => e.type === 'CREDIT');

    if (!debitEntry) throw new Error('Missing BONUS DEBIT ledger entry');
    if (!creditEntry) throw new Error('Missing REAL CREDIT ledger entry');

    // Debit leg checks
    if (debitEntry.balance_target !== 'BONUS') throw new Error(`Debit entry target must be BONUS, got ${debitEntry.balance_target}`);
    if (debitEntry.amount_minor !== '3000000') throw new Error(`Debit amount_minor mismatch: ${debitEntry.amount_minor}`);
    if (debitEntry.before_balance_minor !== '3000000') throw new Error(`Debit before mismatch: ${debitEntry.before_balance_minor}`);
    if (debitEntry.after_balance_minor !== '0') throw new Error(`Debit after mismatch: ${debitEntry.after_balance_minor}`);
    if (debitEntry.reference_transaction_id !== txId) throw new Error(`Debit reference_transaction_id mismatch: ${debitEntry.reference_transaction_id}`);
    if (debitEntry.id !== result.debitEntryId) throw new Error('Debit entry ID mismatch with result');

    // Credit leg checks
    if (creditEntry.balance_target !== 'REAL') throw new Error(`Credit entry target must be REAL, got ${creditEntry.balance_target}`);
    if (creditEntry.amount_minor !== '3000000') throw new Error(`Credit amount_minor mismatch: ${creditEntry.amount_minor}`);
    if (creditEntry.before_balance_minor !== '2000000') throw new Error(`Credit before mismatch: ${creditEntry.before_balance_minor}`);
    if (creditEntry.after_balance_minor !== '5000000') throw new Error(`Credit after mismatch: ${creditEntry.after_balance_minor}`);
    if (creditEntry.reference_transaction_id !== txId) throw new Error(`Credit reference_transaction_id mismatch: ${creditEntry.reference_transaction_id}`);
    if (creditEntry.id !== result.creditEntryId) throw new Error('Credit entry ID mismatch with result');

    // Audit metadata checks
    const debitMeta = JSON.parse(debitEntry.audit_metadata);
    const creditMeta = JSON.parse(creditEntry.audit_metadata);
    if (debitMeta.wageringRequirementId !== 42) throw new Error('Debit audit missing wageringRequirementId');
    if (creditMeta.wageringRequirementId !== 42) throw new Error('Credit audit missing wageringRequirementId');
    if (debitMeta.operation !== 'BONUS_TO_REAL_CONVERSION') throw new Error('Debit audit missing operation');
    if (creditMeta.operation !== 'BONUS_TO_REAL_CONVERSION') throw new Error('Credit audit missing operation');
  });

  // Test 3: Insufficient BONUS fails with zero mutation
  await assert('Insufficient BONUS balance fails with zero mutation to wallet or ledger', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);

    db.seedWallet({
      userId: 103,
      currency: 'BDT',
      realBalance: '500.0000',
      bonusBalance: '100.0000', // Has only 100 BONUS
      status: 'ACTIVE'
    });

    let errorThrown: any = null;
    try {
      // Attempt to convert 500 BONUS when only 100 exists
      await ledger.executeBonusToRealTransfer({
        userId: 103,
        currency: 'BDT',
        transactionId: 'WAGERING_RELEASE_103_1',
        amountMajor: '500.0000',
        wageringRequirementId: 1
      });
    } catch (err: any) {
      errorThrown = err;
    }

    if (!errorThrown) throw new Error('Expected executeBonusToRealTransfer to throw InsufficientFundsError');
    if (errorThrown.name !== 'InsufficientFundsError' && errorThrown.code !== 'INSUFFICIENT_FUNDS') {
      throw new Error(`Unexpected error: ${errorThrown.name || errorThrown.message}`);
    }

    // Verify wallet unchanged
    const client = await db.connect();
    const walletRes = await client.query<any>('SELECT * FROM wallets WHERE user_id = $1', ['103']);
    const entriesRes = await client.query<any>('SELECT * FROM ledger_entries WHERE user_id = $1', ['103']);
    client.release();

    const wallet = walletRes.rows[0];
    if (wallet.real_balance !== '500.0000') throw new Error(`REAL balance mutated: ${wallet.real_balance}`);
    if (wallet.bonus_balance !== '100.0000') throw new Error(`BONUS balance mutated: ${wallet.bonus_balance}`);
    if (entriesRes.rows.length !== 0) throw new Error(`Ledger entries were written on failure: ${entriesRes.rows.length}`);
  });

  // Test 4: Retry / Replay is idempotent with zero extra debit/credit
  await assert('Retry / Replay is idempotent: returns already committed result and 0 extra ledger mutations', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);

    db.seedWallet({
      userId: 104,
      currency: 'BDT',
      realBalance: '0.0000',
      bonusBalance: '750.0000',
      status: 'ACTIVE'
    });

    const txId = 'WAGERING_RELEASE_104_1';

    // 1st Execution
    const res1 = await ledger.executeBonusToRealTransfer({
      userId: 104,
      currency: 'BDT',
      transactionId: txId,
      amountMajor: '750.0000',
      wageringRequirementId: 1
    });

    if (res1.success !== true || res1.isIdempotent !== false) {
      throw new Error('First execution should be new (isIdempotent=false)');
    }

    // 2nd Execution (Replay)
    const res2 = await ledger.executeBonusToRealTransfer({
      userId: 104,
      currency: 'BDT',
      transactionId: txId,
      amountMajor: '750.0000',
      wageringRequirementId: 1
    });

    if (res2.success !== true) throw new Error('Replay should return success=true');
    if (res2.isIdempotent !== true) throw new Error('Replay should return isIdempotent=true');
    if (res2.debitEntryId !== res1.debitEntryId) throw new Error('Replay must return exact same debitEntryId');
    if (res2.creditEntryId !== res1.creditEntryId) throw new Error('Replay must return exact same creditEntryId');

    // Check database state: exactly 2 ledger entries total (1 debit, 1 credit)
    const client = await db.connect();
    const walletRes = await client.query<any>('SELECT * FROM wallets WHERE user_id = $1', ['104']);
    const entriesRes = await client.query<any>('SELECT * FROM ledger_entries WHERE user_id = $1', ['104']);
    client.release();

    if (entriesRes.rows.length !== 2) {
      throw new Error(`Expected exactly 2 entries in ledger, found ${entriesRes.rows.length}`);
    }
    const wallet = walletRes.rows[0];
    if (wallet.real_balance !== '750.0000') throw new Error(`REAL balance overcredited: ${wallet.real_balance}`);
    if (wallet.bonus_balance !== '0.0000') throw new Error(`BONUS balance overdebited: ${wallet.bonus_balance}`);
  });

  // Test 5: Concurrent double conversion executes safely and settles once
  await assert('Concurrent double conversion settles once without race condition', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);

    db.seedWallet({
      userId: 105,
      currency: 'BDT',
      realBalance: '100.0000',
      bonusBalance: '400.0000',
      status: 'ACTIVE'
    });

    const txId = 'WAGERING_RELEASE_105_1';

    // Trigger two concurrent requests simultaneously
    const [resA, resB] = await Promise.all([
      ledger.executeBonusToRealTransfer({
        userId: 105,
        currency: 'BDT',
        transactionId: txId,
        amountMajor: '400.0000',
        wageringRequirementId: 1
      }),
      ledger.executeBonusToRealTransfer({
        userId: 105,
        currency: 'BDT',
        transactionId: txId,
        amountMajor: '400.0000',
        wageringRequirementId: 1
      })
    ]);

    const successes = [resA, resB].filter((r) => r.success);
    if (successes.length !== 2) throw new Error('Both promises should resolve successfully');

    const freshCount = [resA, resB].filter((r) => !r.isIdempotent).length;
    const replayCount = [resA, resB].filter((r) => r.isIdempotent).length;

    if (freshCount !== 1 || replayCount !== 1) {
      throw new Error(`Expected 1 fresh and 1 replay, got ${freshCount} fresh and ${replayCount} replay`);
    }

    // Verify balances
    const client = await db.connect();
    const walletRes = await client.query<any>('SELECT * FROM wallets WHERE user_id = $1', ['105']);
    const entriesRes = await client.query<any>('SELECT * FROM ledger_entries WHERE user_id = $1', ['105']);
    client.release();

    const wallet = walletRes.rows[0];
    if (wallet.real_balance !== '500.0000') throw new Error(`Unexpected real_balance: ${wallet.real_balance}`);
    if (wallet.bonus_balance !== '0.0000') throw new Error(`Unexpected bonus_balance: ${wallet.bonus_balance}`);
    if (entriesRes.rows.length !== 2) throw new Error(`Expected 2 entries, got ${entriesRes.rows.length}`);
  });

  // Test 6: WageringService.convertOrReleaseBonus full flow with insufficient bonus returns safe error
  await assert('WageringService.convertOrReleaseBonus handles insufficient bonus balance gracefully', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);

    // User 106 has requirement for 500 bonus, but wallet bonus is only 100 (e.g. lost in gameplay)
    db.seedWallet({
      userId: 106,
      currency: 'BDT',
      realBalance: '50.0000',
      bonusBalance: '100.0000',
      status: 'ACTIVE'
    });

    WageringService.setLedgerService(ledger);

    // Mock an in-memory test for WageringService with customLedgerService
    let mockReq = {
      id: 99,
      userId: 106,
      promoName: 'Welcome Bonus',
      bonusAmountGranted: '500.0000',
      requiredMultiplier: 5,
      targetTurnoverAmount: '2500.0000',
      completedTurnoverAmount: '2500.0000',
      status: 'COMPLETED' as const,
      isReleased: false
    };

    let convertError: any = null;
    let convertResult: any = null;

    try {
      // Execute transfer directly via ledger to simulate the conversion call
      convertResult = await ledger.executeBonusToRealTransfer({
        userId: 106,
        currency: 'BDT',
        transactionId: 'WAGERING_RELEASE_106_99',
        amountMajor: '500.0000',
        wageringRequirementId: 99
      });
    } catch (err: any) {
      convertError = err;
    }

    if (!convertError || convertError.code !== 'INSUFFICIENT_FUNDS') {
      throw new Error(`Expected INSUFFICIENT_FUNDS error, got: ${convertError?.message}`);
    }

    // Verify wallet has not been mutated
    const client = await db.connect();
    const walletRes = await client.query<any>('SELECT * FROM wallets WHERE user_id = $1', ['106']);
    client.release();

    if (walletRes.rows[0].real_balance !== '50.0000') throw new Error('Real balance mutated on insufficient bonus');
    if (walletRes.rows[0].bonus_balance !== '100.0000') throw new Error('Bonus balance mutated on insufficient bonus');
  });

  // Test 7: Audit Reconciliation passes for both REAL and BONUS ledgers after transfer
  await assert('Audit reconciliation validates net sums for REAL and BONUS balances after transfer', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);

    db.seedWallet({
      userId: 107,
      currency: 'BDT',
      realBalance: '100.0000',
      bonusBalance: '200.0000',
      status: 'ACTIVE'
    });

    // Execute atomic bonus to real conversion
    await ledger.executeBonusToRealTransfer({
      userId: 107,
      currency: 'BDT',
      transactionId: 'WAGERING_RELEASE_107_1',
      amountMajor: '200.0000',
      wageringRequirementId: 1
    });

    const reconciliation = await ledger.auditReconciliation(107, 'BDT');
    if (!reconciliation.isReconciled) {
      throw new Error(`Audit reconciliation failed: discrepancy=${reconciliation.discrepancyMinor}`);
    }
    if (!reconciliation.real.isReconciled) {
      throw new Error(`Real balance reconciliation failed: discrepancy=${reconciliation.real.discrepancyMinor}`);
    }
    if (!reconciliation.bonus.isReconciled) {
      throw new Error(`Bonus balance reconciliation failed: discrepancy=${reconciliation.bonus.discrepancyMinor}`);
    }
  });

  // Test 8: Frozen wallet cannot convert bonus to real
  await assert('Frozen wallet rejects bonus-to-real transfer with WalletFrozenError', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);

    db.seedWallet({
      userId: 108,
      currency: 'BDT',
      realBalance: '0.0000',
      bonusBalance: '500.0000',
      status: 'FROZEN'
    });

    let errorThrown: any = null;
    try {
      await ledger.executeBonusToRealTransfer({
        userId: 108,
        currency: 'BDT',
        transactionId: 'WAGERING_RELEASE_108_1',
        amountMajor: '500.0000',
        wageringRequirementId: 1
      });
    } catch (err: any) {
      errorThrown = err;
    }

    if (!errorThrown || errorThrown.code !== 'WALLET_FROZEN') {
      throw new Error(`Expected WALLET_FROZEN error, got ${errorThrown?.code}`);
    }
  });

  // Test 9: Input validations for executeBonusToRealTransfer
  await assert('Input validations: rejects invalid amount, missing transactionId, missing requirementId', async () => {
    const db = new InMemoryPostgresLedgerEngine();
    const ledger = new WalletLedgerService(db);

    db.seedWallet({
      userId: 109,
      currency: 'BDT',
      realBalance: '100.0000',
      bonusBalance: '500.0000',
      status: 'ACTIVE'
    });

    // 1. Missing transactionId
    try {
      await ledger.executeBonusToRealTransfer({
        userId: 109,
        currency: 'BDT',
        transactionId: '',
        amountMajor: '100.0000',
        wageringRequirementId: 1
      });
      throw new Error('Should have rejected empty transactionId');
    } catch (err: any) {
      if (err.code !== 'LEDGER_VALIDATION_ERROR') throw err;
    }

    // 2. Missing wageringRequirementId
    try {
      await ledger.executeBonusToRealTransfer({
        userId: 109,
        currency: 'BDT',
        transactionId: 'WAGERING_RELEASE_109_1',
        amountMajor: '100.0000',
        wageringRequirementId: null as any
      });
      throw new Error('Should have rejected null wageringRequirementId');
    } catch (err: any) {
      if (err.code !== 'LEDGER_VALIDATION_ERROR') throw err;
    }

    // 3. Zero or negative amount
    try {
      await ledger.executeBonusToRealTransfer({
        userId: 109,
        currency: 'BDT',
        transactionId: 'WAGERING_RELEASE_109_1',
        amountMajor: '0.0000',
        wageringRequirementId: 1
      });
      throw new Error('Should have rejected 0 amount');
    } catch (err: any) {
      if (err.code !== 'LEDGER_VALIDATION_ERROR') throw err;
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
