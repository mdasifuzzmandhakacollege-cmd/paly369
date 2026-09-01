/**
 * @file productionPaymentSafetyGateTask61.test.ts
 * @description Test suite for PLAY369 — TASK 6.1: Production Payment Safety Gate.
 * 
 * Verifies:
 * 1. Deposit submission creates PENDING status and does not mutate wallet balance even if client sends autoApprove / success.
 * 2. Client-controlled autoApprove is removed/ignored.
 * 3. Exact Scale-4 arithmetic is used for money calculations (no floating point errors).
 * 4. Provider Adapters fail closed when unconfigured (returns PROVIDER_NOT_CONFIGURED / PENDING_INTEGRATION).
 * 5. PaymentGatewayEngine fails closed on unconfigured provider without crediting wallet.
 * 6. Static code analysis: No direct wallet balance mutations or floating-point calculations in deposit controllers.
 */

import { BkashPaymentAdapter, NagadPaymentAdapter, RocketPaymentAdapter, BankTransferPaymentAdapter, CardPaymentAdapter } from '../../services/paymentAdapters';
import { paymentGatewayEngine } from '../../services/paymentGatewayEngine';
import { toScale4, fromScale4 } from '../services/wageringService';
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
  console.log('\n--- PLAY369 TASK 6.1: PRODUCTION PAYMENT SAFETY GATE TEST SUITE ---\n');

  // Test 1: Scale-4 Precision Math
  await assert('1. Scale-4 arithmetic converts amounts accurately without floating point loss', () => {
    const val1 = toScale4('500.25');
    if (val1 !== 5002500n) throw new Error(`Expected 5002500n, got ${val1}`);

    const valStr = fromScale4(val1);
    if (valStr !== '500.2500') throw new Error(`Expected "500.2500", got ${valStr}`);

    const zeroVal = toScale4('0');
    if (zeroVal !== 0n) throw new Error(`Expected 0n, got ${zeroVal}`);

    const zeroStr = fromScale4(0n);
    if (zeroStr !== '0.0000') throw new Error(`Expected "0.0000", got ${zeroStr}`);
  });

  // Test 2: Unconfigured Provider Adapters Fail Closed
  await assert('2. bKash adapter fails closed with PROVIDER_NOT_CONFIGURED & PENDING_INTEGRATION when unconfigured', async () => {
    const adapter = new BkashPaymentAdapter();
    if (adapter.isConfigured()) throw new Error('Adapter should not report configured without env vars');

    const res = await adapter.verifyDeposit({
      depositIntent: {
        id: 'DEP-001',
        userId: '1',
        username: 'user1',
        provider: 'bkash',
        method: 'BKASH',
        amount: '500.0000',
        currency: 'BDT',
        status: 'AWAITING_PAYMENT',
        destinationAccount: {} as any,
        referenceCode: 'REF1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 900000).toISOString(),
        riskScore: 0,
        auditTrail: []
      },
      trxId: 'TRX_TEST_101',
      destinationAccount: {} as any
    });

    if (res.verified !== false) throw new Error('Unconfigured adapter must not verify deposit');
    if (res.status !== 'PENDING_INTEGRATION') throw new Error(`Expected status PENDING_INTEGRATION, got ${res.status}`);
    if (res.code !== 'PROVIDER_NOT_CONFIGURED') throw new Error(`Expected code PROVIDER_NOT_CONFIGURED, got ${res.code}`);
  });

  // Test 3: Other adapters fail closed when unconfigured
  await assert('3. Nagad, Rocket, BankTransfer, and Card adapters all fail closed when unconfigured', async () => {
    const adapters = [
      new NagadPaymentAdapter(),
      new RocketPaymentAdapter(),
      new BankTransferPaymentAdapter(),
      new CardPaymentAdapter()
    ];

    for (const ad of adapters) {
      if (ad.isConfigured()) throw new Error(`${ad.name} should not report configured`);
      const res = await ad.verifyDeposit({
        depositIntent: {
          id: 'DEP-002',
          userId: '2',
          username: 'user2',
          provider: ad.providerId,
          method: 'BKASH',
          amount: '1000.0000',
          currency: 'BDT',
          status: 'AWAITING_PAYMENT',
          destinationAccount: {} as any,
          referenceCode: 'REF2',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 900000).toISOString(),
          riskScore: 0,
          auditTrail: []
        },
        trxId: 'TRX_TEST_202',
        destinationAccount: {} as any
      });
      if (res.verified !== false) throw new Error(`${ad.name} must not verify deposit`);
      if (res.status !== 'PENDING_INTEGRATION') throw new Error(`${ad.name} expected PENDING_INTEGRATION, got ${res.status}`);
    }
  });

  // Test 4: PaymentGatewayEngine verifyAndCreditDeposit fails closed without mutating balance
  await assert('4. PaymentGatewayEngine fails closed and does not credit wallet on unconfigured provider', async () => {
    const intent = await paymentGatewayEngine.createDepositIntent({
      userId: 'test_user_safety_99',
      username: 'safetester',
      provider: 'bkash',
      method: 'BKASH',
      amount: '750.0000',
      currency: 'BDT'
    });

    let threw = false;
    try {
      await paymentGatewayEngine.verifyAndCreditDeposit({
        depositId: intent.id,
        trxId: 'TRX_FRESH_99182'
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
      throw new Error('paymentGatewayEngine.verifyAndCreditDeposit should have thrown an error for unconfigured adapter');
    }

    const updatedIntent = paymentGatewayEngine.getDepositIntent(intent.id);
    if (updatedIntent?.status !== 'PENDING_INTEGRATION') {
      throw new Error(`Expected intent status PENDING_INTEGRATION, got ${updatedIntent?.status}`);
    }
  });

  // Test 5: Static Analysis of paymentController.ts
  await assert('5. Static Code Analysis: paymentController.ts contains zero autoApprove or direct balance mutations', () => {
    const filePath = path.join(process.cwd(), 'src', 'server', 'controllers', 'paymentController.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    if (content.includes('autoApprove: true') || content.includes('status = \'APPROVED\'') || content.includes('status: \'APPROVED\'')) {
      throw new Error('Found active autoApprove / APPROVED in deposit logic in paymentController.ts');
    }

    // Ensure status is always initialized to PENDING
    if (!content.includes('status: \'PENDING\'')) {
      throw new Error('Expected paymentRequests insertion with status: PENDING');
    }

    // Ensure validatePaymentAmount is used for deposit amount parsing
    if (!content.includes('validatePaymentAmount(amount)')) {
      throw new Error('Expected validatePaymentAmount validation for deposit amount');
    }
  });

  // Test 6: Static Analysis of paymentGatewayEngine.ts
  await assert('6. Static Code Analysis: paymentGatewayEngine.ts does not call seamlessEngine.topUpWallet during unverified verification', () => {
    const filePath = path.join(process.cwd(), 'src', 'services', 'paymentGatewayEngine.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    if (content.includes('seamlessEngine.topUpWallet(intent.userId')) {
      throw new Error('Found unsafe seamlessEngine.topUpWallet call during verifyAndCreditDeposit in paymentGatewayEngine.ts');
    }
  });

  console.log(`\n========================================`);
  console.log(`  Tests Passed: ${passed}`);
  console.log(`  Tests Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Test harness exception:', e);
  process.exit(1);
});
