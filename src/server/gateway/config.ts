/**
 * @file config.ts
 * @description Server-only provider configuration and environment variable resolver.
 * 
 * [SECURITY RULE]:
 * - Reads credentials strictly from process.env on the server.
 * - Never exports credentials to client-side bundles or HTTP responses.
 * - Uses lazy initialization and safe fallbacks.
 */

export interface ProviderServerConfig {
  providerId: string;
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  endpointUrl?: string;
  operatorId?: string;
  timeoutMs: number;
}

export function getProviderServerConfig(providerId: string): ProviderServerConfig {
  const normId = providerId.toLowerCase().trim();

  switch (normId) {
    case 'mock_aggregator':
    case 'mock':
      return {
        providerId: 'mock_aggregator',
        enabled: true,
        endpointUrl: 'internal://mock_aggregator',
        timeoutMs: 3000
      };

    case 'pgsoft':
      return {
        providerId: 'pgsoft',
        enabled: process.env.PROVIDER_PGSOFT_ENABLED === 'true',
        apiKey: process.env.PROVIDER_PGSOFT_API_KEY,
        apiSecret: process.env.PROVIDER_PGSOFT_SECRET,
        endpointUrl: process.env.PROVIDER_PGSOFT_URL || 'https://api.pgsoft.example.com',
        operatorId: process.env.PROVIDER_PGSOFT_OPERATOR_ID,
        timeoutMs: Number(process.env.PROVIDER_PGSOFT_TIMEOUT_MS) || 4000
      };

    case 'pragmatic':
    case 'pragmaticplay':
      return {
        providerId: 'pragmatic',
        enabled: process.env.PROVIDER_PRAGMATIC_ENABLED === 'true',
        apiKey: process.env.PROVIDER_PRAGMATIC_API_KEY,
        apiSecret: process.env.PROVIDER_PRAGMATIC_SECRET,
        endpointUrl: process.env.PROVIDER_PRAGMATIC_URL || 'https://api.pragmaticplay.example.com',
        operatorId: process.env.PROVIDER_PRAGMATIC_OPERATOR_ID,
        timeoutMs: Number(process.env.PROVIDER_PRAGMATIC_TIMEOUT_MS) || 4000
      };

    case 'spribe':
      return {
        providerId: 'spribe',
        enabled: process.env.PROVIDER_SPRIBE_ENABLED === 'true',
        apiKey: process.env.PROVIDER_SPRIBE_API_KEY,
        apiSecret: process.env.PROVIDER_SPRIBE_SECRET,
        endpointUrl: process.env.PROVIDER_SPRIBE_URL || 'https://api.spribe.example.com',
        timeoutMs: Number(process.env.PROVIDER_SPRIBE_TIMEOUT_MS) || 4000
      };

    case 'jili':
      return {
        providerId: 'jili',
        enabled: process.env.PROVIDER_JILI_ENABLED === 'true',
        apiKey: process.env.PROVIDER_JILI_API_KEY,
        apiSecret: process.env.PROVIDER_JILI_SECRET,
        endpointUrl: process.env.PROVIDER_JILI_URL || 'https://api.jili.example.com',
        timeoutMs: Number(process.env.PROVIDER_JILI_TIMEOUT_MS) || 4000
      };

    default:
      return {
        providerId: normId,
        enabled: false,
        timeoutMs: 4000
      };
  }
}
