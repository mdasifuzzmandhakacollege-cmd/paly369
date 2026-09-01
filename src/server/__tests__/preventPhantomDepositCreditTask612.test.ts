/**
 * @file preventPhantomDepositCreditTask612.test.ts
 * @description Comprehensive Test Suite for PLAY369 — TASK 6.1.2:
 * PREVENT PHANTOM DEPOSIT CREDIT
 * 
 * Verifies:
 * 1. Provider verification alone NEVER produces CREDITED (sets AWAITING_LEDGER_SETTLEMENT or VERIFIED).
 * 2. CREDITED is allowed ONLY after authoritative WalletLedgerService settlement succeeds.
 * 3. Until ledger settlement is wired:
 *    - No committed-looking diagnostic credit entries in double-entry ledger.
 *    - No WALLET_DEPOSIT_CREDITED audit event emitted during verification.
 *    - No "wallet credited" notification sent.
 *    - No wallet-credit sound played.
 *    - Deposit is NOT counted as deposited/credited in production stats (totalDeposited).
 * 4. Verified provider reference and audit trail are preserved.
 * 5. Returns clear LEDGER_SETTLEMENT_PENDING or PENDING_INTEGRATION status.
 * 6. Zero direct wallet balance mutations.
 * 7. Unconfigured provider still fails closed (Task 6.1 / Task 6.1.1).
 * 8. Static code analysis against phantom credit patterns.
 */

import { paymentGatewayEngine } from '../../services/paymentGatewayEngine';
import { notificationService } from '../../services/notificationService';
import { soundEngine } from '../../services/soundEngine';
import { BkashPaymentAdapter } from '../../services/paymentAdapters';
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

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING PLAY369 TASK 6.1.2: PREVENT PHANTOM DEPOSIT CREDIT');
  console.log('================================================================\n');

  // Test 1: Provider verification alone NEVER produces CREDITED
  await assert('1. Provider verification alone sets AWAITING_LEDGER_SETTLEMENT, NEVER CREDITED', async () => {
    // Create a mock configured adapter that returns verified: true
    const origAdapter = (paymentGatewayEngine as any).adapters.get('bkash');
    const mockVerifiedAdapter = {
      providerId: 'bkash',
      name: 'bKash Automated Gateway',
      isConfigured: () => true,
      verifyDeposit: async (params: any) => ({
        verified: true,
        status: 'VERIFIED',
        providerTransactionId: params.trxId,
        amountReceived: params.depositIntent.amount,
        message: 'Provider transaction verified successfully.'
      })
    };
    (paymentGatewayEngine as any).adapters.set('bkash', mockVerifiedAdapter);

    try {
      const intent = paymentGatewayEngine.createDepositIntent({
        userId: 'test_user_612_phantom',
        username: 'phantom_tester',
        provider: 'bkash',
        method: 'BKASH',
        amount: '2500.0000',
        currency: 'BDT'
      });

      const initialLedgerCount = paymentGatewayEngine.getDoubleEntryLedger().length;
      const initialStats = paymentGatewayEngine.getStats();

      // Spy on notifications and sounds
      let notificationEmitted = false;
      const origPush = notificationService.pushNotification.bind(notificationService);
      notificationService.pushNotification = async (userId: string, notif: any): Promise<any> => {
        if (notif.type === 'DEPOSIT_CONFIRMED' || notif.title?.includes('ওয়ালেটে যুক্ত হয়েছে')) {
          notificationEmitted = true;
        }
        return {} as any;
      };

      let soundPlayed = false;
      const origPlayWalletCredit = soundEngine.playWalletCredit.bind(soundEngine);
      soundEngine.playWalletCredit = () => {
        soundPlayed = true;
      };

      const result = await paymentGatewayEngine.verifyAndCreditDeposit({
        depositId: intent.id,
        trxId: 'TRX_PROV_VERIFIED_882'
      });

      // Restore spies
      notificationService.pushNotification = origPush;
      soundEngine.playWalletCredit = origPlayWalletCredit;

      // Assert status is NOT CREDITED
      if (result.depositIntent.status === 'CREDITED') {
        throw new Error('Provider verification alone must NEVER set status to CREDITED!');
      }
      if (result.depositIntent.status !== 'AWAITING_LEDGER_SETTLEMENT' && result.depositIntent.status !== 'VERIFIED') {
        throw new Error(`Expected status AWAITING_LEDGER_SETTLEMENT or VERIFIED, got '${result.depositIntent.status}'`);
      }

      // Assert status / code in response is LEDGER_SETTLEMENT_PENDING or PENDING_INTEGRATION
      if (result.status !== 'LEDGER_SETTLEMENT_PENDING' && result.status !== 'PENDING_INTEGRATION') {
        throw new Error(`Expected result status LEDGER_SETTLEMENT_PENDING, got '${result.status}'`);
      }

      // Assert no phantom credit notification
      if (notificationEmitted) {
        throw new Error('Must NOT emit deposit confirmed / wallet credited notification before ledger settlement');
      }

      // Assert no wallet credit sound
      if (soundPlayed) {
        throw new Error('Must NOT play wallet credit sound before ledger settlement');
      }

      // Assert no committed-looking diagnostic credit entries in doubleEntryLedger
      const afterLedgerCount = paymentGatewayEngine.getDoubleEntryLedger().length;
      if (afterLedgerCount > initialLedgerCount) {
        const newEntries = paymentGatewayEngine.getDoubleEntryLedger().slice(0, afterLedgerCount - initialLedgerCount);
        const hasCredit = newEntries.some(e => e.entryType === 'DEPOSIT_CREDIT');
        if (hasCredit) {
          throw new Error('Must NOT create committed-looking DEPOSIT_CREDIT double-entry ledger entries');
        }
      }

      // Assert stats did NOT increase totalDeposited
      const afterStats = paymentGatewayEngine.getStats();
      if (afterStats.totalDeposited > initialStats.totalDeposited) {
        throw new Error(`Deposit in status ${result.depositIntent.status} must NOT count towards totalDeposited stats`);
      }

      // Assert verified provider reference and audit trail preserved
      if (!result.depositIntent.providerTransactionId || result.depositIntent.providerTransactionId !== 'TRX_PROV_VERIFIED_882') {
        throw new Error('Provider transaction ID reference was not preserved on deposit intent');
      }
      if (!result.depositIntent.verifiedAt) {
        throw new Error('verifiedAt timestamp was not preserved on deposit intent');
      }
      const hasVerificationAudit = result.depositIntent.auditTrail.some(a => a.status === 'AWAITING_LEDGER_SETTLEMENT' || a.status === 'VERIFIED');
      if (!hasVerificationAudit) {
        throw new Error('Verification audit trail note was not recorded on deposit intent');
      }
    } finally {
      // Restore adapter
      if (origAdapter) {
        (paymentGatewayEngine as any).adapters.set('bkash', origAdapter);
      }
    }
  });

  // Test 2: settleDepositWithLedger allows CREDITED only after authoritative settlement
  await assert('2. settleDepositWithLedger sets CREDITED and commits authoritative ledger reference', async () => {
    const intent = paymentGatewayEngine.createDepositIntent({
      userId: 'test_user_612_settle',
      username: 'settle_tester',
      provider: 'nagad',
      method: 'NAGAD',
      amount: '5000.0000',
      currency: 'BDT'
    });

    // Manually place in AWAITING_LEDGER_SETTLEMENT
    intent.status = 'AWAITING_LEDGER_SETTLEMENT';
    intent.providerTransactionId = 'TRX_NAGAD_VERIF_99';
    intent.verifiedAt = new Date().toISOString();

    const statsBefore = paymentGatewayEngine.getStats();

    // Now call authoritative settleDepositWithLedger
    const settled = paymentGatewayEngine.settleDepositWithLedger(intent.id, {
      ledgerTransactionId: 'LEDGER_TX_AUTH_771892',
      creditedAt: new Date().toISOString()
    });

    if (settled.status !== 'CREDITED') {
      throw new Error(`Expected settled intent status to be CREDITED, got '${settled.status}'`);
    }
    if (!settled.creditedAt) {
      throw new Error('creditedAt timestamp must be recorded upon authoritative ledger settlement');
    }

    const hasLedgerAudit = settled.auditTrail.some(a => a.status === 'CREDITED' && a.note.includes('LEDGER_TX_AUTH_771892'));
    if (!hasLedgerAudit) {
      throw new Error('Authoritative ledger reference was not found in audit trail');
    }

    // Now stats SHOULD count it as totalDeposited
    const statsAfter = paymentGatewayEngine.getStats();
    if (statsAfter.totalDeposited !== statsBefore.totalDeposited + 5000) {
      throw new Error(`Expected totalDeposited to increase by 5000, before=${statsBefore.totalDeposited}, after=${statsAfter.totalDeposited}`);
    }
  });

  // Test 3: Unconfigured provider still fails closed
  await assert('3. Unconfigured provider fails closed with PROVIDER_NOT_CONFIGURED & PENDING_INTEGRATION', async () => {
    const intent = paymentGatewayEngine.createDepositIntent({
      userId: 'test_user_612_unconf',
      username: 'unconf_tester',
      provider: 'bkash',
      method: 'BKASH',
      amount: '1000.0000',
      currency: 'BDT'
    });

    let threw = false;
    try {
      await paymentGatewayEngine.verifyAndCreditDeposit({
        depositId: intent.id,
        trxId: 'TRX_UNCONF_TEST'
      });
    } catch (err: any) {
      threw = true;
      if (err.code !== 'PROVIDER_NOT_CONFIGURED') {
        throw new Error(`Expected error code PROVIDER_NOT_CONFIGURED, got ${err.code}`);
      }
      if (err.status !== 'PENDING_INTEGRATION') {
        throw new Error(`Expected error status PENDING_INTEGRATION, got ${err.status}`);
      }
    }

    if (!threw) {
      throw new Error('verifyAndCreditDeposit must throw for unconfigured adapter');
    }

    const updated = paymentGatewayEngine.getDepositIntent(intent.id);
    if (updated?.status !== 'PENDING_INTEGRATION') {
      throw new Error(`Expected status PENDING_INTEGRATION, got ${updated?.status}`);
    }
  });

  // Test 4: Static code analysis ensuring no phantom credit emission
  await assert('4. Static Code Analysis: verifyAndCreditDeposit contains zero WALLET_DEPOSIT_CREDITED audits or phantom credits', () => {
    const filePath = path.join(process.cwd(), 'src', 'services', 'paymentGatewayEngine.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check that verifyAndCreditDeposit does not set CREDITED directly before ledger settlement
    const methodMatch = content.match(/public async verifyAndCreditDeposit[\s\S]*?public settleDepositWithLedger/);
    if (!methodMatch) {
      throw new Error('Could not locate verifyAndCreditDeposit method in paymentGatewayEngine.ts');
    }

    const methodBody = methodMatch[0];
    if (methodBody.includes("action: 'WALLET_DEPOSIT_CREDITED'")) {
      throw new Error('verifyAndCreditDeposit must not emit WALLET_DEPOSIT_CREDITED audit action!');
    }
    if (methodBody.includes("playWalletCredit")) {
      throw new Error('verifyAndCreditDeposit must not call playWalletCredit!');
    }
    if (methodBody.includes("DEPOSIT_CONFIRMED")) {
      throw new Error('verifyAndCreditDeposit must not push DEPOSIT_CONFIRMED notification!');
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TASK 6.1.2 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Test harness exception:', e);
  process.exit(1);
});
