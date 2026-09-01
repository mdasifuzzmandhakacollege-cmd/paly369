/**
 * @file legacyPaymentFailClosedTask613.test.ts
 * @description Test suite for PLAY369 — TASK 6.1.3: Remove Legacy Payment Fake-Success Behavior.
 * 
 * Verifies:
 * 1. All legacy payment adapters fail closed on payout execution:
 *    - success is false
 *    - status is FAILED
 *    - providerReference does NOT generate random fake dispatch references
 *    - code is PROVIDER_NOT_CONFIGURED or PROVIDER_INTEGRATION_INCOMPLETE
 * 2. All legacy payment adapters fail closed on deposit verification:
 *    - verified is false
 *    - status is PENDING_INTEGRATION (or FAILED for invalid TrxID format)
 *    - No adapter returns VERIFIED/SUCCESS
 * 3. Webhook processing fails closed:
 *    - signatureValid is always false
 *    - returns code WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED
 *    - preserves raw amount as string (no Number() / parseFloat() parsing)
 * 4. Raw payload sanitization strips secrets, tokens, pins, passwords, and private keys.
 * 5. Static code verification: Zero usage of Number(), parseFloat(), toFixed() for monetary parsing in paymentAdapters.ts.
 */

import {
  BkashPaymentAdapter,
  NagadPaymentAdapter,
  RocketPaymentAdapter,
  BankTransferPaymentAdapter,
  CardPaymentAdapter,
  sanitizeProviderPayload
} from '../../services/paymentAdapters';
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
  console.log('\n--- PLAY369 TASK 6.1.3: LEGACY PAYMENT FAIL-CLOSED TEST SUITE ---\n');

  const adapters = [
    new BkashPaymentAdapter(),
    new NagadPaymentAdapter(),
    new RocketPaymentAdapter(),
    new BankTransferPaymentAdapter(),
    new CardPaymentAdapter()
  ];

  const dummyWithdrawal: any = {
    id: 'WTH-TEST-999',
    userId: '1001',
    username: 'TestUser',
    amount: 1500,
    currency: 'BDT',
    recipientAccount: '01711223344',
    status: 'CREATED',
    reservedBalanceBefore: 1500,
    availableBalanceBefore: 1500,
    availableBalanceAfter: 0,
    idempotencyKey: 'IDEMP-WTH-999',
    createdAt: new Date().toISOString(),
    auditTrail: []
  };

  const dummyDepositIntent: any = {
    id: 'DEP-TEST-999',
    userId: '1001',
    username: 'TestUser',
    amount: 1000,
    currency: 'BDT',
    status: 'PENDING_PAYMENT',
    expiresAt: new Date(Date.now() + 900000).toISOString(),
    destinationAccount: {
      id: 'ACC-01',
      accountNumber: '01844992200',
      accountName: 'PLAY369 Merchant',
      type: 'MERCHANT',
      qrCodeUrl: ''
    },
    auditTrail: []
  };

  // --------------------------------------------------------------------------
  // Test 1: Payouts Fail Closed Across All Adapters
  // --------------------------------------------------------------------------
  await assert('1. All 5 payment adapters fail closed on executePayout without fake success or random references', async () => {
    for (const adapter of adapters) {
      const payoutResult = await adapter.executePayout({ withdrawal: dummyWithdrawal });

      if (payoutResult.success !== false) {
        throw new Error(`Adapter ${adapter.providerId} returned success: true on executePayout`);
      }
      if (payoutResult.status !== 'FAILED') {
        throw new Error(`Adapter ${adapter.providerId} returned status '${payoutResult.status}', expected 'FAILED'`);
      }
      if (payoutResult.providerReference !== '') {
        throw new Error(`Adapter ${adapter.providerId} generated fake providerReference '${payoutResult.providerReference}'`);
      }
      if (!payoutResult.code || (!['PROVIDER_NOT_CONFIGURED', 'PROVIDER_INTEGRATION_INCOMPLETE'].includes(payoutResult.code))) {
        throw new Error(`Adapter ${adapter.providerId} returned unexpected code: ${payoutResult.code}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // Test 2: Deposit Verification Fails Closed Across All Adapters
  // --------------------------------------------------------------------------
  await assert('2. All 5 payment adapters fail closed on verifyDeposit and never return VERIFIED/SUCCESS', async () => {
    for (const adapter of adapters) {
      const verifyResult = await adapter.verifyDeposit({
        depositIntent: dummyDepositIntent,
        trxId: 'TRX998877A1',
        senderNumber: '01711223344',
        destinationAccount: dummyDepositIntent.destinationAccount
      });

      if (verifyResult.verified !== false) {
        throw new Error(`Adapter ${adapter.providerId} returned verified: true`);
      }
      if (verifyResult.status !== 'PENDING_INTEGRATION') {
        throw new Error(`Adapter ${adapter.providerId} returned status '${verifyResult.status}', expected 'PENDING_INTEGRATION'`);
      }
      if (!verifyResult.code || (!['PROVIDER_NOT_CONFIGURED', 'PROVIDER_INTEGRATION_INCOMPLETE'].includes(verifyResult.code))) {
        throw new Error(`Adapter ${adapter.providerId} returned unexpected code: ${verifyResult.code}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // Test 3: Webhook Verification Fails Closed and Preserves Raw Amount String
  // --------------------------------------------------------------------------
  await assert('3. Webhooks fail closed with signatureValid: false and WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED', async () => {
    for (const adapter of adapters) {
      const webhookPayload = {
        trxID: 'TXN123456',
        issuerTrxId: 'TXN123456',
        txId: 'TXN123456',
        swiftOrNpsbRef: 'TXN123456',
        chargeId: 'ch_123456',
        amount: '1250.75',
        currency: 'BDT'
      };

      const webhookResult = await adapter.processWebhook(webhookPayload, 'some-signature-header');

      if (webhookResult.signatureValid !== false) {
        throw new Error(`Adapter ${adapter.providerId} returned signatureValid: true`);
      }
      if (webhookResult.code !== 'WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED') {
        throw new Error(`Adapter ${adapter.providerId} returned code '${webhookResult.code}', expected 'WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED'`);
      }
      if (webhookResult.rawAmount !== '1250.75') {
        throw new Error(`Adapter ${adapter.providerId} did not preserve raw amount string: got '${webhookResult.rawAmount}'`);
      }
      if (typeof (webhookResult as any).amount === 'number') {
        throw new Error(`Adapter ${adapter.providerId} parsed amount as number`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // Test 4: Payload Sanitization Redacts Sensitive Secrets & PINs
  // --------------------------------------------------------------------------
  await assert('4. sanitizeProviderPayload redacts sensitive credentials, tokens, pins, and auth headers', () => {
    const rawData = {
      orderId: 'ORD-101',
      amount: '500.00',
      apiKey: 'sec_live_98129381293',
      appSecret: 'secret_key_abcdef123456',
      userPin: '1234',
      token: 'jwt.token.here',
      headers: {
        authorization: 'Bearer super_secret_token_value',
        contentType: 'application/json'
      }
    };

    const sanitized = sanitizeProviderPayload(rawData);

    if (sanitized.apiKey !== '***REDACTED***') {
      throw new Error(`Expected apiKey to be redacted, got ${sanitized.apiKey}`);
    }
    if (sanitized.appSecret !== '***REDACTED***') {
      throw new Error(`Expected appSecret to be redacted, got ${sanitized.appSecret}`);
    }
    if (sanitized.userPin !== '***REDACTED***') {
      throw new Error(`Expected userPin to be redacted, got ${sanitized.userPin}`);
    }
    if (sanitized.token !== '***REDACTED***') {
      throw new Error(`Expected token to be redacted, got ${sanitized.token}`);
    }
    if (sanitized.headers.authorization !== '***REDACTED***') {
      throw new Error(`Expected authorization header to be redacted, got ${sanitized.headers.authorization}`);
    }
    if (sanitized.orderId !== 'ORD-101' || sanitized.amount !== '500.00') {
      throw new Error(`Sanitization corrupted non-sensitive data: ${JSON.stringify(sanitized)}`);
    }
  });

  // --------------------------------------------------------------------------
  // Test 5: Static Analysis - Zero Number()/parseFloat()/toFixed() in paymentAdapters.ts
  // --------------------------------------------------------------------------
  await assert('5. Static code analysis: Zero Number(), parseFloat(), or toFixed() usage in paymentAdapters.ts', () => {
    const filePath = path.resolve(process.cwd(), 'src/services/paymentAdapters.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    const lines = content.split('\n');
    const violations: string[] = [];

    lines.forEach((line, index) => {
      // Exclude comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      if (/\bNumber\s*\(/.test(line)) {
        violations.push(`Line ${index + 1}: Found Number() call -> "${trimmed}"`);
      }
      if (/\bparseFloat\s*\(/.test(line)) {
        violations.push(`Line ${index + 1}: Found parseFloat() call -> "${trimmed}"`);
      }
      if (/\.toFixed\s*\(/.test(line)) {
        violations.push(`Line ${index + 1}: Found .toFixed() call -> "${trimmed}"`);
      }
    });

    if (violations.length > 0) {
      throw new Error(`Forbidden monetary conversion methods found in paymentAdapters.ts:\n${violations.join('\n')}`);
    }
  });

  console.log(`\n========================================`);
  console.log(`TASK 6.1.3 TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
