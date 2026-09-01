/**
 * @file validation.ts
 * @description Strict runtime input validators for the PLAY369 Provider Adapter Layer.
 */

import { CreateGameSessionRequest, LaunchGameRequest, GameListFilter } from './types';
import { ProviderError } from './errors';

/**
 * Validates session creation parameters before passing to adapters
 */
export function validateCreateGameSessionRequest(
  request: CreateGameSessionRequest,
  providerId: string = 'validation'
): void {
  if (!request) {
    throw new ProviderError('CreateGameSessionRequest payload cannot be empty', providerId, 400);
  }

  if (!request.userId || typeof request.userId !== 'string' || request.userId.trim().length === 0) {
    throw new ProviderError('Valid userId is required to create a game session', providerId, 400);
  }

  if (!request.gameId || typeof request.gameId !== 'string' || request.gameId.trim().length === 0) {
    throw new ProviderError('Valid gameId is required to create a game session', providerId, 400);
  }

  if (!request.currency || !['BDT', 'USD'].includes(request.currency)) {
    throw new ProviderError(`Unsupported currency '${request.currency}'. Must be BDT or USD`, providerId, 400);
  }

  if (request.mode && !['REAL', 'DEMO'].includes(request.mode)) {
    throw new ProviderError(`Invalid session mode '${request.mode}'. Must be REAL or DEMO`, providerId, 400);
  }
}

/**
 * Validates game launch requests
 */
export function validateLaunchGameRequest(
  request: LaunchGameRequest,
  providerId: string = 'validation'
): void {
  if (!request) {
    throw new ProviderError('LaunchGameRequest payload cannot be empty', providerId, 400);
  }

  if (!request.userId || typeof request.userId !== 'string' || request.userId.trim().length === 0) {
    throw new ProviderError('Valid userId is required to launch a game', providerId, 400);
  }

  if (!request.gameId || typeof request.gameId !== 'string' || request.gameId.trim().length === 0) {
    throw new ProviderError('Valid gameId is required to launch a game', providerId, 400);
  }
}

/**
 * Sanitizes and normalizes game list filters
 */
export function sanitizeGameListFilter(filter?: GameListFilter): GameListFilter {
  if (!filter) return {};

  return {
    category: filter.category ? filter.category.trim().toLowerCase() : undefined,
    providerId: filter.providerId ? filter.providerId.trim().toLowerCase() : undefined,
    searchQuery: filter.searchQuery ? filter.searchQuery.trim().toLowerCase() : undefined,
    isHot: typeof filter.isHot === 'boolean' ? filter.isHot : undefined,
    isFeatured: typeof filter.isFeatured === 'boolean' ? filter.isFeatured : undefined,
    limit: typeof filter.limit === 'number' && filter.limit > 0 ? Math.min(filter.limit, 100) : undefined,
    offset: typeof filter.offset === 'number' && filter.offset >= 0 ? filter.offset : 0
  };
}
