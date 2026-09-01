/**
 * @file providerRegistry.ts
 * @description Central Registry for Game Provider Adapters in PLAY369.
 * 
 * [ARCHITECTURAL CONTRACT]:
 * - Allows plugging in new game providers (e.g. PG Soft Adapter, Pragmatic Adapter, Spribe Adapter)
 *   dynamically without modifying Game Lobby UI or Wallet logic.
 * - Manages adapter lifecycles and fallback resolution.
 */

import { GameProviderAdapter, ProviderHealthResult } from './types';
import { MockGameProviderAdapter } from './adapters/MockGameProviderAdapter';
import { withTimeout } from './errors';

export class GameProviderRegistry {
  private adapters: Map<string, GameProviderAdapter> = new Map();
  private defaultProviderId: string = 'mock_aggregator';

  constructor() {
    // Register the baseline Mock Game Provider Adapter by default
    const mockAdapter = new MockGameProviderAdapter();
    this.registerProvider(mockAdapter);
  }

  /**
   * Register a new game provider adapter
   */
  public registerProvider(adapter: GameProviderAdapter): void {
    if (!adapter || !adapter.providerId) {
      throw new Error('Cannot register provider with invalid or missing providerId');
    }
    this.adapters.set(adapter.providerId.toLowerCase(), adapter);
  }

  /**
   * Unregister an existing game provider adapter
   */
  public unregisterProvider(providerId: string): boolean {
    return this.adapters.delete(providerId.toLowerCase());
  }

  /**
   * Retrieve a registered provider adapter by ID
   */
  public getProvider(providerId: string): GameProviderAdapter | undefined {
    return this.adapters.get(providerId.toLowerCase());
  }

  /**
   * Get the primary or fallback default provider adapter
   */
  public getDefaultProvider(): GameProviderAdapter {
    const defaultAdapter = this.adapters.get(this.defaultProviderId);
    if (defaultAdapter) return defaultAdapter;

    // Fallback to first available adapter
    const firstAdapter = this.adapters.values().next().value;
    if (firstAdapter) return firstAdapter;

    // Ultimate fallback if map is empty
    const freshMock = new MockGameProviderAdapter();
    this.registerProvider(freshMock);
    return freshMock;
  }

  /**
   * Check if a provider ID is registered
   */
  public hasProvider(providerId: string): boolean {
    return this.adapters.has(providerId.toLowerCase());
  }

  /**
   * Retrieve all currently registered provider adapters
   */
  public getAllProviders(): GameProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * List all registered provider IDs
   */
  public getRegisteredProviderIds(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Set the default fallback provider ID
   */
  public setDefaultProviderId(providerId: string): void {
    this.defaultProviderId = providerId.toLowerCase();
  }

  /**
   * Check health status of a specific provider with timeout protection
   */
  public async checkProviderHealth(
    providerId: string,
    timeoutMs: number = 3000
  ): Promise<ProviderHealthResult> {
    const startTime = performance.now();
    const checkedAt = new Date().toISOString();
    const adapter = this.getProvider(providerId);

    if (!adapter) {
      const elapsed = Math.round(performance.now() - startTime);
      return {
        provider: providerId,
        providerId,
        providerName: `Unknown (${providerId})`,
        status: 'UNAVAILABLE',
        latency: elapsed,
        latencyMs: elapsed,
        checkedAt,
        error: `Provider '${providerId}' is not registered`,
        activeGamesCount: 0
      };
    }

    try {
      const healthPromise = adapter.healthCheck
        ? adapter.healthCheck()
        : adapter.getProviderHealth
        ? adapter.getProviderHealth()
        : Promise.resolve({
            provider: adapter.providerId,
            providerId: adapter.providerId,
            providerName: adapter.providerName,
            status: 'HEALTHY' as const,
            latency: 1,
            latencyMs: 1,
            checkedAt,
            error: null,
            activeGamesCount: 0
          });

      return await withTimeout(healthPromise, timeoutMs, adapter.providerId);
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      return {
        provider: adapter.providerId,
        providerId: adapter.providerId,
        providerName: adapter.providerName,
        status: 'UNAVAILABLE',
        latency: elapsed,
        latencyMs: elapsed,
        checkedAt,
        error: err?.message || 'Health check timed out or failed',
        activeGamesCount: 0,
        details: { errorName: err?.name }
      };
    }
  }

  /**
   * Check health across all registered providers
   */
  public async checkAllProvidersHealth(
    timeoutMs: number = 3000
  ): Promise<Record<string, ProviderHealthResult>> {
    const results: Record<string, ProviderHealthResult> = {};
    const adapters = this.getAllProviders();

    await Promise.all(
      adapters.map(async (adapter) => {
        results[adapter.providerId] = await this.checkProviderHealth(adapter.providerId, timeoutMs);
      })
    );

    return results;
  }
}

// Global Singleton Instance
export const gameProviderRegistry = new GameProviderRegistry();
