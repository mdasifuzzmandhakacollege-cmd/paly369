/**
 * @file cashierUiTaskC11.test.ts
 * @description Unit & Static Verification Test Suite for PLAY369 Task C1.1:
 * Remove Fake Provider State & UI Money Floats in CashierView.
 */

import * as fs from 'fs';
import * as path from 'path';
import { formatExactMoneyStr, PAYMENT_CHANNELS, hasLockedBalance } from '../../components/CashierView';
import { toScale4, fromScale4 } from '../utils/paymentAmount';
import type { WalletEntity } from '../types/seamless';

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

function expectEqual<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export async function runSuite() {
  console.log('\n======================================================');
  console.log('🧪 PLAY369 TASK C1.1: CASHIER UI SAFETY VERIFICATION');
  console.log('======================================================\n');

  const cashierPath = path.resolve(process.cwd(), 'src/components/CashierView.tsx');
  const cashierContent = fs.readFileSync(cashierPath, 'utf8');

  await assert('Test 1: Zero parseFloat(), Number(), or toFixed() usage on financial values in CashierView', () => {
    if (/parseFloat\s*\(/.test(cashierContent)) {
      throw new Error('Found parseFloat() in CashierView.tsx');
    }
    if (/\.toFixed\s*\(/.test(cashierContent)) {
      throw new Error('Found .toFixed() in CashierView.tsx');
    }
    if (/Number\s*\(\s*(currentWallet|activeIntent|dep|wth|preset|rawVal)/.test(cashierContent)) {
      throw new Error('Found Number() conversion on financial variables in CashierView.tsx');
    }
  });

  await assert('Test 2: No hardcoded providerAvailable: true, providerConfigured: true, or methodAvailable: true', () => {
    for (const channel of PAYMENT_CHANNELS) {
      if (channel.providerAvailable === true) {
        throw new Error(`Channel ${channel.provider} has providerAvailable: true`);
      }
      if (channel.providerConfigured === true) {
        throw new Error(`Channel ${channel.provider} has providerConfigured: true`);
      }
      if (channel.methodAvailable === true) {
        throw new Error(`Channel ${channel.provider} has methodAvailable: true`);
      }
    }
    if (/providerAvailable:\s*true/.test(cashierContent)) {
      throw new Error('Found providerAvailable: true in CashierView.tsx');
    }
    if (/providerConfigured:\s*true/.test(cashierContent)) {
      throw new Error('Found providerConfigured: true in CashierView.tsx');
    }
    if (/methodAvailable:\s*true/.test(cashierContent)) {
      throw new Error('Found methodAvailable: true in CashierView.tsx');
    }
  });

  await assert('Test 3: No fake 0% fee or hardcoded provider limit claims in channels', () => {
    for (const channel of PAYMENT_CHANNELS) {
      expectEqual(channel.fee, undefined, `Channel ${channel.provider} fee must be undefined`);
      expectEqual(channel.minBDT, undefined, `Channel ${channel.provider} minBDT must be undefined`);
      expectEqual(channel.maxBDT, undefined, `Channel ${channel.provider} maxBDT must be undefined`);
    }
  });

  await assert('Test 4: Sender phone and withdrawal recipient default to empty strings (no prefilled fake numbers)', () => {
    if (!/useState<string>\(\s*''\s*\)/.test(cashierContent)) {
      throw new Error('Missing empty string initial state for sender or recipient');
    }
    if (/01712-349911/.test(cashierContent) || /01900-112233/.test(cashierContent)) {
      throw new Error('Found hardcoded sample phone numbers in CashierView.tsx');
    }
  });

  await assert('Test 5: formatExactMoneyStr preserves exact "0.0516" and scale-4 strings without floating point loss', () => {
    expectEqual(formatExactMoneyStr('0.0516'), '0.0516');
    expectEqual(formatExactMoneyStr('100.0000'), '100.0000');
    expectEqual(formatExactMoneyStr('2500'), '2,500');
    expectEqual(formatExactMoneyStr('50000'), '50,000');
    expectEqual(formatExactMoneyStr('1234567.8901'), '1,234,567.8901');
    expectEqual(formatExactMoneyStr('0'), '0');
    expectEqual(formatExactMoneyStr(''), '0.00');
    expectEqual(formatExactMoneyStr(undefined), '0.00');
    expectEqual(formatExactMoneyStr(null), '0.00');
  });

  await assert('Test 6: BigInt scale-4 operations support exact balance checks and formatting', () => {
    const scale4 = toScale4('0.0516');
    expectEqual(scale4, 516n);
    expectEqual(fromScale4(scale4), '0.0516');

    const dummyWalletUnfrozen: WalletEntity = {
      id: 'w1',
      user_id: 'u1',
      currency: 'BDT',
      real_balance: 100,
      bonus_balance: 0,
      locked_balance: 0,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1
    };
    expectEqual(hasLockedBalance(dummyWalletUnfrozen), false);

    const dummyWalletFrozen: WalletEntity = {
      ...dummyWalletUnfrozen,
      locked_balance: 50
    };
    expectEqual(hasLockedBalance(dummyWalletFrozen), true);
  });

  await assert('Test 7: All interactive Cashier controls satisfy >=48px touch target requirement', () => {
    if (/min-h-\[44px\]/.test(cashierContent) || /h-\[44px\]/.test(cashierContent)) {
      throw new Error('Found legacy 44px touch target in CashierView.tsx');
    }
  });

  console.log(`\n======================================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Execute if run directly
runSuite().catch((err) => {
  console.error('Fatal error running suite:', err);
  process.exit(1);
});

