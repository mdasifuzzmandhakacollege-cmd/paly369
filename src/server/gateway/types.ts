/**
 * @file types.ts
 * @description Types, interfaces, and error schemas for the Server-Side Provider Gateway.
 * 
 * [ARCHITECTURAL CONTRACT]:
 * - Defines standardized error codes and gateway response contracts.
 * - Guarantees all client-server communication follows a uniform envelope with correlation IDs.
 * - Prevents sensitive token/credential leakage across the wire.
 */

export type GatewayErrorCode =
  | 'VALIDATION_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR';

export interface GatewayErrorPayload {
  code: GatewayErrorCode;
  message: string;
  provider?: string | null;
  details?: Record<string, any>;
}

export interface GatewayResponse<T = any> {
  success: boolean;
  data?: T;
  error?: GatewayErrorPayload;
  correlationId: string;
  timestamp: string;
}

export class GatewayError extends Error {
  public readonly code: GatewayErrorCode;
  public readonly statusCode: number;
  public readonly provider?: string | null;
  public readonly details?: Record<string, any>;

  constructor(
    code: GatewayErrorCode,
    message: string,
    statusCode: number = 500,
    provider?: string | null,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.statusCode = statusCode;
    this.provider = provider || null;
    this.details = details;
  }
}

export interface GatewayLaunchRequest {
  userId: string;
  username: string;
  gameId: string;
  currency?: 'BDT' | 'USD';
  language?: 'bn' | 'en';
  ipAddress?: string;
  userAgent?: string;
  returnUrl?: string;
}

export interface GatewaySessionRequest {
  userId: string;
  username: string;
  gameId: string;
  currency: 'BDT' | 'USD';
  ipAddress?: string;
  language?: 'bn' | 'en';
}

export interface GatewayListGamesRequest {
  category?: string;
  providerId?: string;
  search?: string;
  tags?: string[];
  isHot?: boolean;
  limit?: number;
  offset?: number;
}
