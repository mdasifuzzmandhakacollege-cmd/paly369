/**
 * @file errors.ts
 * @description Standardized error hierarchy and timeout wrappers for the PLAY369 Provider Adapter Layer.
 */

export class ProviderError extends Error {
  public readonly providerId: string;
  public readonly statusCode?: number;
  public readonly isOperational: boolean;

  constructor(message: string, providerId: string, statusCode?: number) {
    super(message);
    this.name = 'ProviderError';
    this.providerId = providerId;
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(providerId: string, timeoutMs: number) {
    super(
      `Provider '${providerId}' request timed out after ${timeoutMs}ms`,
      providerId,
      408
    );
    this.name = 'ProviderTimeoutError';
    Object.setPrototypeOf(this, ProviderTimeoutError.prototype);
  }
}

export class GameNotFoundError extends ProviderError {
  constructor(gameId: string, providerId: string = 'unknown') {
    super(`Game with ID '${gameId}' was not found in provider '${providerId}'`, providerId, 404);
    this.name = 'GameNotFoundError';
    Object.setPrototypeOf(this, GameNotFoundError.prototype);
  }
}

export class ProviderOfflineError extends ProviderError {
  constructor(providerId: string, reason?: string) {
    super(
      `Provider '${providerId}' is currently offline or unreachable${reason ? `: ${reason}` : ''}`,
      providerId,
      503
    );
    this.name = 'ProviderOfflineError';
    Object.setPrototypeOf(this, ProviderOfflineError.prototype);
  }
}

/**
 * Executes a promise with an enforced timeout limit.
 * If the promise doesn't resolve within timeoutMs, throws ProviderTimeoutError.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  providerId: string = 'generic'
): Promise<T> {
  let timer: NodeJS.Timeout | number;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ProviderTimeoutError(providerId, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer! as any);
  }
}
