/**
 * @file healthService.ts
 * @description Internal Health Status Service for PLAY369 Game Provider Adapters.
 * 
 * [ARCHITECTURAL CONTRACT]:
 * - Periodically and on-demand monitors provider health status across registered adapters.
 * - Distinguishes between HEALTHY, DEGRADED, and UNAVAILABLE states.
 * - Enforces strict timeout handling to prevent hanging requests.
 * - Exposes structured health reports without leaking sensitive provider infrastructure details.
 */

import { ProviderHealthResult, ProviderHealthStatus } from './types';
import { GameProviderRegistry, gameProviderRegistry } from './providerRegistry';
import { withTimeout } from './errors';

export interface SystemHealthOverview {
  overallStatus: ProviderHealthStatus;
  totalProviders: number;
  healthyCount: number;
  degradedCount: number;
  unavailableCount: number;
  timestamp: string;
  providers: ProviderHealthResult[];
}

export class ProviderHealthService {
  private registry: GameProviderRegistry;
  private defaultTimeoutMs: number = 3500;
  private lastHealthMap: Map<string, ProviderHealthResult> = new Map();

  constructor(registry: GameProviderRegistry = gameProviderRegistry) {
    this.registry = registry;
  }

  /**
   * Check health of a single specific provider adapter
   */
  public async checkProvider(
    providerId: string,
    timeoutMs: number = this.defaultTimeoutMs
  ): Promise<ProviderHealthResult> {
    const startTime = performance.now();
    const checkedAt = new Date().toISOString();
    const adapter = this.registry.getProvider(providerId);

    if (!adapter) {
      const elapsed = Math.round(performance.now() - startTime);
      const result: ProviderHealthResult = {
        provider: providerId,
        providerId,
        providerName: `Unknown Provider (${providerId})`,
        status: 'UNAVAILABLE',
        latency: elapsed,
        latencyMs: elapsed,
        checkedAt,
        error: `Provider '${providerId}' is not registered in ProviderRegistry`,
        activeGamesCount: 0,
        details: { reason: 'ProviderNotRegistered' }
      };
      this.lastHealthMap.set(providerId.toLowerCase(), result);
      return result;
    }

    try {
      // Execute health check with enforced timeout boundary
      const healthPromise = adapter.healthCheck
        ? adapter.healthCheck()
        : adapter.getProviderHealth
        ? adapter.getProviderHealth()
        : Promise.resolve({
            provider: adapter.providerId,
            providerId: adapter.providerId,
            providerName: adapter.providerName,
            status: 'HEALTHY' as ProviderHealthStatus,
            latency: 1,
            latencyMs: 1,
            checkedAt,
            error: null,
            activeGamesCount: 0
          });

      const result = await withTimeout(healthPromise, timeoutMs, adapter.providerId);
      
      // Ensure standardized structure
      const normalizedResult: ProviderHealthResult = {
        provider: result.provider || adapter.providerId,
        providerId: result.providerId || adapter.providerId,
        providerName: result.providerName || adapter.providerName,
        status: result.status,
        latency: result.latency ?? result.latencyMs ?? 0,
        latencyMs: result.latencyMs ?? result.latency ?? 0,
        checkedAt: result.checkedAt || checkedAt,
        error: result.error || null,
        activeGamesCount: result.activeGamesCount ?? 0,
        details: result.details
      };

      this.lastHealthMap.set(adapter.providerId.toLowerCase(), normalizedResult);
      return normalizedResult;
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      const errorResult: ProviderHealthResult = {
        provider: adapter.providerId,
        providerId: adapter.providerId,
        providerName: adapter.providerName,
        status: 'UNAVAILABLE',
        latency: elapsed,
        latencyMs: elapsed,
        checkedAt,
        error: err?.message || 'Health check timed out or failed',
        activeGamesCount: 0,
        details: { errorName: err?.name || 'Error' }
      };
      this.lastHealthMap.set(adapter.providerId.toLowerCase(), errorResult);
      return errorResult;
    }
  }

  /**
   * Check health of all registered provider adapters in parallel
   */
  public async checkAllProviders(
    timeoutMs: number = this.defaultTimeoutMs
  ): Promise<ProviderHealthResult[]> {
    const adapters = this.registry.getAllProviders();
    if (adapters.length === 0) {
      return [];
    }

    const checkPromises = adapters.map((adapter) =>
      this.checkProvider(adapter.providerId, timeoutMs)
    );

    return await Promise.all(checkPromises);
  }

  /**
   * Returns a map of provider ID to its latest health result
   */
  public async getHealthMap(
    timeoutMs: number = this.defaultTimeoutMs
  ): Promise<Record<string, ProviderHealthResult>> {
    const results = await this.checkAllProviders(timeoutMs);
    const map: Record<string, ProviderHealthResult> = {};
    for (const r of results) {
      map[r.providerId] = r;
    }
    return map;
  }

  /**
   * Get system-wide aggregate health summary
   */
  public async getSystemHealthOverview(
    timeoutMs: number = this.defaultTimeoutMs
  ): Promise<SystemHealthOverview> {
    const results = await this.checkAllProviders(timeoutMs);

    let healthyCount = 0;
    let degradedCount = 0;
    let unavailableCount = 0;

    for (const r of results) {
      if (r.status === 'HEALTHY') healthyCount++;
      else if (r.status === 'DEGRADED') degradedCount++;
      else unavailableCount++;
    }

    let overallStatus: ProviderHealthStatus = 'HEALTHY';
    if (unavailableCount > 0 && healthyCount === 0) {
      overallStatus = 'UNAVAILABLE';
    } else if (unavailableCount > 0 || degradedCount > 0) {
      overallStatus = 'DEGRADED';
    }

    return {
      overallStatus,
      totalProviders: results.length,
      healthyCount,
      degradedCount,
      unavailableCount,
      timestamp: new Date().toISOString(),
      providers: results
    };
  }

  /**
   * Get cached health result without issuing fresh network ping
   */
  public getCachedHealth(providerId: string): ProviderHealthResult | undefined {
    return this.lastHealthMap.get(providerId.toLowerCase());
  }
}

// Global Singleton Instance
export const providerHealthService = new ProviderHealthService();
