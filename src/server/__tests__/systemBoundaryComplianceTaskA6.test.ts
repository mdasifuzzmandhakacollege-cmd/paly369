/**
 * @file systemBoundaryComplianceTaskA6.test.ts
 * @description Task A6 Test Suite: System Boundary & Environment Compliance Gate.
 * Enforces fail-closed normalization of runtime environments, prevents secret leakage in error logs,
 * validates environment capability matrices, and ensures strict isolation between development, sandbox, staging, and production.
 */

import {
  getNormalizedRuntimeEnvironment,
  validateRuntimeEnvironmentConfig,
  assertCapabilityAllowed,
  EnvironmentValidationError,
  CAPABILITY_MATRIX,
  ALLOWED_ENVIRONMENTS,
  isProduction,
  isStaging,
  isSandbox,
  isDevelopment,
} from '../config/environmentGuard.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}`);
    if (detail) {
      console.error(`     Detail: ${detail}`);
    }
  }
}

export async function runTaskA6TestSuite(): Promise<void> {
  console.log('\n================================================================');
  console.log('  Task A6: System Boundary & Environment Compliance Gate');
  console.log('================================================================\n');

  // --- Section 1: Strict Runtime Environment Normalization & Fail-Closed Guard ---
  console.log('--- [1/6] Runtime Environment Normalization & Fail-Closed Behavior ---');

  // 1.1 Valid environments normalize accurately
  for (const env of ALLOWED_ENVIRONMENTS) {
    const normalized = getNormalizedRuntimeEnvironment(env);
    assert(normalized === env, `Exact match normalized for '${env}'`);
  }

  // 1.2 Case-insensitivity and whitespace trimming
  assert(
    getNormalizedRuntimeEnvironment('  PRODUCTION  ') === 'production',
    "Trims whitespace and lowercases ' PRODUCTION ' to 'production'"
  );
  assert(
    getNormalizedRuntimeEnvironment('StAgInG') === 'staging',
    "Normalizes mixed-case 'StAgInG' to 'staging'"
  );
  assert(
    getNormalizedRuntimeEnvironment('SANDBOX') === 'sandbox',
    "Normalizes uppercase 'SANDBOX' to 'sandbox'"
  );

  // 1.3 Test runner aliases normalize safely to development
  assert(
    getNormalizedRuntimeEnvironment('test') === 'development',
    "Alias 'test' normalizes safely to 'development'"
  );
  assert(
    getNormalizedRuntimeEnvironment('testing') === 'development',
    "Alias 'testing' normalizes safely to 'development'"
  );

  // 1.4 Unrecognized/invalid environments must FAIL CLOSED (throw error, never default to production)
  const invalidEnvironments = ['prod', 'dev', 'local', 'qa', 'live', 'staging-test', 'custom_env', '123'];
  for (const invalidEnv of invalidEnvironments) {
    let threw = false;
    let errorCode = '';
    try {
      getNormalizedRuntimeEnvironment(invalidEnv);
    } catch (err: any) {
      threw = true;
      if (err instanceof EnvironmentValidationError) {
        errorCode = err.code;
      }
    }
    assert(
      threw && errorCode === 'ERR_UNKNOWN_ENVIRONMENT',
      `Fails closed on invalid environment '${invalidEnv}' (code: ERR_UNKNOWN_ENVIRONMENT)`
    );
  }

  // 1.5 Boolean environment helpers
  assert(isProduction('production') === true && isProduction('development') === false, 'isProduction helper evaluates accurately');
  assert(isStaging('staging') === true && isStaging('production') === false, 'isStaging helper evaluates accurately');
  assert(isSandbox('sandbox') === true && isSandbox('staging') === false, 'isSandbox helper evaluates accurately');
  assert(isDevelopment('development') === true && isDevelopment('production') === false, 'isDevelopment helper evaluates accurately');

  // --- Section 2: Zero Secret Leakage in Validation & Error Reporting ---
  console.log('\n--- [2/6] Zero Secret Exposure in Validation Errors & Logs ---');

  const superSecretApiKey = 'SUPER_SECRET_LIVE_API_KEY_NEVER_PRINT_9999';
  const superSecretPassword = 'P@ssw0rd_DB_SECRET_NEVER_LEAK_1234!';

  // Intentionally trigger validation errors with environment variables containing secrets
  try {
    validateRuntimeEnvironmentConfig({
      NODE_ENV: 'development',
      ENABLE_LIVE_FINANCIAL_SETTLEMENT: 'true',
      PROVIDER_PGSOFT_API_KEY: superSecretApiKey,
      DATABASE_URL: `postgresql://admin:${superSecretPassword}@cluster.cloudsql.google.com/db`,
    });
    assert(false, 'Should throw EnvironmentValidationError on live settlement in development');
  } catch (err: any) {
    const errorMessage = err.message || '';
    const errorString = String(err);

    assert(
      !errorMessage.includes(superSecretApiKey) && !errorString.includes(superSecretApiKey),
      'Validation error does not leak API keys'
    );
    assert(
      !errorMessage.includes(superSecretPassword) && !errorString.includes(superSecretPassword),
      'Validation error does not leak database credentials'
    );
    assert(
      err instanceof EnvironmentValidationError,
      'Throws typed EnvironmentValidationError on boundary violation'
    );
  }

  // --- Section 3: Development Environment Isolation Invariants ---
  console.log('\n--- [3/6] Development Boundary Constraints & Invariants ---');

  const devResult = validateRuntimeEnvironmentConfig({
    NODE_ENV: 'development',
    ENABLE_LIVE_FINANCIAL_SETTLEMENT: 'false',
    DATABASE_URL: 'postgresql://localhost:5432/test',
  });

  assert(devResult.environment === 'development', 'Development environment confirmed');
  assert(devResult.isValid === true, 'Valid development configuration passes');

  // In development, live settlement is blocked
  let devSettlementThrew = false;
  try {
    validateRuntimeEnvironmentConfig({
      NODE_ENV: 'development',
      ENABLE_LIVE_FINANCIAL_SETTLEMENT: 'true',
    });
  } catch (err: any) {
    devSettlementThrew = true;
    assert(
      err.code === 'ERR_DEV_LIVE_SETTLEMENT_BLOCKED',
      'Development blocks live financial settlement activation (ERR_DEV_LIVE_SETTLEMENT_BLOCKED)'
    );
  }
  assert(devSettlementThrew, 'Development fails closed if live financial settlement is flagged');

  // --- Section 4: Sandbox & Staging Boundary Constraints ---
  console.log('\n--- [4/6] Sandbox & Staging Boundary Constraints ---');

  // Sandbox allows sandbox flow, blocks live settlement
  let sandboxSettlementThrew = false;
  try {
    validateRuntimeEnvironmentConfig({
      NODE_ENV: 'sandbox',
      SANDBOX_ENABLED: 'true',
      ENABLE_LIVE_FINANCIAL_SETTLEMENT: 'true',
    });
  } catch (err: any) {
    sandboxSettlementThrew = true;
    assert(
      err.code === 'ERR_SANDBOX_LIVE_SETTLEMENT_BLOCKED',
      'Sandbox blocks live production settlement (ERR_SANDBOX_LIVE_SETTLEMENT_BLOCKED)'
    );
  }
  assert(sandboxSettlementThrew, 'Sandbox fails closed on live settlement');

  // Staging blocks live settlement
  let stagingSettlementThrew = false;
  try {
    validateRuntimeEnvironmentConfig({
      NODE_ENV: 'staging',
      ENABLE_LIVE_FINANCIAL_SETTLEMENT: 'true',
    });
  } catch (err: any) {
    stagingSettlementThrew = true;
    assert(
      err.code === 'ERR_STAGING_LIVE_SETTLEMENT_BLOCKED',
      'Staging blocks live production settlement (ERR_STAGING_LIVE_SETTLEMENT_BLOCKED)'
    );
  }
  assert(stagingSettlementThrew, 'Staging fails closed on live settlement');

  // --- Section 5: Capability Matrix Boundary Assertions ---
  console.log('\n--- [5/6] Capability Matrix Boundary Assertions ---');

  // 5.1 Payment Webhook Receiver is BLOCKED in development
  let webhookThrew = false;
  try {
    assertCapabilityAllowed('PAYMENT_WEBHOOK_RECEIVER', 'development');
  } catch (err: any) {
    webhookThrew = true;
    assert(err.code === 'ERR_CAPABILITY_BLOCKED', 'PAYMENT_WEBHOOK_RECEIVER is BLOCKED in development');
  }
  assert(webhookThrew, 'Development blocks raw webhook receivers without sandbox harness');

  // 5.2 Provider API Adapter is BLOCKED in development
  let providerThrew = false;
  try {
    assertCapabilityAllowed('PROVIDER_API_ADAPTER', 'development');
  } catch (err: any) {
    providerThrew = true;
    assert(err.code === 'ERR_CAPABILITY_BLOCKED', 'PROVIDER_API_ADAPTER is BLOCKED in development');
  }
  assert(providerThrew, 'Development blocks direct provider adapters');

  // 5.3 Financial Mutation is BLOCKED in development and sandbox
  let devMutationThrew = false;
  try {
    assertCapabilityAllowed('FINANCIAL_MUTATION', 'development');
  } catch (err: any) {
    devMutationThrew = true;
    assert(err.code === 'ERR_CAPABILITY_BLOCKED', 'FINANCIAL_MUTATION is BLOCKED in development');
  }
  assert(devMutationThrew, 'Development blocks direct financial mutation');

  let sandboxMutationThrew = false;
  try {
    assertCapabilityAllowed('FINANCIAL_MUTATION', 'sandbox');
  } catch (err: any) {
    sandboxMutationThrew = true;
    assert(err.code === 'ERR_CAPABILITY_BLOCKED', 'FINANCIAL_MUTATION is BLOCKED in sandbox');
  }
  assert(sandboxMutationThrew, 'Sandbox blocks live real-money financial mutation');

  // 5.4 Admin Monitoring is ALLOWED across all environments (Read-Only)
  for (const env of ALLOWED_ENVIRONMENTS) {
    let monitoringAllowed = false;
    try {
      assertCapabilityAllowed('ADMIN_MONITORING', env);
      monitoringAllowed = true;
    } catch {
      monitoringAllowed = false;
    }
    assert(monitoringAllowed, `ADMIN_MONITORING is ALLOWED in '${env}'`);
  }

  // --- Section 6: Upcoming A6.0 Identity Boundary Invariants ---
  console.log('\n--- [6/6] Upcoming A6.0 Authentication & Identity Verification Invariants ---');

  // Verify capability definitions for Dual Phone / Email unique identity support
  assert(
    CAPABILITY_MATRIX.AUTHENTICATION.authoritativeSource.includes('Firebase Auth') &&
      CAPABILITY_MATRIX.AUTHENTICATION.authoritativeSource.includes('PostgreSQL Users'),
    'Authentication capability references authoritative dual-source boundary'
  );
  assert(
    CAPABILITY_MATRIX.PHONE_OTP.authoritativeSource.includes('PostgreSQL user_auth_factors'),
    'Phone OTP capability references PostgreSQL user_auth_factors authoritative store'
  );
  assert(
    CAPABILITY_MATRIX.EMAIL_VERIFICATION.authoritativeSource.includes('Firebase Auth'),
    'Email verification capability references Firebase Auth / PostgreSQL store'
  );

  console.log('\n================================================================');
  console.log(`  Task A6 Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    throw new Error(`Task A6 Test Suite Failed: ${failedTests} test(s) failed.`);
  }
}
