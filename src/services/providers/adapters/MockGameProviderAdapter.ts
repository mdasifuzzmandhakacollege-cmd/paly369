/**
 * @file MockGameProviderAdapter.ts
 * @description Concrete mock implementation of GameProviderAdapter for PLAY369.
 * 
 * [ARCHITECTURAL CONTRACT]:
 * - Adheres strictly to the GameProviderAdapter interface.
 * - Reads from the isolated mock data store (`/src/data/mockGamesData.ts`).
 * - Validates inputs and returns standardized GameItem, GameSessionResult, and GameLaunchResult payloads.
 * - Simulates realistic provider response latency and session generation.
 */

import {
  GameProviderAdapter,
  GameItem,
  GameListFilter,
  CreateGameSessionRequest,
  GameSessionResult,
  LaunchGameRequest,
  GameLaunchResult,
  ProviderHealthResult
} from '../types';
import { MOCK_GAMES_CATALOG, MockGameItem } from '../../../data/mockGamesData';
import { validateCreateGameSessionRequest, validateLaunchGameRequest, sanitizeGameListFilter } from '../validation';
import { GameNotFoundError, withTimeout } from '../errors';

export class MockGameProviderAdapter implements GameProviderAdapter {
  public readonly providerId: string = 'mock_aggregator';
  public readonly providerName: string = 'PLAY369 Unified Mock Aggregator';
  public readonly providerCode: string = 'PLAY369_MOCK';

  private gamesCatalog: GameItem[];

  constructor(customCatalog?: MockGameItem[]) {
    // Map mock data into standardized GameItem entities
    this.gamesCatalog = (customCatalog || MOCK_GAMES_CATALOG).map((item) => ({
      id: item.id,
      name: item.name,
      nameBn: item.nameBn,
      provider: item.provider,
      providerId: item.providerId,
      category: item.category,
      rtp: item.rtp,
      volatility: item.volatility,
      maxMultiplier: item.maxMultiplier,
      minBet: item.minBet,
      maxBet: item.maxBet,
      imageUrl: item.imageUrl,
      isFeatured: item.isFeatured,
      isHot: item.isHot,
      isNew: item.isNew,
      badge: item.badge,
      activePlayersCount: item.activePlayersCount,
      tags: item.tags,
      demoSupported: true
    }));
  }

  /**
   * List games matching optional criteria
   */
  public async listGames(filter?: GameListFilter): Promise<GameItem[]> {
    return withTimeout(
      (async () => {
        const cleanFilter = sanitizeGameListFilter(filter);
        let results = [...this.gamesCatalog];

        // 1. Filter by category
        if (cleanFilter.category && cleanFilter.category !== 'all') {
          if (cleanFilter.category === 'hot') {
            results = results.filter((g) => g.isHot || g.isFeatured);
          } else {
            results = results.filter((g) => g.category === cleanFilter.category);
          }
        }

        // 2. Filter by provider
        if (
          cleanFilter.providerId &&
          cleanFilter.providerId !== 'all' &&
          cleanFilter.providerId.toLowerCase() !== this.providerId.toLowerCase()
        ) {
          results = results.filter(
            (g) =>
              g.providerId.toLowerCase() === cleanFilter.providerId?.toLowerCase() ||
              g.provider.toLowerCase() === cleanFilter.providerId?.toLowerCase()
          );
        }

        // 3. Filter by search query
        if (cleanFilter.searchQuery) {
          const q = cleanFilter.searchQuery;
          results = results.filter(
            (g) =>
              g.name.toLowerCase().includes(q) ||
              (g.nameBn && g.nameBn.toLowerCase().includes(q)) ||
              g.provider.toLowerCase().includes(q) ||
              g.tags?.some((t) => t.toLowerCase().includes(q))
          );
        }

        // 4. Filter by flags
        if (cleanFilter.isHot !== undefined) {
          results = results.filter((g) => !!g.isHot === cleanFilter.isHot);
        }
        if (cleanFilter.isFeatured !== undefined) {
          results = results.filter((g) => !!g.isFeatured === cleanFilter.isFeatured);
        }

        // 5. Pagination offset & limit
        if (cleanFilter.offset && cleanFilter.offset > 0) {
          results = results.slice(cleanFilter.offset);
        }
        if (cleanFilter.limit && cleanFilter.limit > 0) {
          results = results.slice(0, cleanFilter.limit);
        }

        return results;
      })(),
      3000,
      this.providerId
    );
  }

  /**
   * Get single game by ID
   */
  public async getGame(gameId: string): Promise<GameItem | null> {
    return withTimeout(
      (async () => {
        if (!gameId || typeof gameId !== 'string') return null;
        const normalizedId = gameId.trim().toLowerCase();
        const found = this.gamesCatalog.find((g) => g.id.toLowerCase() === normalizedId);
        return found || null;
      })(),
      3000,
      this.providerId
    );
  }

  /**
   * Create secure game session for an authenticated player
   */
  public async createGameSession(request: CreateGameSessionRequest): Promise<GameSessionResult> {
    validateCreateGameSessionRequest(request, this.providerId);

    return withTimeout(
      (async () => {
        const game = await this.getGame(request.gameId);
        if (!game) {
          throw new GameNotFoundError(request.gameId, this.providerId);
        }

        const now = new Date();
        const sessionId = `SES_${this.providerCode}_${request.userId.slice(-6)}_${Date.now()}`;
        const token = `JWT_MOCK_${Math.random().toString(36).substring(2)}_${Date.now()}`;

        // Determine launch URL & mode
        // For mini-games (e.g. Spribe Aviator, PG Mahjong, JILI Super Ace), component mode is supported
        const isInternalMiniGame = [
          'spribe_aviator',
          'spribe_mines',
          'jili_super_ace',
          'pg_mahjong_ways_2',
          'pgsoft_mahjong_ways2',
          'evo_crazy_time',
          'evo_lightning_roulette',
          'vs20olympgate'
        ].includes(game.id);

        const launchMode = isInternalMiniGame ? 'component' : 'iframe';
        const launchUrl = `/launch?gameId=${encodeURIComponent(game.id)}&sessionId=${sessionId}&token=${token}&currency=${request.currency}`;

        return {
          sessionId,
          gameId: game.id,
          providerId: game.providerId || this.providerId,
          token,
          expiresInSeconds: 7200,
          gameLaunchUrl: launchUrl,
          launchMode,
          createdAt: now.toISOString()
        };
      })(),
      4000,
      this.providerId
    );
  }

  /**
   * Launch game wrapper
   */
  public async launchGame(request: LaunchGameRequest): Promise<GameLaunchResult> {
    validateLaunchGameRequest(request, this.providerId);

    try {
      const session = await this.createGameSession({
        userId: request.userId,
        username: request.username || `User_${request.userId.slice(-4)}`,
        gameId: request.gameId,
        currency: request.currency || 'BDT',
        mode: request.mode || 'REAL',
        language: request.language || 'bn',
        clientPlatform: request.clientPlatform || 'web',
        returnUrl: request.returnUrl || '/'
      });

      return {
        success: true,
        gameId: request.gameId,
        providerId: session.providerId,
        launchUrl: session.gameLaunchUrl,
        launchMode: session.launchMode,
        session
      };
    } catch (err: any) {
      return {
        success: false,
        gameId: request.gameId,
        providerId: this.providerId,
        launchMode: 'component',
        error: err?.message || 'Failed to launch game'
      };
    }
  }

  /**
   * Health status ping and integrity check for Mock Provider
   * Categorizes status into HEALTHY, DEGRADED, or UNAVAILABLE
   */
  public async healthCheck(): Promise<ProviderHealthResult> {
    const startTime = performance.now();
    const checkedAt = new Date().toISOString();

    try {
      return await withTimeout(
        (async () => {
          // Perform quick catalog validation and simulate realistic in-memory lookup latency
          const isCatalogLoaded = Array.isArray(this.gamesCatalog) && this.gamesCatalog.length > 0;
          
          if (!isCatalogLoaded) {
            const elapsed = Math.round(performance.now() - startTime);
            return {
              provider: this.providerId,
              providerId: this.providerId,
              providerName: this.providerName,
              status: 'UNAVAILABLE',
              latency: elapsed,
              latencyMs: elapsed,
              checkedAt,
              error: 'Game catalog is empty or corrupted',
              activeGamesCount: 0,
              details: { engine: 'MockGameProviderAdapter', statusReason: 'CatalogEmpty' }
            };
          }

          // Sample check of first item
          const sampleGame = this.gamesCatalog[0];
          const hasValidSchema = sampleGame && Boolean(sampleGame.id && sampleGame.name && sampleGame.provider);

          if (!hasValidSchema) {
            const elapsed = Math.round(performance.now() - startTime);
            return {
              provider: this.providerId,
              providerId: this.providerId,
              providerName: this.providerName,
              status: 'DEGRADED',
              latency: elapsed,
              latencyMs: elapsed,
              checkedAt,
              error: 'Catalog schema warning: sample item missing required fields',
              activeGamesCount: this.gamesCatalog.length,
              details: { engine: 'MockGameProviderAdapter', sampleId: sampleGame?.id }
            };
          }

          const elapsed = Math.max(1, Math.round(performance.now() - startTime));
          const status = elapsed > 500 ? 'DEGRADED' : 'HEALTHY';

          return {
            provider: this.providerId,
            providerId: this.providerId,
            providerName: this.providerName,
            status,
            latency: elapsed,
            latencyMs: elapsed,
            checkedAt,
            error: null,
            activeGamesCount: this.gamesCatalog.length,
            details: {
              engine: 'MockGameProviderAdapter',
              version: '1.0.0',
              providerCode: this.providerCode,
              features: ['instant_session', 'component_launcher', 'offline_resilience']
            }
          };
        })(),
        3000,
        this.providerId
      );
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      return {
        provider: this.providerId,
        providerId: this.providerId,
        providerName: this.providerName,
        status: 'UNAVAILABLE',
        latency: elapsed,
        latencyMs: elapsed,
        checkedAt,
        error: err?.message || 'Provider health check failed or timed out',
        activeGamesCount: 0,
        details: { errorName: err?.name }
      };
    }
  }

  /**
   * Alias for backwards compatibility
   */
  public async getProviderHealth(): Promise<ProviderHealthResult> {
    return this.healthCheck();
  }
}
