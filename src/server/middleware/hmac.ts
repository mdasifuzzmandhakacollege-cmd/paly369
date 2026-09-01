/**
 * @file hmac.ts
 * @description Production HMAC-SHA256 Signature Validation Middleware for iGaming Seamless Wallet.
 * 
 * Security Specifications:
 * 1. Signature Computation: HMAC-SHA256(timestamp + "." + rawBodyString, providerSecretKey)
 * 2. Replay Protection: Rejects requests where |serverTime - timestamp| > 300s (5 minutes)
 * 3. Timing-Safe Comparison: Uses crypto.timingSafeEqual to prevent side-channel timing attacks
 * 4. Header Preservation: Supports both standard and custom provider header formats
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { SeamlessErrorCode } from '../types/seamless';

// Dynamically resolve provider secret exclusively from environment variables
export function getProviderSecret(providerId: string): string | undefined {
  const norm = providerId.toLowerCase().trim();
  switch (norm) {
    case 'pragmatic_play':
    case 'pragmatic':
      return process.env.PROVIDER_PRAGMATIC_SECRET;
    case 'evolution':
      return process.env.PROVIDER_EVOLUTION_SECRET;
    case 'pgsoft':
      return process.env.PROVIDER_PGSOFT_SECRET;
    case 'spribe':
      return process.env.PROVIDER_SPRIBE_SECRET;
    case 'custom_provider':
      return process.env.PROVIDER_CUSTOM_SECRET;
    default:
      return process.env[`PROVIDER_${norm.toUpperCase()}_SECRET`];
  }
}

export const PROVIDER_SECRETS: Record<string, string | undefined> = new Proxy({}, {
  get: (_, prop: string) => getProviderSecret(prop)
});

// Configurable replay tolerance window in milliseconds (5 minutes default)
const REPLAY_TOLERANCE_MS = 5 * 60 * 1000;

export interface AuthenticatedRequest extends Request {
  rawBody?: string;
  providerId?: string;
  signatureTimestamp?: number;
}

/**
 * Utility function to compute HMAC-SHA256 signature for test clients or outgoing callbacks
 */
export function generateHmacSignature(
  payloadString: string,
  timestamp: number | string,
  secretKey: string
): string {
  const messageToSign = `${timestamp}.${payloadString}`;
  return crypto
    .createHmac('sha256', secretKey)
    .update(messageToSign, 'utf8')
    .digest('hex');
}

/**
 * Express Middleware for validating incoming B2B Game Provider requests
 */
export function validateHmacSignature(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const signature = (req.headers['x-signature'] ||
      req.headers['x-hub-signature-256'] ||
      req.headers['authorization']) as string | undefined;

    const timestampHeader = (req.headers['x-timestamp'] ||
      req.headers['x-request-timestamp']) as string | undefined;

    const providerId = (req.headers['x-provider-id'] ||
      req.body?.provider_id) as string | undefined;

    // 1. Validate presence of required authentication headers
    if (!signature) {
      res.status(401).json({
        code: SeamlessErrorCode.INVALID_SIGNATURE,
        message: 'Missing X-Signature security header in incoming request',
        timestamp: Date.now()
      });
      return;
    }

    if (!timestampHeader) {
      res.status(401).json({
        code: SeamlessErrorCode.TIMESTAMP_EXPIRED,
        message: 'Missing X-Timestamp security header',
        timestamp: Date.now()
      });
      return;
    }

    if (!providerId) {
      res.status(400).json({
        code: SeamlessErrorCode.INVALID_REQUEST,
        message: 'Missing provider identifier (X-Provider-Id header or provider_id in body)',
        timestamp: Date.now()
      });
      return;
    }

    // 2. Anti-replay check: Verify timestamp is within valid window
    const requestTimestamp = parseInt(timestampHeader, 10);
    if (isNaN(requestTimestamp)) {
      res.status(401).json({
        code: SeamlessErrorCode.TIMESTAMP_EXPIRED,
        message: 'Invalid X-Timestamp header format (must be epoch ms or seconds)',
        timestamp: Date.now()
      });
      return;
    }

    // Handle timestamps passed in seconds (10 digits) vs milliseconds (13 digits)
    const normalizedTimestamp =
      requestTimestamp < 10000000000 ? requestTimestamp * 1000 : requestTimestamp;

    const now = Date.now();
    const drift = Math.abs(now - normalizedTimestamp);

    if (drift > REPLAY_TOLERANCE_MS) {
      res.status(401).json({
        code: SeamlessErrorCode.TIMESTAMP_EXPIRED,
        message: `Request timestamp expired or clock drift exceeded. Drift: ${drift}ms (Max: ${REPLAY_TOLERANCE_MS}ms)`,
        timestamp: now
      });
      return;
    }

    // 3. Retrieve Provider's Shared Secret Key
    const secretKey = PROVIDER_SECRETS[providerId];
    if (!secretKey) {
      res.status(401).json({
        code: SeamlessErrorCode.INVALID_SIGNATURE,
        message: `Unknown or unconfigured game provider: ${providerId}`,
        timestamp: now
      });
      return;
    }

    // 4. Extract raw request payload string for digest calculation
    const rawPayload = req.rawBody || JSON.stringify(req.body || {});

    // 5. Calculate expected HMAC-SHA256 signature
    // Normalize signature header in case provider sent 'sha256=...' prefix
    const cleanReceivedSig = signature.replace(/^sha256=/i, '').trim().toLowerCase();
    const expectedSig = generateHmacSignature(rawPayload, timestampHeader, secretKey).toLowerCase();

    // 6. Perform Timing-Safe Comparison to prevent side-channel timing attacks
    const receivedBuffer = Buffer.from(cleanReceivedSig, 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      res.status(401).json({
        code: SeamlessErrorCode.INVALID_SIGNATURE,
        message: 'Cryptographic HMAC-SHA256 signature verification failed',
        timestamp: now
      });
      return;
    }

    // 7. Attach validated metadata to request for downstream controller handlers
    req.providerId = providerId;
    req.signatureTimestamp = normalizedTimestamp;

    next();
  } catch (error) {
    next(error);
  }
}
