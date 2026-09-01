/**
 * @file providerGatewayController.ts
 * @description Express Controller & Router for Server-Side Provider Gateway.
 * 
 * [ARCHITECTURAL CONTRACT]:
 * - Exposes REST endpoints for game catalog, session generation, game launching, and provider health checks.
 * - Extracts and manages `x-correlation-id` for distributed request tracing.
 * - Guarantees all errors return structured JSON with GatewayErrorCode.
 */

import { Request, Response, Router } from 'express';
import { serverProviderGateway, ServerProviderGateway } from '../gateway/serverProviderGateway';

export class ProviderGatewayController {
  private gateway: ServerProviderGateway;

  constructor(gateway: ServerProviderGateway = serverProviderGateway) {
    this.gateway = gateway;
  }

  /**
   * Helper to extract correlation ID from request headers
   */
  private getCorrelationId(req: Request): string {
    return this.gateway.resolveCorrelationId(req.headers['x-correlation-id'] as string | undefined);
  }

  /**
   * GET /api/gateway/providers/games
   * Lists games from registered providers matching query parameters
   */
  public listGames = async (req: Request, res: Response): Promise<void> => {
    const correlationId = this.getCorrelationId(req);
    try {
      const { category, providerId, search, isHot, limit, offset } = req.query;

      const result = await this.gateway.listGames(
        {
          category: typeof category === 'string' ? category : undefined,
          providerId: typeof providerId === 'string' ? providerId : undefined,
          search: typeof search === 'string' ? search : undefined,
          isHot: isHot === 'true',
          limit: limit ? Number(limit) : undefined,
          offset: offset ? Number(offset) : undefined
        },
        correlationId
      );

      res.setHeader('x-correlation-id', correlationId);
      res.status(200).json(result);
    } catch (err: any) {
      const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
      res.setHeader('x-correlation-id', correlationId);
      res.status(statusCode).json(payload);
    }
  };

  /**
   * GET /api/gateway/providers/games/:gameId
   * Retrieves single game metadata
   */
  public getGame = async (req: Request, res: Response): Promise<void> => {
    const correlationId = this.getCorrelationId(req);
    try {
      const { gameId } = req.params;
      const result = await this.gateway.getGame(gameId, correlationId);

      res.setHeader('x-correlation-id', correlationId);
      res.status(200).json(result);
    } catch (err: any) {
      const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
      res.setHeader('x-correlation-id', correlationId);
      res.status(statusCode).json(payload);
    }
  };

  /**
   * POST /api/gateway/providers/session
   * Generates an authorized player session
   */
  public createSession = async (req: Request, res: Response): Promise<void> => {
    const correlationId = this.getCorrelationId(req);
    try {
      const result = await this.gateway.createSession(req.body, correlationId);

      res.setHeader('x-correlation-id', correlationId);
      res.status(200).json(result);
    } catch (err: any) {
      const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
      res.setHeader('x-correlation-id', correlationId);
      res.status(statusCode).json(payload);
    }
  };

  /**
   * POST /api/gateway/providers/launch
   * Launches a game session (returns launch mode, component or iframe URL)
   */
  public launchGame = async (req: Request, res: Response): Promise<void> => {
    const correlationId = this.getCorrelationId(req);
    try {
      const result = await this.gateway.launchGame(req.body, correlationId);

      res.setHeader('x-correlation-id', correlationId);
      res.status(200).json(result);
    } catch (err: any) {
      const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
      res.setHeader('x-correlation-id', correlationId);
      res.status(statusCode).json(payload);
    }
  };

  /**
   * GET /api/gateway/providers/health
   * Retrieves health status across all registered providers
   */
  public getHealth = async (req: Request, res: Response): Promise<void> => {
    const correlationId = this.getCorrelationId(req);
    try {
      const timeoutMs = req.query.timeout ? Number(req.query.timeout) : 3000;
      const result = await this.gateway.checkAllProvidersHealth(correlationId, timeoutMs);

      res.setHeader('x-correlation-id', correlationId);
      res.status(200).json(result);
    } catch (err: any) {
      const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
      res.setHeader('x-correlation-id', correlationId);
      res.status(statusCode).json(payload);
    }
  };

  /**
   * GET /api/gateway/providers/health/:providerId
   * Retrieves health status for a specific provider
   */
  public getProviderHealth = async (req: Request, res: Response): Promise<void> => {
    const correlationId = this.getCorrelationId(req);
    try {
      const { providerId } = req.params;
      const timeoutMs = req.query.timeout ? Number(req.query.timeout) : 3000;
      const result = await this.gateway.checkProviderHealth(providerId, correlationId, timeoutMs);

      res.setHeader('x-correlation-id', correlationId);
      res.status(200).json(result);
    } catch (err: any) {
      const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
      res.setHeader('x-correlation-id', correlationId);
      res.status(statusCode).json(payload);
    }
  };

  /**
   * GET /api/gateway/providers/overview
   * Retrieves aggregate system health summary
   */
  public getOverview = async (req: Request, res: Response): Promise<void> => {
    const correlationId = this.getCorrelationId(req);
    try {
      const timeoutMs = req.query.timeout ? Number(req.query.timeout) : 3000;
      const result = await this.gateway.getSystemHealthOverview(correlationId, timeoutMs);

      res.setHeader('x-correlation-id', correlationId);
      res.status(200).json(result);
    } catch (err: any) {
      const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
      res.setHeader('x-correlation-id', correlationId);
      res.status(statusCode).json(payload);
    }
  };
}

export const providerGatewayController = new ProviderGatewayController();

/**
 * Express router factory for Provider Gateway routes
 */
export function createProviderGatewayRouter(): Router {
  const router = Router();

  router.get('/games', providerGatewayController.listGames);
  router.get('/games/:gameId', providerGatewayController.getGame);
  router.post('/session', providerGatewayController.createSession);
  router.post('/launch', providerGatewayController.launchGame);
  router.get('/health', providerGatewayController.getHealth);
  router.get('/health/:providerId', providerGatewayController.getProviderHealth);
  router.get('/overview', providerGatewayController.getOverview);

  return router;
}
