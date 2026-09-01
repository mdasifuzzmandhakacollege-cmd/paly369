/**
 * @file paymentAmount.ts
 * @description Production Scale-4 Monetary Input Validator & Parser for PLAY369 Task 6.1.4.
 * 
 * Invariants & Guarantees:
 * 1. Zero Floating-Point Conversions: Pure BigInt minor units (1.0000 = 10000n) and exact decimal strings.
 * 2. Strict Input Validation:
 *    - Rejects NaN and Infinity
 *    - Rejects scientific notation (e.g. "1e3", "1E5")
 *    - Rejects negative and zero amounts
 *    - Rejects malformed decimal strings (e.g. "1.2.3", "abc", "1.", ".5")
 *    - Rejects over-precision fractional digits (> 4 decimal places, e.g. "1.23456") without rounding/truncation.
 * 3. Exact scale-4 representation carried across payment and ledger boundaries.
 */

export interface ParsedPaymentAmount {
  raw: string;
  minorUnits: bigint;
  decimalString: string;
}

/**
 * Converts a BigInt scale-4 minor units value to exact 4-decimal canonical string (e.g. 516n -> "0.0516", 1000000n -> "100.0000")
 */
export function fromScale4(val: bigint): string {
  const isNeg = val < 0n;
  const abs = isNeg ? -val : val;
  const str = abs.toString().padStart(5, '0');
  const intPart = str.slice(0, -4) || '0';
  const fracPart = str.slice(-4);
  return `${isNeg ? '-' : ''}${intPart}.${fracPart}`;
}

/**
 * Pure integer minor-units decimal parser (scale 4, 1.0000 = 10000n)
 * Accepts exact decimal string or bigint minor units.
 */
export function toScale4(val: string | bigint): bigint {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') {
    throw new Error('UNSAFE_NUMERIC_MONEY_INPUT: Unsafe JS number monetary input is rejected. Use exact decimal string or bigint minor units.');
  }
  if (typeof val !== 'string') {
    throw new Error('Monetary input must be an exact decimal string or bigint minor units.');
  }

  const s = val.trim();
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Invalid monetary decimal string format: "${val}"`);
  }

  const [intPart = '0', fracPart = ''] = s.split('.');
  if (fracPart.length > 4) {
    throw new Error(`Over-precision monetary input rejected: "${val}" has ${fracPart.length} decimal places (maximum 4 allowed).`);
  }
  const paddedFrac = fracPart.padEnd(4, '0');
  const isNeg = intPart.startsWith('-');
  const cleanInt = isNeg ? intPart.slice(1) : intPart;
  const combined = BigInt((cleanInt || '0') + paddedFrac);
  return isNeg ? -combined : combined;
}

/**
 * Authoritative Payment Amount Validator & Parser.
 * Validates decimal strings and converts them to exact scale-4 minor units.
 */
export function validatePaymentAmount(amount: unknown): ParsedPaymentAmount {
  if (amount === undefined || amount === null || amount === '') {
    throw new Error('Monetary amount is required and cannot be empty.');
  }

  if (typeof amount === 'number') {
    throw new Error('UNSAFE_NUMERIC_MONEY_INPUT: Unsafe JS number monetary input is rejected. Use exact decimal string or bigint minor units.');
  }

  let str: string;
  if (typeof amount === 'string') {
    str = amount.trim();
    if (!str) {
      throw new Error('Monetary amount is required and cannot be empty.');
    }
  } else if (typeof amount === 'bigint') {
    if (amount <= 0n) {
      throw new Error('Monetary amount must be strictly greater than zero.');
    }
    return {
      raw: amount.toString(),
      minorUnits: amount,
      decimalString: fromScale4(amount)
    };
  } else {
    throw new Error('Invalid monetary amount type. Expected decimal string or minor units.');
  }

  // Reject scientific notation
  if (/[eE]/.test(str)) {
    throw new Error(`Scientific notation is not allowed for monetary amounts: "${str}"`);
  }

  // Reject NaN / Infinity strings
  if (str === 'NaN' || str === 'Infinity' || str === '-Infinity') {
    throw new Error(`Invalid monetary amount format: "${str}"`);
  }

  // Reject negative numbers
  if (str.startsWith('-')) {
    throw new Error(`Monetary amount cannot be negative: "${str}"`);
  }

  // Strict regex format: positive integer or decimal with digits before and after the dot
  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid monetary decimal string format: "${str}"`);
  }

  const [intPart = '0', fracPart = ''] = str.split('.');
  if (fracPart.length > 4) {
    throw new Error(`Over-precision monetary input rejected: "${str}" has ${fracPart.length} decimal places (maximum 4 allowed).`);
  }

  const paddedFrac = fracPart.padEnd(4, '0');
  const cleanInt = intPart.replace(/^0+(?=\d)/, '');
  const minorUnits = BigInt((cleanInt || '0') + paddedFrac);

  if (minorUnits <= 0n) {
    throw new Error('Monetary amount must be strictly greater than zero.');
  }

  return {
    raw: str,
    minorUnits,
    decimalString: fromScale4(minorUnits)
  };
}
