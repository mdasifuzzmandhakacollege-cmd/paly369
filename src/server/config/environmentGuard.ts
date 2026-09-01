/**
 * @file environmentGuard.ts
 * @description Authoritative System Boundary & Environment Guard for PLAY369.
 * Enforces strict runtime environment normalization, startup configuration validation,
 * and capability boundary matrices without leaking secret values.
 */

export type RuntimeEnvironment = 'development' | 'sandbox' | 'staging' | 'production';

export const ALLOWED_ENVIRONMENTS: readonly RuntimeEnvironment[] = [
  'development',
  'sandbox',
  'staging',
  'production',
] as const;

export type PlatformCapability =
  | 'AUTHENTICATION'
  | 'PHONE_OTP'
  | 'EMAIL_VERIFICATION'
  | 'POSTGRESQL_LEDGER'
  | 'FIREBASE_AUTH'
  | 'FIRESTORE_NON_FINANCIAL'
  | 'PAYMENT_ADAPTER'
  | 'PAYMENT_WEBHOOK_RECEIVER'
  | 'PROVIDER_API_ADAPTER'
  | 'PROVIDER_DEMO_SESSION'
  | 'REFERRAL_AFFILIATE'
  | 'ADMIN_MONITORING'
  | 'FINANCIAL_MUTATION';

export type CapabilityStatus = 'ALLOWED' | 'BLOCKED' | 'CONDITIONAL';

export interface CapabilityRule {
  development: CapabilityStatus;
  sandbox: CapabilityStatus;
  staging: CapabilityStatus;
  production: CapabilityStatus;
  authoritativeSource: string;
}

export const CAPABILITY_MATRIX: Record<PlatformCapability, CapabilityRule> = {
  AUTHENTICATION: {
    development: 'ALLOWED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'ALLOWED',
    authoritativeSource: 'Firebase Auth / PostgreSQL Users',
  },
  PHONE_OTP: {
    development: 'ALLOWED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'ALLOWED',
    authoritativeSource: 'PostgreSQL user_auth_factors / SMS Gateway',
  },
  EMAIL_VERIFICATION: {
    development: 'ALLOWED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'ALLOWED',
    authoritativeSource: 'Firebase Auth / PostgreSQL',
  },
  POSTGRESQL_LEDGER: {
    development: 'ALLOWED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'ALLOWED',
    authoritativeSource: 'PostgreSQL wallets / ledger / transactions',
  },
  FIREBASE_AUTH: {
    development: 'ALLOWED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'ALLOWED',
    authoritativeSource: 'Firebase Auth Service',
  },
  FIRESTORE_NON_FINANCIAL: {
    development: 'ALLOWED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'ALLOWED',
    authoritativeSource: 'Google Cloud Firestore (Profiles, Banners, Announcements)',
  },
  PAYMENT_ADAPTER: {
    development: 'ALLOWED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'ALLOWED',
    authoritativeSource: 'PostgreSQL payment_requests / transactions',
  },
  PAYMENT_WEBHOOK_RECEIVER: {
    development: 'BLOCKED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'ALLOWED',
    authoritativeSource: 'PostgreSQL payment_requests',
  },
  PROVIDER_API_ADAPTER: {
    development: 'BLOCKED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'CONDITIONAL',
    authoritativeSource: 'PostgreSQL seamless_transactions',
  },
  PROVIDER_DEMO_SESSION: {
    development: 'ALLOWED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'ALLOWED',
    authoritativeSource: 'In-Memory / Ephemeral Session Store',
  },
  REFERRAL_AFFILIATE: {
    development: 'ALLOWED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'ALLOWED',
    authoritativeSource: 'PostgreSQL affiliate_commissions / referrals',
  },
  ADMIN_MONITORING: {
    development: 'ALLOWED',
    sandbox: 'ALLOWED',
    staging: 'ALLOWED',
    production: 'ALLOWED',
    authoritativeSource: 'PostgreSQL Authoritative Aggregations (Read-Only)',
  },
  FINANCIAL_MUTATION: {
    development: 'BLOCKED',
    sandbox: 'BLOCKED',
    staging: 'BLOCKED',
    production: 'CONDITIONAL',
    authoritativeSource: 'PostgreSQL Ledger via ACID Transactions',
  },
};

export class EnvironmentValidationError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'ERR_INVALID_ENVIRONMENT') {
    super(`[SystemBoundary Guard] ${message}`);
    this.name = 'EnvironmentValidationError';
    this.code = code;
    Object.setPrototypeOf(this, EnvironmentValidationError.prototype);
  }
}

/**
 * Normalizes and validates the runtime environment string.
 * Fails closed on any unknown or unrecognized values.
 *
 * @param envVar Optional explicit environment string to evaluate
 * @returns Normalized RuntimeEnvironment
 * @throws EnvironmentValidationError if the environment string is invalid
 */
export function getNormalizedRuntimeEnvironment(envVar?: string): RuntimeEnvironment {
  const rawEnv = envVar !== undefined ? envVar : (process.env.APP_ENV || process.env.NODE_ENV);

  // If no environment is specified at all, default safely to 'development'
  if (!rawEnv || rawEnv.trim() === '') {
    return 'development';
  }

  const normalized = rawEnv.trim().toLowerCase();

  // Test aliases (e.g. standard Jest/Vitest/Node test runner) normalize safely to 'development'
  if (normalized === 'test' || normalized === 'testing') {
    return 'development';
  }

  // Strict match against approved environments
  if (ALLOWED_ENVIRONMENTS.includes(normalized as RuntimeEnvironment)) {
    return normalized as RuntimeEnvironment;
  }

  // FAIL CLOSED: Never guess or fall back to production for invalid environments
  throw new EnvironmentValidationError(
    `Invalid or unrecognized runtime environment '${rawEnv}'. Allowed values: ${ALLOWED_ENVIRONMENTS.join(', ')}. Server failed closed.`,
    'ERR_UNKNOWN_ENVIRONMENT'
  );
}

export interface EnvironmentValidationResult {
  environment: RuntimeEnvironment;
  isValid: boolean;
  sanitizedConfig: {
    databaseConfigured: boolean;
    geminiConfigured: boolean;
    sandboxEnabled: boolean;
    activeProviders: string[];
  };
  warnings: string[];
}

/**
 * Validates the startup environment configuration without leaking secrets.
 *
 * @param env Optional process.env override for testing
 * @returns EnvironmentValidationResult
 * @throws EnvironmentValidationError on configuration violation
 */
export function validateRuntimeEnvironmentConfig(
  env: NodeJS.ProcessEnv = process.env
): EnvironmentValidationResult {
  const runtimeEnv = getNormalizedRuntimeEnvironment(env.APP_ENV || env.NODE_ENV);
  const warnings: string[] = [];

  const dbUrl = env.DATABASE_URL;
  const isDbConfigured = Boolean(dbUrl && dbUrl.trim() !== '');
  const isGeminiConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== '');
  const isSandboxEnabled = env.SANDBOX_PAYMENT_ENABLED === 'true' || env.SANDBOX_ENABLED === 'true';

  // Check provider flags
  const providerKeys = ['PGSOFT', 'PRAGMATIC', 'SPRIBE', 'EVOLUTION', 'CUSTOM'] as const;
  const activeProviders: string[] = [];

  for (const p of providerKeys) {
    if (env[`PROVIDER_${p}_ENABLED`] === 'true') {
      activeProviders.push(p);
    }
  }

  // 1. Development Boundary Validation
  if (runtimeEnv === 'development') {
    // Development must not activate live external financial mutations
    if (env.ENABLE_LIVE_FINANCIAL_SETTLEMENT === 'true') {
      throw new EnvironmentValidationError(
        'Development environment is strictly forbidden from enabling live financial settlement (ENABLE_LIVE_FINANCIAL_SETTLEMENT=true).',
        'ERR_DEV_LIVE_SETTLEMENT_BLOCKED'
      );
    }
  }

  // 2. Sandbox Boundary Validation
  if (runtimeEnv === 'sandbox') {
    // Sandbox cannot enable live settlement
    if (env.ENABLE_LIVE_FINANCIAL_SETTLEMENT === 'true') {
      throw new EnvironmentValidationError(
        'Sandbox environment cannot enable live production settlement keys.',
        'ERR_SANDBOX_LIVE_SETTLEMENT_BLOCKED'
      );
    }
  }

  // 3. Staging Boundary Validation
  if (runtimeEnv === 'staging') {
    if (env.ENABLE_LIVE_FINANCIAL_SETTLEMENT === 'true') {
      throw new EnvironmentValidationError(
        'Staging environment cannot activate production financial settlement.',
        'ERR_STAGING_LIVE_SETTLEMENT_BLOCKED'
      );
    }
  }

  // 4. Production Boundary Validation
  if (runtimeEnv === 'production') {
    if (isSandboxEnabled) {
      warnings.push('Sandbox payment flow is explicitly flagged on in production environment.');
    }
  }

  return {
    environment: runtimeEnv,
    isValid: true,
    sanitizedConfig: {
      databaseConfigured: isDbConfigured,
      geminiConfigured: isGeminiConfigured,
      sandboxEnabled: isSandboxEnabled,
      activeProviders,
    },
    warnings,
  };
}

/**
 * Asserts that a platform capability is allowed in the current runtime environment.
 *
 * @param capability Platform capability to evaluate
 * @param currentEnv Optional runtime environment (defaults to normalized current env)
 * @throws EnvironmentValidationError if capability is blocked
 */
export function assertCapabilityAllowed(
  capability: PlatformCapability,
  currentEnv?: RuntimeEnvironment
): void {
  const env = currentEnv || getNormalizedRuntimeEnvironment();
  const rule = CAPABILITY_MATRIX[capability];

  if (!rule) {
    throw new EnvironmentValidationError(
      `Unknown platform capability '${capability}'.`,
      'ERR_UNKNOWN_CAPABILITY'
    );
  }

  const status = rule[env];

  if (status === 'BLOCKED') {
    throw new EnvironmentValidationError(
      `Capability '${capability}' is strictly BLOCKED in environment '${env}'. Authoritative source: ${rule.authoritativeSource}`,
      'ERR_CAPABILITY_BLOCKED'
    );
  }
}

/**
 * Helper environment check functions
 */
export function isProduction(env?: string): boolean {
  return getNormalizedRuntimeEnvironment(env) === 'production';
}

export function isStaging(env?: string): boolean {
  return getNormalizedRuntimeEnvironment(env) === 'staging';
}

export function isSandbox(env?: string): boolean {
  return getNormalizedRuntimeEnvironment(env) === 'sandbox';
}

export function isDevelopment(env?: string): boolean {
  return getNormalizedRuntimeEnvironment(env) === 'development';
}
