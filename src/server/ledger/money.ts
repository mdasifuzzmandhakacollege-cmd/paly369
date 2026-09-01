/**
 * @file money.ts
 * @description Safe monetary arithmetic utilities using pure integer minor units.
 * 
 * [SECURITY RULE]:
 * - Never perform financial math using JavaScript floats (0.1 + 0.2 != 0.3).
 * - All amounts are converted to and processed as `bigint` minor units (e.g., poisha / cents).
 * - 1 BDT/USD = 100 minor units (or scaled according to currency decimals).
 */

import { LedgerValidationError, SupportedCurrency, SUPPORTED_CURRENCIES } from './types';

export const LEDGER_DECIMALS = 4;

const CURRENCY_DECIMALS: Record<SupportedCurrency, number> = {
  BDT: 4,
  USD: 4,
  EUR: 4,
  INR: 4
};

/**
 * Validates that currency is an approved ISO currency code
 */
export function validateCurrency(currency: any): SupportedCurrency {
  if (!currency || typeof currency !== 'string') {
    throw new LedgerValidationError("Currency is required and must be a string", { currency });
  }

  const normalized = currency.toUpperCase().trim() as SupportedCurrency;
  if (!SUPPORTED_CURRENCIES.has(normalized)) {
    throw new LedgerValidationError(`Unsupported currency '${currency}'. Supported: ${Array.from(SUPPORTED_CURRENCIES).join(', ')}`, {
      currency,
      supported: Array.from(SUPPORTED_CURRENCIES)
    });
  }

  return normalized;
}

/**
 * Parses and validates an amount input into an exact non-negative bigint minor units.
 * Supports: bigint, positive integer number, or integer/decimal string.
 */
export function parseToMinorUnits(
  amount: bigint | number | string,
  currency: SupportedCurrency,
  allowZero: boolean = false
): bigint {
  if (amount === undefined || amount === null) {
    throw new LedgerValidationError("Transaction amount is required", { amount });
  }

  let minorBigInt: bigint;

  if (typeof amount === 'bigint') {
    minorBigInt = amount;
  } else if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) {
      throw new LedgerValidationError("Transaction amount must be a finite number", { amount });
    }
    if (amount < 0) {
      throw new LedgerValidationError("Transaction amount cannot be negative", { amount });
    }
    // Convert to string to avoid float precision issues during multiplication
    const decimals = CURRENCY_DECIMALS[currency] || LEDGER_DECIMALS;
    const str = amount.toFixed(decimals);
    const [intPart, fracPart = ''] = str.split('.');
    const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
    minorBigInt = BigInt(intPart + paddedFrac);
  } else if (typeof amount === 'string') {
    const trimmed = amount.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      throw new LedgerValidationError("Invalid numeric amount format", { amount });
    }
    const decimals = CURRENCY_DECIMALS[currency] || LEDGER_DECIMALS;
    const [intPart, fracPart = ''] = trimmed.split('.');
    const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
    minorBigInt = BigInt(intPart + paddedFrac);
  } else {
    throw new LedgerValidationError("Amount must be a bigint, number, or string", { amount });
  }

  if (minorBigInt < 0n) {
    throw new LedgerValidationError("Amount in minor units cannot be negative", { minorUnits: minorBigInt.toString() });
  }

  if (!allowZero && minorBigInt === 0n) {
    throw new LedgerValidationError("Transaction amount must be strictly greater than zero", { minorUnits: "0" });
  }

  return minorBigInt;
}

/**
 * Formats a bigint minor units value to standard decimal string (e.g. 516n -> "0.0516")
 */
export function formatMinorUnits(minorUnits: bigint, currency: SupportedCurrency = 'BDT'): string {
  const decimals = CURRENCY_DECIMALS[currency] || LEDGER_DECIMALS;
  const isNegative = minorUnits < 0n;
  const absUnits = isNegative ? -minorUnits : minorUnits;
  const str = absUnits.toString().padStart(decimals + 1, '0');
  const splitPoint = str.length - decimals;
  const intPart = str.slice(0, splitPoint) || '0';
  const fracPart = str.slice(splitPoint);
  const formatted = `${intPart}.${fracPart}`;
  return isNegative ? `-${formatted}` : formatted;
}
