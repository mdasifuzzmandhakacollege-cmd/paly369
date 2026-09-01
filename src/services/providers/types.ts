/**
 * @file types.ts
 * @description Core TypeScript contracts and schemas for the PLAY369 Game Provider Adapter Foundation.
 * 
 * [ARCHITECTURAL CONTRACT]:
 * - Defines provider-agnostic game models, launch requests, and session results.
 * - Allows any real iGaming provider (PG Soft, Pragmatic Play, JILI, Spribe, Evolution)
 *   or Mock Provider to be registered without altering UI components or Wallet engines.
 */

export type GameCategoryType =
  | 'all'
  | 'hot'
  | 'slots'
  | 'crash'
  | 'casino'
  | 'table'
  | 'sports'
  | 'fishing'
  | 'arcade';

export type GameVolatility = 'Low' | 'Medium' | 'High' | 'Extreme';

export type GameLaunchMode = 'iframe' | 'redirect' | 'component' | 'direct';

export interface GameItem {
  id: string;
  name: string;
  nameBn?: string;
  provider: string;
  providerId: string;
  category: GameCategoryType;
  rtp: string;
  volatility: GameVolatility;
  maxMultiplier: string;
  minBet: number;
  maxBet: number;
  imageUrl: string;
  isFeatured?: boolean;
  isHot?: boolean;
  isNew?: boolean;
  badge?: string;
  activePlayersCount?: number;
  tags?: string[];
  demoSupported?: boolean;
}

export interface GameListFilter {
  category?: string;
  providerId?: string;
  searchQuery?: string;
  search?: string;
  isHot?: boolean;
  isFeatured?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateGameSessionRequest {
  userId: string;
  username: string;
  gameId: string;
  currency: 'BDT' | 'USD';
  mode?: 'REAL' | 'DEMO';
  ipAddress?: string;
  language?: 'bn' | 'en';
  clientPlatform?: 'web' | 'mobile_web' | 'android' | 'ios';
  returnUrl?: string;
}

export interface GameSessionResult {
  sessionId: string;
  gameId: string;
  providerId: string;
  token: string;
  expiresInSeconds: number;
  gameLaunchUrl: string;
  launchMode: GameLaunchMode;
  createdAt: string;
}

export interface LaunchGameRequest {
  userId: string;
  username?: string;
  gameId: string;
  currency?: 'BDT' | 'USD';
  mode?: 'REAL' | 'DEMO';
  language?: 'bn' | 'en';
  clientPlatform?: 'web' | 'mobile_web' | 'android' | 'ios';
  returnUrl?: string;
}

export interface GameLaunchResult {
  success: boolean;
  gameId: string;
  providerId: string;
  launchUrl?: string;
  launchMode: GameLaunchMode;
  session?: GameSessionResult;
  error?: string;
}

export type ProviderHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';

export interface ProviderHealthResult {
  provider: string;
  providerId: string;
  providerName: string;
  status: ProviderHealthStatus;
  latency: number;
  latencyMs: number;
  checkedAt: string;
  error?: string | null;
  activeGamesCount?: number;
  details?: Record<string, any>;
}

/**
 * Generic Game Provider Adapter Interface
 * All concrete providers (Mock, PG Soft, Pragmatic, Spribe, etc.) must implement this interface.
 */
export interface GameProviderAdapter {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerCode: string;

  /**
   * Fetch catalog of games supported by this provider
   */
  listGames(filter?: GameListFilter): Promise<GameItem[]>;

  /**
   * Fetch a single game by its unique ID
   */
  getGame(gameId: string): Promise<GameItem | null>;

  /**
   * Authorize and create a secure game session for an authenticated player
   */
  createGameSession(request: CreateGameSessionRequest): Promise<GameSessionResult>;

  /**
   * Generate complete launch parameters/URL for client playback
   */
  launchGame(request: LaunchGameRequest): Promise<GameLaunchResult>;

  /**
   * Health ping to check remote API availability and response latency
   */
  healthCheck(): Promise<ProviderHealthResult>;

  /**
   * Alias for backwards compatibility
   */
  getProviderHealth?(): Promise<ProviderHealthResult>;
}
