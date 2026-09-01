/**
 * @file validation.ts
 * @description Input validation rules for the Server-Side Provider Gateway.
 * 
 * [ARCHITECTURAL CONTRACT]:
 * - Validates provider IDs, game IDs, user IDs, and payload structures.
 * - Rejects malformed or suspicious payloads immediately with structured `VALIDATION_ERROR`.
 */

import { GatewayError, GatewayLaunchRequest, GatewaySessionRequest } from './types';

const IDENTIFIER_REGEX = /^[a-zA-Z0-9_\-\.]{1,64}$/;
const USER_ID_REGEX = /^[a-zA-Z0-9_\-\.@]{1,64}$/;

/**
 * Validates a provider identifier
 */
export function validateProviderId(providerId: any, paramName: string = 'providerId'): string {
  if (!providerId || typeof providerId !== 'string') {
    throw new GatewayError(
      'VALIDATION_ERROR',
      `Parameter '${paramName}' is required and must be a non-empty string`,
      400,
      typeof providerId === 'string' ? providerId : null,
      { paramName }
    );
  }

  const trimmed = providerId.trim();
  if (!IDENTIFIER_REGEX.test(trimmed)) {
    throw new GatewayError(
      'VALIDATION_ERROR',
      `Parameter '${paramName}' contains invalid characters or exceeds 64 characters`,
      400,
      trimmed,
      { paramName, value: trimmed }
    );
  }

  return trimmed;
}

/**
 * Validates a game identifier
 */
export function validateGameId(gameId: any, paramName: string = 'gameId'): string {
  if (!gameId || typeof gameId !== 'string') {
    throw new GatewayError(
      'VALIDATION_ERROR',
      `Parameter '${paramName}' is required and must be a non-empty string`,
      400,
      null,
      { paramName }
    );
  }

  const trimmed = gameId.trim();
  if (!IDENTIFIER_REGEX.test(trimmed)) {
    throw new GatewayError(
      'VALIDATION_ERROR',
      `Parameter '${paramName}' contains invalid characters or exceeds 64 characters`,
      400,
      null,
      { paramName, value: trimmed }
    );
  }

  return trimmed;
}

/**
 * Validates a launch request
 */
export function validateLaunchPayload(body: any): GatewayLaunchRequest {
  if (!body || typeof body !== 'object') {
    throw new GatewayError('VALIDATION_ERROR', 'Request body must be a valid JSON object', 400);
  }

  const gameId = validateGameId(body.gameId);

  if (!body.userId || typeof body.userId !== 'string' || !USER_ID_REGEX.test(body.userId.trim())) {
    throw new GatewayError('VALIDATION_ERROR', 'Valid userId is required for game launch', 400, null, {
      paramName: 'userId'
    });
  }

  if (!body.username || typeof body.username !== 'string' || body.username.trim().length === 0) {
    throw new GatewayError('VALIDATION_ERROR', 'Valid username is required for game launch', 400, null, {
      paramName: 'username'
    });
  }

  let currency: 'BDT' | 'USD' = 'BDT';
  if (body.currency) {
    const normCurr = String(body.currency).toUpperCase().trim();
    if (normCurr !== 'BDT' && normCurr !== 'USD') {
      throw new GatewayError('VALIDATION_ERROR', `Unsupported currency '${body.currency}'. Allowed: BDT, USD`, 400, null, {
        paramName: 'currency',
        value: body.currency
      });
    }
    currency = normCurr as 'BDT' | 'USD';
  }

  return {
    gameId,
    userId: body.userId.trim(),
    username: body.username.trim(),
    currency,
    language: body.language === 'bn' ? 'bn' : 'en',
    ipAddress: typeof body.ipAddress === 'string' ? body.ipAddress.substring(0, 45) : undefined,
    userAgent: typeof body.userAgent === 'string' ? body.userAgent.substring(0, 255) : undefined,
    returnUrl: typeof body.returnUrl === 'string' ? body.returnUrl.substring(0, 500) : undefined
  };
}

/**
 * Validates a session request
 */
export function validateSessionPayload(body: any): GatewaySessionRequest {
  if (!body || typeof body !== 'object') {
    throw new GatewayError('VALIDATION_ERROR', 'Request body must be a valid JSON object', 400);
  }

  const gameId = validateGameId(body.gameId);

  if (!body.userId || typeof body.userId !== 'string' || !USER_ID_REGEX.test(body.userId.trim())) {
    throw new GatewayError('VALIDATION_ERROR', 'Valid userId is required for game session', 400, null, {
      paramName: 'userId'
    });
  }

  if (!body.username || typeof body.username !== 'string' || body.username.trim().length === 0) {
    throw new GatewayError('VALIDATION_ERROR', 'Valid username is required for game session', 400, null, {
      paramName: 'username'
    });
  }

  let currency: 'BDT' | 'USD' = 'BDT';
  if (body.currency) {
    const normCurr = String(body.currency).toUpperCase().trim();
    if (normCurr !== 'BDT' && normCurr !== 'USD') {
      throw new GatewayError('VALIDATION_ERROR', `Unsupported currency '${body.currency}'. Allowed: BDT, USD`, 400, null, {
        paramName: 'currency',
        value: body.currency
      });
    }
    currency = normCurr as 'BDT' | 'USD';
  }

  return {
    gameId,
    userId: body.userId.trim(),
    username: body.username.trim(),
    currency,
    ipAddress: typeof body.ipAddress === 'string' ? body.ipAddress.substring(0, 45) : undefined,
    language: body.language === 'bn' ? 'bn' : 'en'
  };
}
