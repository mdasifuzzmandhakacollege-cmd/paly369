/**
 * @file serverProviderGateway.ts
 * @description Server-Side Provider Gateway for PLAY369.
 * 
 * [ARCHITECTURAL CONTRACT]:
 * - Acts as the server boundary between HTTP API endpoints and GameService / ProviderRegistry / ProviderAdapters.
 * - Handles request correlation IDs, payload validation, and request timeout boundaries.
 * - Maps all errors to structured GatewayError codes:
 *   * VALIDATION_ERROR
 *   * PROVIDER_UNAVAILABLE
 *   * PROVIDER_TIMEOUT
 *   * PROVIDER_ERROR
 *   * INTERNAL_ERROR
 * - Safely masks any sensitive credentials or tokens in telemetry/logs.
 */

import { gameService, GameService } from '../../services/gameService';
import { GameItem, GameLaunchResult, GameSessionResult, ProviderHealthResult } from '../../services/providers/types';
import {
  GatewayError,
  GatewayErrorCode,
  GatewayLaunchRequest,
  GatewayListGamesRequest,
  GatewayResponse,
  GatewaySessionRequest
} from './types';
import { validateGameId, validateLaunchPayload, validateProviderId, validateSessionPayload } from './validation';
import { safeLog } from './masking';

export class ServerProviderGateway {
  private gameService: GameService;
  private defaultTimeoutMs: number = 4000;

  constructor(service: GameService = gameService) {
    this.gameService = service;
  }

  /**
   * Generates or sanitizes a request correlation ID
   */
  public resolveCorrelationId(headerValue?: string | string[]): string {
    if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
      return headerValue.trim().substring(0, 64);
    }
    const rand = Math.random().toString(36).substring(2, 10);
    return `req-gw-${Date.now()}-${rand}`;
  }

  /**
   * Wraps an asynchronous operation with an enforceable timeout and structured error mapping
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    correlationId: string,
    operationName: string,
    providerId?: string | null
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new GatewayError(
            'PROVIDER_TIMEOUT',
            `Operation '${operationName}' timed out after ${timeoutMs}ms`,
            504,
            providerId,
            { timeoutMs, operationName }
          )
        );
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      if (timer) clearTimeout(timer);
      return result;
    } catch (err: any) {
      if (timer) clearTimeout(timer);

      if (err instanceof GatewayError) {
        throw err;
      }

      // Map domain error names from providers subsystem
      const errName = err?.name || '';
      const errMsg = err?.message || 'Unknown provider error';

      if (errName === 'ProviderTimeoutError') {
        throw new GatewayError('PROVIDER_TIMEOUT', errMsg, 504, providerId, { originalError: errName });
      }

      if (errName === 'ProviderOfflineError' || errName === 'GameNotFoundError') {
        throw new GatewayError('PROVIDER_UNAVAILABLE', errMsg, 503, providerId, { originalError: errName });
      }

      if (errName === 'ProviderValidationError') {
        throw new GatewayError('VALIDATION_ERROR', errMsg, 400, providerId, { originalError: errName });
      }

      if (errName === 'ProviderError') {
        throw new GatewayError('PROVIDER_ERROR', errMsg, 502, providerId, { originalError: errName });
      }

      // Fallback unhandled error
      throw new GatewayError('INTERNAL_ERROR', errMsg, 500, providerId, { originalError: errName });
    }
  }

  /**
   * Retrieve game catalog through the Gateway
   */
  public async listGames(
    req: GatewayListGamesRequest,
    correlationId: string
  ): Promise<GatewayResponse<GameItem[]>> {
    safeLog('info', correlationId, 'Listing games with filter', req);

    if (req.providerId && req.providerId !== 'all') {
      validateProviderId(req.providerId, 'providerId');
    }

    const games = await this.executeWithTimeout(
      async () => {
        return await this.gameService.listGames(req);
      },
      this.defaultTimeoutMs,
      correlationId,
      'listGames',
      req.providerId
    );

    safeLog('info', correlationId, `Fetched ${games.length} games`);

    return {
      success: true,
      data: games,
      correlationId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Retrieve single game details through Gateway
   */
  public async getGame(
    gameId: string,
    correlationId: string
  ): Promise<GatewayResponse<GameItem>> {
    const validGameId = validateGameId(gameId);
    safeLog('info', correlationId, `Fetching game ${validGameId}`);

    const game = await this.executeWithTimeout(
      async () => {
        return await this.gameService.getGame(validGameId);
      },
      this.defaultTimeoutMs,
      correlationId,
      'getGame'
    );

    if (!game) {
      throw new GatewayError('PROVIDER_UNAVAILABLE', `Game '${validGameId}' not found or unavailable`, 503, null, {
        gameId: validGameId
      });
    }

    return {
      success: true,
      data: game,
      correlationId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create an authorized game session through the Gateway
   */
  public async createSession(
    payload: any,
    correlationId: string
  ): Promise<GatewayResponse<GameSessionResult>> {
    const validated = validateSessionPayload(payload);
    safeLog('info', correlationId, 'Creating game session', {
      gameId: validated.gameId,
      userId: validated.userId,
      currency: validated.currency
    });

    const session = await this.executeWithTimeout(
      async () => {
        return await this.gameService.createGameSession(validated);
      },
      this.defaultTimeoutMs,
      correlationId,
      'createSession'
    );

    safeLog('info', correlationId, 'Game session generated successfully', {
      sessionId: session.sessionId,
      gameId: session.gameId
    });

    return {
      success: true,
      data: session,
      correlationId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Launch game through the Gateway
   */
  public async launchGame(
    payload: any,
    correlationId: string
  ): Promise<GatewayResponse<GameLaunchResult>> {
    const validated = validateLaunchPayload(payload);
    safeLog('info', correlationId, 'Launching game', {
      gameId: validated.gameId,
      userId: validated.userId,
      currency: validated.currency
    });

    const result = await this.executeWithTimeout(
      async () => {
        return await this.gameService.launchGame(validated);
      },
      this.defaultTimeoutMs,
      correlationId,
      'launchGame'
    );

    if (!result.success) {
      throw new GatewayError('PROVIDER_ERROR', result.error || 'Provider rejected game launch', 502, result.providerId, {
        gameId: validated.gameId
      });
    }

    safeLog('info', correlationId, 'Game launched successfully', {
      gameId: result.gameId,
      launchMode: result.launchMode
    });

    return {
      success: true,
      data: result,
      correlationId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check health of a specific provider through Gateway
   */
  public async checkProviderHealth(
    providerId: string,
    correlationId: string,
    timeoutMs: number = 3000
  ): Promise<GatewayResponse<ProviderHealthResult>> {
    const validProviderId = validateProviderId(providerId);
    safeLog('info', correlationId, `Checking health for provider '${validProviderId}'`);

    const health = await this.executeWithTimeout(
      async () => {
        return await this.gameService.checkProviderHealth(validProviderId, timeoutMs);
      },
      timeoutMs + 500,
      correlationId,
      'checkProviderHealth',
      validProviderId
    );

    if (health.status === 'UNAVAILABLE') {
      throw new GatewayError(
        'PROVIDER_UNAVAILABLE',
        health.error || `Provider '${validProviderId}' is UNAVAILABLE`,
        503,
        validProviderId,
        { health }
      );
    }

    return {
      success: true,
      data: health,
      correlationId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check health of all providers through Gateway
   */
  public async checkAllProvidersHealth(
    correlationId: string,
    timeoutMs: number = 3000
  ): Promise<GatewayResponse<Record<string, ProviderHealthResult>>> {
    safeLog('info', correlationId, 'Checking health across all providers');

    const healthMap = await this.executeWithTimeout(
      async () => {
        return await this.gameService.checkProvidersHealth(timeoutMs);
      },
      timeoutMs + 1000,
      correlationId,
      'checkAllProvidersHealth'
    );

    return {
      success: true,
      data: healthMap,
      correlationId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Retrieve system-wide provider health overview
   */
  public async getSystemHealthOverview(
    correlationId: string,
    timeoutMs: number = 3000
  ): Promise<GatewayResponse<any>> {
    safeLog('info', correlationId, 'Fetching system health overview');

    const overview = await this.executeWithTimeout(
      async () => {
        return await this.gameService.getSystemHealthOverview(timeoutMs);
      },
      timeoutMs + 1000,
      correlationId,
      'getSystemHealthOverview'
    );

    return {
      success: true,
      data: overview,
      correlationId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Formats error objects into uniform GatewayError responses
   */
  public formatErrorResponse(err: any, correlationId: string): { statusCode: number; payload: GatewayResponse<null> } {
    const timestamp = new Date().toISOString();

    if (err instanceof GatewayError) {
      safeLog('warn', correlationId, `GatewayError [${err.code}]: ${err.message}`, {
        statusCode: err.statusCode,
        provider: err.provider,
        details: err.details
      });

      return {
        statusCode: err.statusCode,
        payload: {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            provider: err.provider,
            details: err.details
          },
          correlationId,
          timestamp
        }
      };
    }

    safeLog('error', correlationId, `Unhandled error in Provider Gateway: ${err?.message || err}`, err);

    return {
      statusCode: 500,
      payload: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err?.message || 'An unexpected internal gateway error occurred'
        },
        correlationId,
        timestamp
      }
    };
  }
}

// Global Singleton Instance
export const serverProviderGateway = new ServerProviderGateway();
