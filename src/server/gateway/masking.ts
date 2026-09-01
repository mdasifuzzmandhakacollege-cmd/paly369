/**
 * @file masking.ts
 * @description Safe logging and sensitive data masking utility for Server Provider Gateway.
 * 
 * [SECURITY RULE]:
 * - Never log API keys, tokens, session secrets, passwords, or raw payment details.
 * - Deeply inspects and sanitizes objects before outputting to stdout/stderr.
 */

const SENSITIVE_KEY_PATTERNS = [
  /api[-_]?key/i,
  /secret/i,
  /password/i,
  /passphrase/i,
  /token/i,
  /session[-_]?token/i,
  /auth(orization)?/i,
  /bearer/i,
  /signature/i,
  /hmac/i,
  /private[-_]?key/i,
  /credit[-_]?card/i,
  /cvv/i,
  /pin/i,
  /idempotency[-_]?key/i,
  /idemp/i
];

/**
 * Masks raw idempotency key for safe logging (PLAY369 Task 6.1.6.2)
 */
export function maskIdempotencyKey(key?: string): string {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.substring(0, 2)}***${trimmed.substring(trimmed.length - 2)}`;
  }
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
}

/**
 * Recursively masks sensitive fields in objects, arrays, and primitive strings
 */
export function maskSensitiveData<T = any>(data: T, depth: number = 0): T {
  if (depth > 6) return '[Max Depth Reached]' as any;
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Check if string resembles a bearer token or secret string
    if (data.startsWith('Bearer ') && data.length > 15) {
      return `Bearer ${data.substring(7, 11)}...***` as any;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, depth + 1)) as any;
  }

  if (typeof data === 'object') {
    const maskedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey && value !== null && value !== undefined) {
        if (typeof value === 'string' && value.length > 8) {
          maskedObj[key] = `${value.substring(0, 3)}***${value.substring(value.length - 3)}`;
        } else {
          maskedObj[key] = '***REDACTED***';
        }
      } else {
        maskedObj[key] = maskSensitiveData(value, depth + 1);
      }
    }
    return maskedObj as any;
  }

  return data;
}

/**
 * Structured safe logger with correlation tracking and automated masking
 */
export function safeLog(
  level: 'info' | 'warn' | 'error',
  correlationId: string,
  message: string,
  meta?: any
): void {
  const timestamp = new Date().toISOString();
  const sanitizedMeta = meta ? maskSensitiveData(meta) : undefined;
  const prefix = `[ProviderGateway] [${timestamp}] [CID:${correlationId}]`;

  if (level === 'error') {
    console.error(`${prefix} [ERROR] ${message}`, sanitizedMeta ? sanitizedMeta : '');
  } else if (level === 'warn') {
    console.warn(`${prefix} [WARN] ${message}`, sanitizedMeta ? sanitizedMeta : '');
  } else {
    console.log(`${prefix} [INFO] ${message}`, sanitizedMeta ? sanitizedMeta : '');
  }
}
