/**
 * @file paymentAmountScale4Task614.test.ts
 * @description Comprehensive Test Suite for PLAY369 — TASK 6.1.4:
 * STRICT PAYMENT AMOUNT BOUNDARY & SCALE-4 PRECISION
 *
 * Verifies:
 * 1. Canonical scale-4 money parser & validator unit tests
 * 2. Exact decimal string representations and minor unit calculations (scale 4, 1.0000 = 10000n)
 * 3. Strict input validation rejecting over-precision (> 4 decimal places), scientific notation, negative numbers, NaN/Infinity
 * 4. PaymentGatewayController deposit and withdrawal HTTP endpoint validations
 * 5. Static code analysis: zero Number(amount) or floating-point conversions in controllers
 */

import { validatePaymentAmount, toScale4, fromScale4 } from '../utils/paymentAmount';
import { PaymentGatewayController } from '../controllers/paymentGatewayController';
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

function expectThrow(fn: () => void, match: RegExp, msg?: string) {
  try {
    fn();
    throw new Error(msg || 'Expected function to throw, but it succeeded.');
  } catch (err: any) {
    if (err.message === (msg || 'Expected function to throw, but it succeeded.')) {
      throw err;
    }
    if (!match.test(err.message)) {
      throw new Error(`Expected error message to match ${match}, but got "${err.message}"`);
    }
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING PLAY369 TASK 6.1.4: STRICT PAYMENT AMOUNT & SCALE-4');
  console.log('================================================================\n');

  // Test 1: Valid scale-4 conversions
  await assert('1. Valid exact decimal strings parsed to scale-4 minor units and canonical strings', () => {
    const res1 = validatePaymentAmount('100');
    if (res1.raw !== '100' || res1.minorUnits !== 1000000n || res1.decimalString !== '100.0000') {
      throw new Error(`Unexpected result for "100": ${JSON.stringify(res1)}`);
    }

    const res2 = validatePaymentAmount('100.0000');
    if (res2.raw !== '100.0000' || res2.minorUnits !== 1000000n || res2.decimalString !== '100.0000') {
      throw new Error(`Unexpected result for "100.0000": ${JSON.stringify(res2)}`);
    }

    const res3 = validatePaymentAmount('0.0516');
    if (res3.raw !== '0.0516' || res3.minorUnits !== 516n || res3.decimalString !== '0.0516') {
      throw new Error(`Unexpected result for "0.0516": ${JSON.stringify(res3)}`);
    }

    const res4 = validatePaymentAmount('50.5');
    if (res4.minorUnits !== 505000n || res4.decimalString !== '50.5000') {
      throw new Error(`Unexpected result for "50.5": ${JSON.stringify(res4)}`);
    }
  });

  // Test 2: Over-precision fractional rejection
  await assert('2. Rejects over-precision fractional digits > 4 decimal places without truncation', () => {
    expectThrow(() => validatePaymentAmount('1.23456'), /Over-precision monetary input rejected/);
    expectThrow(() => validatePaymentAmount('0.00001'), /Over-precision monetary input rejected/);
    expectThrow(() => validatePaymentAmount('99.99999'), /Over-precision monetary input rejected/);
  });

  // Test 3: Scientific notation rejection
  await assert('3. Rejects scientific notation strings in monetary input', () => {
    expectThrow(() => validatePaymentAmount('1e3'), /Scientific notation is not allowed/);
    expectThrow(() => validatePaymentAmount('1E5'), /Scientific notation is not allowed/);
    expectThrow(() => validatePaymentAmount('2.5e-2'), /Scientific notation is not allowed/);
  });

  // Test 4: Negative & zero amount rejection
  await assert('4. Rejects negative, zero, and empty monetary amounts', () => {
    expectThrow(() => validatePaymentAmount('-100'), /cannot be negative/);
    expectThrow(() => validatePaymentAmount('-0.0516'), /cannot be negative/);
    expectThrow(() => validatePaymentAmount('0'), /strictly greater than zero/);
    expectThrow(() => validatePaymentAmount('0.0000'), /strictly greater than zero/);
    expectThrow(() => validatePaymentAmount(''), /Monetary amount is required/);
    expectThrow(() => validatePaymentAmount('   '), /Monetary amount is required/);
    expectThrow(() => validatePaymentAmount(null), /Monetary amount is required/);
    expectThrow(() => validatePaymentAmount(undefined), /Monetary amount is required/);
  });

  // Test 5: Rejection of JS numbers (Task 6.1.4.1)
  await assert('5. validatePaymentAmount rejects JavaScript/JSON numbers with UNSAFE_NUMERIC_MONEY_INPUT', () => {
    expectThrow(() => validatePaymentAmount(100), /UNSAFE_NUMERIC_MONEY_INPUT/);
    expectThrow(() => validatePaymentAmount(100.5), /UNSAFE_NUMERIC_MONEY_INPUT/);
    expectThrow(() => validatePaymentAmount(0.0516), /UNSAFE_NUMERIC_MONEY_INPUT/);
    expectThrow(() => validatePaymentAmount(1e3), /UNSAFE_NUMERIC_MONEY_INPUT/);
  });

  // Test 6: Malformed formats rejection
  await assert('6. Rejects NaN, Infinity, -Infinity and malformed format strings', () => {
    expectThrow(() => validatePaymentAmount(NaN), /UNSAFE_NUMERIC_MONEY_INPUT/);
    expectThrow(() => validatePaymentAmount(Infinity), /UNSAFE_NUMERIC_MONEY_INPUT/);
    expectThrow(() => validatePaymentAmount('NaN'), /Invalid monetary amount format/);
    expectThrow(() => validatePaymentAmount('Infinity'), /Invalid monetary amount format/);
    expectThrow(() => validatePaymentAmount('-Infinity'), /Invalid monetary amount format|cannot be negative/);
    expectThrow(() => validatePaymentAmount('abc'), /Invalid monetary decimal string format/);
    expectThrow(() => validatePaymentAmount('1.2.3'), /Invalid monetary decimal string format/);
    expectThrow(() => validatePaymentAmount('.5'), /Invalid monetary decimal string format/);
    expectThrow(() => validatePaymentAmount('1.'), /Invalid monetary decimal string format/);
  });

  // Test 7: toScale4 rejects unsafe JS number types
  await assert('7. toScale4 rejects unsafe JS floating point numbers with UNSAFE_NUMERIC_MONEY_INPUT', () => {
    expectThrow(() => toScale4(100 as any), /UNSAFE_NUMERIC_MONEY_INPUT/);
    expectThrow(() => toScale4(0.0516 as any), /UNSAFE_NUMERIC_MONEY_INPUT/);
  });

  // Test 8: HTTP Controller Endpoint Validation
  const controller = new PaymentGatewayController();
  const mockResponse = () => {
    const res: any = {};
    res.statusCode = 200;
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data: any) => {
      res.body = data;
      return res;
    };
    return res;
  };

  await assert('8. PaymentGatewayController deposit rejects numeric amounts (100, 0.0516) with 400 & UNSAFE_NUMERIC_MONEY_INPUT', async () => {
    const req1: any = {
      user: { uid: 'firebase_101' },
      mockUser: { id: 101, uid: 'firebase_101', username: 'Player1' },
      body: { userId: '101', username: 'Player1', provider: 'bkash', amount: 100 },
      headers: {},
      socket: {}
    };
    const res1 = mockResponse();
    await controller.createDepositIntent(req1, res1);
    if (res1.statusCode !== 400 || !res1.body.error.includes('UNSAFE_NUMERIC_MONEY_INPUT')) {
      throw new Error(`Expected 400 with UNSAFE_NUMERIC_MONEY_INPUT, got ${res1.statusCode} ${JSON.stringify(res1.body)}`);
    }

    const req2: any = {
      user: { uid: 'firebase_101' },
      mockUser: { id: 101, uid: 'firebase_101', username: 'Player1' },
      body: { userId: '101', username: 'Player1', provider: 'bkash', amount: 0.0516 },
      headers: {},
      socket: {}
    };
    const res2 = mockResponse();
    await controller.createDepositIntent(req2, res2);
    if (res2.statusCode !== 400 || !res2.body.error.includes('UNSAFE_NUMERIC_MONEY_INPUT')) {
      throw new Error(`Expected 400 with UNSAFE_NUMERIC_MONEY_INPUT, got ${res2.statusCode} ${JSON.stringify(res2.body)}`);
    }
  });

  await assert('9. PaymentGatewayController deposit rejects over-precision, scientific notation & negative amounts', async () => {
    // Over-precision
    const req1: any = {
      user: { uid: 'firebase_101' },
      mockUser: { id: 101, uid: 'firebase_101', username: 'Player1' },
      body: { userId: '101', username: 'Player1', provider: 'bkash', amount: '1.23456' },
      headers: {},
      socket: {}
    };
    const res1 = mockResponse();
    await controller.createDepositIntent(req1, res1);
    if (res1.statusCode !== 400 || !res1.body.error.includes('Over-precision monetary input rejected')) {
      throw new Error(`Expected 400 with over-precision error, got ${res1.statusCode} ${JSON.stringify(res1.body)}`);
    }

    // Scientific notation
    const req2: any = {
      user: { uid: 'firebase_101' },
      mockUser: { id: 101, uid: 'firebase_101', username: 'Player1' },
      body: { userId: '101', username: 'Player1', provider: 'bkash', amount: '1e3' },
      headers: {},
      socket: {}
    };
    const res2 = mockResponse();
    await controller.createDepositIntent(req2, res2);
    if (res2.statusCode !== 400 || !res2.body.error.includes('Scientific notation is not allowed')) {
      throw new Error(`Expected 400 with scientific notation error, got ${res2.statusCode} ${JSON.stringify(res2.body)}`);
    }

    // Negative amount
    const req3: any = {
      user: { uid: 'firebase_101' },
      mockUser: { id: 101, uid: 'firebase_101', username: 'Player1' },
      body: { userId: '101', username: 'Player1', provider: 'bkash', amount: '-500' },
      headers: {},
      socket: {}
    };
    const res3 = mockResponse();
    await controller.createDepositIntent(req3, res3);
    if (res3.statusCode !== 400 || !res3.body.error.includes('cannot be negative')) {
      throw new Error(`Expected 400 with negative amount error, got ${res3.statusCode} ${JSON.stringify(res3.body)}`);
    }
  });

  await assert('10. PaymentGatewayController accepts valid scale-4 decimal strings ("100", "0.0516") without float conversions', async () => {
    const req1: any = {
      user: { uid: 'firebase_101' },
      mockUser: { id: 101, uid: 'firebase_101', username: 'Player1' },
      body: { userId: '101', username: 'Player1', provider: 'bkash', amount: '100' },
      headers: {},
      socket: {}
    };
    const res1 = mockResponse();
    await controller.createDepositIntent(req1, res1);
    if (res1.statusCode !== 201 || !res1.body.success || res1.body.data.amount !== '100.0000') {
      throw new Error(`Expected 201 with amount '100.0000', got ${res1.statusCode} ${JSON.stringify(res1.body)}`);
    }

    const req2: any = {
      user: { uid: 'firebase_101' },
      mockUser: { id: 101, uid: 'firebase_101', username: 'Player1' },
      body: { userId: '101', username: 'Player1', provider: 'bkash', amount: '0.0516' },
      headers: {},
      socket: {}
    };
    const res2 = mockResponse();
    await controller.createDepositIntent(req2, res2);
    if (res2.statusCode !== 201 || !res2.body.success || res2.body.data.amount !== '0.0516') {
      throw new Error(`Expected 201 with amount '0.0516', got ${res2.statusCode} ${JSON.stringify(res2.body)}`);
    }
  });

  await assert('11. PaymentGatewayController withdrawal rejects numeric amount & invalid formats', async () => {
    const req1: any = {
      user: { uid: 'firebase_101' },
      mockUser: { id: 101, uid: 'firebase_101', username: 'Player1' },
      body: { userId: '101', username: 'Player1', provider: 'nagad', amount: 500, recipientAccount: '01811223344' },
      headers: {},
      socket: {}
    };
    const res1 = mockResponse();
    await controller.requestWithdrawal(req1, res1);
    if (res1.statusCode !== 400 || !res1.body.error.includes('UNSAFE_NUMERIC_MONEY_INPUT')) {
      throw new Error(`Expected 400 with UNSAFE_NUMERIC_MONEY_INPUT, got ${res1.statusCode} ${JSON.stringify(res1.body)}`);
    }

    const req2: any = {
      user: { uid: 'firebase_101' },
      mockUser: { id: 101, uid: 'firebase_101', username: 'Player1' },
      body: { userId: '101', username: 'Player1', provider: 'nagad', amount: 'abc', recipientAccount: '01811223344' },
      headers: {},
      socket: {}
    };
    const res2 = mockResponse();
    await controller.requestWithdrawal(req2, res2);
    if (res2.statusCode !== 400 || !res2.body.error.includes('Invalid monetary amount')) {
      throw new Error(`Expected 400 with invalid monetary amount error, got ${res2.statusCode} ${JSON.stringify(res2.body)}`);
    }
  });

  // Test 12: Static code analysis of controllers
  await assert('12. Static Code Analysis: controllers contain ZERO Number(amount) or String(amount) rescues', () => {
    const pgcPath = path.join(process.cwd(), 'src', 'server', 'controllers', 'paymentGatewayController.ts');
    const pgcContent = fs.readFileSync(pgcPath, 'utf-8');
    if (pgcContent.includes('Number(amount)')) {
      throw new Error('paymentGatewayController.ts must not contain Number(amount) conversions');
    }
    if (pgcContent.includes('String(amount)')) {
      throw new Error('paymentGatewayController.ts must not contain String(amount) rescues');
    }
    if (pgcContent.includes('parseFloat(amount)')) {
      throw new Error('paymentGatewayController.ts must not contain parseFloat(amount)');
    }
    if (!pgcContent.includes('typeof amount !== \'string\'')) {
      throw new Error('paymentGatewayController.ts must check typeof amount !== \'string\'');
    }

    const pcPath = path.join(process.cwd(), 'src', 'server', 'controllers', 'paymentController.ts');
    const pcContent = fs.readFileSync(pcPath, 'utf-8');
    if (pcContent.includes('Number(amount)')) {
      throw new Error('paymentController.ts must not contain Number(amount) conversions');
    }
    if (pcContent.includes('String(amount)')) {
      throw new Error('paymentController.ts must not contain String(amount) rescues');
    }
    if (pcContent.includes('parseFloat(amount)')) {
      throw new Error('paymentController.ts must not contain parseFloat(amount)');
    }
    if (!pcContent.includes('typeof amount !== \'string\'')) {
      throw new Error('paymentController.ts must check typeof amount !== \'string\'');
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TASK 6.1.4 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((e) => {
  console.error('Test harness exception:', e);
  process.exit(1);
});
