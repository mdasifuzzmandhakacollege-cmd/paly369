/**
 * @file gameService.ts
 * @description Central Game Service for PLAY369.
 * 
 * [ARCHITECTURAL CONTRACT]:
 * - Acts as the single point of contact between UI components (Game Lobby, Search, Cards)
 *   and the underlying GameProviderAdapter subsystem.
 * - Routes requests through the Provider Registry.
 * - Completely abstracts provider-specific data structures and communications.
 */

import { gameProviderRegistry, GameProviderRegistry } from './providers/providerRegistry';
import { providerHealthService, ProviderHealthService, SystemHealthOverview } from './providers/healthService';
import {
  GameItem,
  GameListFilter,
  CreateGameSessionRequest,
  GameSessionResult,
  LaunchGameRequest,
  GameLaunchResult,
  ProviderHealthResult
} from './providers/types';
import {
  MOCK_CATEGORIES,
  MOCK_PROVIDERS,
  MOCK_FEATURED_SLIDES,
  MockCategory,
  MockProvider,
  MockFeaturedHeroSlide
} from '../data/mockGamesData';

export class GameService {
  private registry: GameProviderRegistry;
  private healthService: ProviderHealthService;

  constructor(
    registry: GameProviderRegistry = gameProviderRegistry,
    healthService: ProviderHealthService = providerHealthService
  ) {
    this.registry = registry;
    this.healthService = healthService;
  }

  /**
   * Get the underlying registry instance
   */
  public getRegistry(): GameProviderRegistry {
    return this.registry;
  }

  /**
   * Get the underlying health service instance
   */
  public getHealthService(): ProviderHealthService {
    return this.healthService;
  }

  /**
   * Fetch game catalog matching the requested filters.
   * Aggregates across all registered adapters or targets a specific adapter.
   */
  public async listGames(filter?: GameListFilter): Promise<GameItem[]> {
    try {
      // If a specific provider is requested and registered, query that adapter directly
      if (filter?.providerId && filter.providerId !== 'all') {
        const targetAdapter = this.registry.getProvider(filter.providerId);
        if (targetAdapter) {
          return await targetAdapter.listGames(filter);
        }
      }

      // Default: query the primary registered aggregator / default provider
      const defaultAdapter = this.registry.getDefaultProvider();
      return await defaultAdapter.listGames(filter);
    } catch (err) {
      console.error('[GameService] listGames error:', err);
      return [];
    }
  }

  /**
   * Retrieve game details by unique game ID
   */
  public async getGame(gameId: string): Promise<GameItem | null> {
    try {
      if (!gameId) return null;

      // First check all registered providers
      const allAdapters = this.registry.getAllProviders();
      for (const adapter of allAdapters) {
        const game = await adapter.getGame(gameId);
        if (game) return game;
      }

      // Fallback to default provider
      return await this.registry.getDefaultProvider().getGame(gameId);
    } catch (err) {
      console.error(`[GameService] getGame error for ${gameId}:`, err);
      return null;
    }
  }

  /**
   * Create an authorized game session for an authenticated user
   */
  public async createGameSession(request: CreateGameSessionRequest): Promise<GameSessionResult> {
    const game = await this.getGame(request.gameId);
    const targetProviderId = game?.providerId || 'mock_aggregator';
    const adapter = this.registry.getProvider(targetProviderId) || this.registry.getDefaultProvider();

    return await adapter.createGameSession(request);
  }

  /**
   * Launch game flow for player
   */
  public async launchGame(request: LaunchGameRequest): Promise<GameLaunchResult> {
    try {
      const game = await this.getGame(request.gameId);
      const targetProviderId = game?.providerId || 'mock_aggregator';
      const adapter = this.registry.getProvider(targetProviderId) || this.registry.getDefaultProvider();

      return await adapter.launchGame(request);
    } catch (err: any) {
      return {
        success: false,
        gameId: request.gameId,
        providerId: 'unknown',
        launchMode: 'component',
        error: err?.message || 'Failed to launch game'
      };
    }
  }

  /**
   * Retrieve available game categories
   */
  public async getCategories(): Promise<MockCategory[]> {
    return Promise.resolve(MOCK_CATEGORIES);
  }

  /**
   * Retrieve available certified game providers
   */
  public async getProviders(): Promise<MockProvider[]> {
    return Promise.resolve(MOCK_PROVIDERS);
  }

  /**
   * Retrieve featured hero slides for carousel
   */
  public async getFeaturedSlides(): Promise<MockFeaturedHeroSlide[]> {
    return Promise.resolve(MOCK_FEATURED_SLIDES);
  }

  /**
   * Check health across all registered game provider adapters
   */
  public async checkProvidersHealth(timeoutMs?: number): Promise<Record<string, ProviderHealthResult>> {
    return await this.healthService.getHealthMap(timeoutMs);
  }

  /**
   * Check health of a single provider by ID
   */
  public async checkProviderHealth(providerId: string, timeoutMs?: number): Promise<ProviderHealthResult> {
    return await this.healthService.checkProvider(providerId, timeoutMs);
  }

  /**
   * Retrieve aggregate overview of provider ecosystem health
   */
  public async getSystemHealthOverview(timeoutMs?: number): Promise<SystemHealthOverview> {
    return await this.healthService.getSystemHealthOverview(timeoutMs);
  }
}

// Global Singleton Instance
export const gameService = new GameService();
