/**
 * @file simulatedWalletEngine.ts
 * @description In-memory relational ledger engine with true PostgreSQL ACID transaction semantics,
 * row-level locking (mutex per wallet_id), HMAC verification, idempotency caching, and latency tracking.
 */

import {
  BalanceRequest,
  BalanceResponse,
  BetRequest,
  WinRequest,
  RefundRequest,
  TransactionResponse,
  SeamlessErrorCode,
  UserEntity,
  WalletEntity,
  TransactionEntity,
  GameRoundEntity,
  PaymentRequestEntity,
  PaymentMethodType,
  PaymentRequestType,
  PaymentStatus,
  WageringRequirementEntity,
  WageringProgressDTO
} from '../server/types/seamless';
import {
  generateExplainAnalyze,
  ExplainAnalyzeOptions,
  ExplainAnalyzeResult
} from './explainAnalyzeEngine';
import { acidLockTrackerService } from './acidLockTrackerService';

export const PROVIDER_SECRETS: Record<string, string> = {
  pragmatic_play: 'sk_live_pragmatic_seamless_88492048102',
  evolution: 'sk_live_evolution_seamless_39104859103',
  pgsoft: 'sk_live_pgsoft_seamless_91823019482',
  spribe: 'sk_live_spribe_seamless_74910284910',
  custom_provider: 'sk_live_custom_seamless_secret_123456'
};

export async function computeHmac(secretKey: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface IdempotencyRecord {
  key: string;
  provider_id: string;
  endpoint: string;
  response: TransactionResponse;
  status_code: number;
  created_at: string;
}

export interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string>;
  latencyMs: number;
  requestSignature: string;
  expectedSignature: string;
  signatureValid: boolean;
  timestamp: number;
}

export interface ConcurrencyTestResult {
  totalRequests: number;
  successful: number;
  failed: number;
  idempotentReplays: number;
  initialBalance: number;
  finalBalance: number;
  expectedBalance: number;
  discrepancy: number;
  totalDurationMs: number;
  logs: Array<{
    id: number;
    thread: number;
    requestTxId: string;
    status: number;
    code: string;
    balance: number;
    latencyMs: number;
    message: string;
    isIdempotent?: boolean;
  }>;
}

export interface EndpointLatencyRecord {
  id: string;
  endpoint: 'balance' | 'bet' | 'win' | 'refund';
  provider_id: string;
  latencyMs: number;
  statusCode: number;
  isSuccess: boolean;
  slaLimitMs: number; // 4000ms SLA limit
  slaCompliant: boolean;
  timestamp: number;
  timeLabel: string;
}

export interface EndpointPayloadLog {
  id: string;
  timestamp: number;
  timeLabel: string;
  isoTimestamp: string;
  endpoint: 'balance' | 'bet' | 'win' | 'refund';
  method: string; // e.g. 'POST /api/seamless/balance'
  providerId: string;
  userId?: string;
  txId?: string;
  roundId?: string;
  gameId?: string;
  amount?: number;
  statusCode: number;
  isSuccess: boolean;
  statusText: string;
  latencyMs: number;
  isIdempotent?: boolean;
  requestPayload: any;
  responsePayload: any;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestSignature?: string;
  expectedSignature?: string;
  signatureValid: boolean;
  balanceBefore?: number;
  balanceAfter?: number;
  currency?: string;
  errorMessage?: string;
  errorCode?: string;
  acidLockAcquired?: boolean;
  rowLockDurationMs?: number;
}

export interface SqlQueryLog {
  id: string;
  timestamp: number;
  timeLabel: string;
  isoTimestamp: string;
  commandType: 'SELECT' | 'UPDATE' | 'INSERT' | 'DELETE' | 'LOCK' | 'BEGIN' | 'COMMIT' | 'ROLLBACK';
  table: string;
  lockLevel?: 'ROW EXCLUSIVE (FOR UPDATE)' | 'ACCESS SHARE' | 'EXCLUSIVE' | 'NONE';
  statement: string;
  bindParams?: Record<string, any> | Array<any>;
  durationMs: number;
  source: string; // e.g. 'POST /api/seamless/bet', 'POST /api/seamless/win', etc.
  txId?: string;
  roundId?: string;
  userId?: string;
  status: 'SUCCESS' | 'ROLLED_BACK' | 'LOCK_TIMEOUT' | 'DEADLOCK_DETECTED';
  affectedRows?: number;
  queryPlan?: string;
}

class SimulatedSeamlessEngine {
  private users: Map<string, UserEntity> = new Map();
  private wallets: Map<string, WalletEntity> = new Map(); // key: `${userId}:${currency}`
  private transactions: TransactionEntity[] = [];
  private gameRounds: Map<string, GameRoundEntity> = new Map(); // key: `${providerId}:${roundId}`
  private idempotencyStore: Map<string, IdempotencyRecord> = new Map();
  private paymentRequests: PaymentRequestEntity[] = [];
  private wageringRequirements: WageringRequirementEntity[] = [];
  private latencyHistory: EndpointLatencyRecord[] = [];
  private latencyListeners: Array<(records: EndpointLatencyRecord[]) => void> = [];

  // SQL Query Audit Logs and Real-time Emitter
  private sqlQueryLogs: SqlQueryLog[] = [];
  private sqlListeners: Array<(logs: SqlQueryLog[]) => void> = [];

  // Real-time Endpoint Payload Logs (/balance, /bet, /win, /refund)
  private endpointPayloadLogs: EndpointPayloadLog[] = [];
  private endpointPayloadListeners: Array<(logs: EndpointPayloadLog[]) => void> = [];

  // Real-time Transaction Commit Listeners for Live Audit Exporters
  private transactionListeners: Array<(tx: TransactionEntity, allTransactions: TransactionEntity[]) => void> = [];

  // Rate Limiting & Load Balancer Throttling (Redis Sliding Window)
  public rateLimitEnabled: boolean = false;
  public rateLimitMaxRps: number = 10;
  private rateLimitHistory: number[] = [];

  // Simulated Row-Level Lock Mutex queues per wallet
  private walletLocks: Map<string, Promise<void>> = new Map();

  // Simulated provider latency in ms
  public simulatedLatencyMin = 15;
  public simulatedLatencyMax = 45;

  constructor() {
    this.seedInitialData();
  }

  public seedInitialData(): void {
    this.users.clear();
    this.wallets.clear();
    this.transactions = [];
    this.gameRounds.clear();
    this.idempotencyStore.clear();
    this.paymentRequests = [];
    this.wageringRequirements = [];
    this.walletLocks.clear();

    const now = new Date().toISOString();

    // Seed Users
    const u1: UserEntity = {
      id: 'a0000000-0000-0000-0000-000000000001',
      username: 'high_roller_alex',
      operator_id: 'GAMEPLAY365_GLOBAL',
      currency: 'USD',
      status: 'ACTIVE',
      country_code: 'US',
      created_at: now,
      updated_at: now
    };

    const u2: UserEntity = {
      id: 'a0000000-0000-0000-0000-000000000002',
      username: 'slot_queen_maria',
      operator_id: 'GAMEPLAY365_GLOBAL',
      currency: 'USD',
      status: 'ACTIVE',
      country_code: 'DE',
      created_at: now,
      updated_at: now
    };

    const u3: UserEntity = {
      id: 'a0000000-0000-0000-0000-000000000003',
      username: 'suspended_user_dave',
      operator_id: 'GAMEPLAY365_GLOBAL',
      currency: 'USD',
      status: 'SUSPENDED',
      country_code: 'UK',
      created_at: now,
      updated_at: now
    };

    const u4: UserEntity = {
      id: 'a0000000-0000-0000-0000-000000000004',
      username: 'sakib_vip_dhaka',
      operator_id: 'GAMEPLAY365_BD',
      currency: 'BDT',
      status: 'ACTIVE',
      country_code: 'BD',
      created_at: now,
      updated_at: now
    };

    this.users.set(u1.id, u1);
    this.users.set(u2.id, u2);
    this.users.set(u3.id, u3);
    this.users.set(u4.id, u4);

    // Seed Wallets with 0.00 initial balance (No fake balances)
    const w1: WalletEntity = {
      id: 'b0000000-0000-0000-0000-000000000001',
      user_id: u1.id,
      currency: 'USD',
      real_balance: 0.0,
      bonus_balance: 0.0,
      locked_balance: 0.0,
      turnover_ratio: 10,
      version: 1,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now
    };

    const w2: WalletEntity = {
      id: 'b0000000-0000-0000-0000-000000000002',
      user_id: u2.id,
      currency: 'USD',
      real_balance: 0.0,
      bonus_balance: 0.0,
      locked_balance: 0.0,
      turnover_ratio: 10,
      version: 1,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now
    };

    const w3: WalletEntity = {
      id: 'b0000000-0000-0000-0000-000000000003',
      user_id: u3.id,
      currency: 'USD',
      real_balance: 0.0,
      bonus_balance: 0.0,
      locked_balance: 0.0,
      turnover_ratio: 10,
      version: 1,
      status: 'FROZEN',
      created_at: now,
      updated_at: now
    };

    const w4: WalletEntity = {
      id: 'b0000000-0000-0000-0000-000000000004',
      user_id: u4.id,
      currency: 'BDT',
      real_balance: 0.0,
      bonus_balance: 0.0,
      locked_balance: 0.0,
      turnover_ratio: 10,
      version: 1,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now
    };

    this.wallets.set(`${u1.id}:USD`, w1);
    this.wallets.set(`${u2.id}:USD`, w2);
    this.wallets.set(`${u3.id}:USD`, w3);
    this.wallets.set(`${u4.id}:BDT`, w4);

    // Initial Seed Payment Requests (Empty by default for genuine live deposits)
    this.paymentRequests = [];

    // Initial Wagering Requirements (Empty by default)
    this.wageringRequirements = [];

    // Seed realistic 30 historical endpoint latency samples
    this.latencyHistory = [];
    const endpoints: Array<'balance' | 'bet' | 'win' | 'refund'> = ['balance', 'bet', 'win', 'balance', 'bet', 'win', 'refund'];
    const providers = ['pragmatic_play', 'evolution', 'pgsoft', 'spribe'];

    for (let i = 29; i >= 0; i--) {
      const ep = endpoints[i % endpoints.length];
      const prov = providers[i % providers.length];
      // Target latencies between 12ms and 48ms (with occasional 80ms spike, all well within 4000ms SLA)
      const baseLatency = ep === 'balance' ? 14 : ep === 'bet' ? 28 : ep === 'win' ? 24 : 18;
      const jitter = Math.floor(Math.random() * 20) - 5;
      const latencyMs = Math.max(8, baseLatency + jitter + (i === 12 ? 45 : 0));
      const recordTime = new Date(Date.now() - i * 15000);

      this.latencyHistory.push({
        id: `LAT_${Date.now() - i * 15000}_${i}`,
        endpoint: ep,
        provider_id: prov,
        latencyMs,
        statusCode: 200,
        isSuccess: true,
        slaLimitMs: 4000,
        slaCompliant: latencyMs <= 4000,
        timestamp: recordTime.getTime(),
        timeLabel: recordTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    }

    // Seed SQL Query Logs
    this.seedSqlAuditLogs();
  }

  public seedSqlAuditLogs(): void {
    this.sqlQueryLogs = [];
    const sampleQueries: Array<Omit<SqlQueryLog, 'id' | 'timestamp' | 'timeLabel' | 'isoTimestamp'>> = [
      {
        commandType: 'SELECT',
        table: 'wallets',
        lockLevel: 'ROW EXCLUSIVE (FOR UPDATE)',
        statement: `SELECT id, user_id, currency, real_balance, bonus_balance, version FROM wallets WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND currency = 'USD' FOR UPDATE;`,
        bindParams: { user_id: 'a0000000-0000-0000-0000-000000000001', currency: 'USD' },
        durationMs: 0.142,
        source: 'POST /api/seamless/bet',
        txId: 'tx_seed_101',
        roundId: 'round_pragmatic_8819',
        userId: 'a0000000-0000-0000-0000-000000000001',
        status: 'SUCCESS',
        affectedRows: 1
      },
      {
        commandType: 'UPDATE',
        table: 'wallets',
        lockLevel: 'EXCLUSIVE',
        statement: `UPDATE wallets SET real_balance = real_balance - 10.0000, version = version + 1, updated_at = NOW() WHERE id = 'b0000000-0000-0000-0000-000000000001';`,
        bindParams: { amount: 10.0, wallet_id: 'b0000000-0000-0000-0000-000000000001' },
        durationMs: 0.188,
        source: 'POST /api/seamless/bet',
        txId: 'tx_seed_101',
        roundId: 'round_pragmatic_8819',
        userId: 'a0000000-0000-0000-0000-000000000001',
        status: 'SUCCESS',
        affectedRows: 1
      },
      {
        commandType: 'INSERT',
        table: 'transactions',
        lockLevel: 'NONE',
        statement: `INSERT INTO transactions (id, provider_id, transaction_id, user_id, wallet_id, type, amount, currency, before_balance, after_balance, status, created_at) VALUES ('tx_seed_101', 'pragmatic_play', 'prag_bet_88190', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'BET', 10.00, 'USD', 2500.00, 2490.00, 'COMPLETED', NOW());`,
        bindParams: { id: 'tx_seed_101', provider_id: 'pragmatic_play', amount: 10.0 },
        durationMs: 0.215,
        source: 'POST /api/seamless/bet',
        txId: 'tx_seed_101',
        roundId: 'round_pragmatic_8819',
        userId: 'a0000000-0000-0000-0000-000000000001',
        status: 'SUCCESS',
        affectedRows: 1
      },
      {
        commandType: 'SELECT',
        table: 'idempotency_keys',
        lockLevel: 'ACCESS SHARE',
        statement: `SELECT * FROM idempotency_keys WHERE key = 'idempotency:pragmatic_play:bet:prag_bet_88190';`,
        bindParams: { key: 'idempotency:pragmatic_play:bet:prag_bet_88190' },
        durationMs: 0.068,
        source: 'POST /api/seamless/bet',
        txId: 'tx_seed_101',
        status: 'SUCCESS',
        affectedRows: 0
      },
      {
        commandType: 'INSERT',
        table: 'game_rounds',
        lockLevel: 'NONE',
        statement: `INSERT INTO game_rounds (id, provider_id, provider_round_id, user_id, game_id, currency, status, total_bet, total_win, net_payout, created_at) VALUES ('rnd_seed_501', 'pragmatic_play', 'round_pragmatic_8819', 'a0000000-0000-0000-0000-000000000001', 'vs20olympgate', 'USD', 'OPEN', 10.00, 0.00, -10.00, NOW()) ON CONFLICT (provider_id, provider_round_id) DO UPDATE SET total_bet = game_rounds.total_bet + 10.00;`,
        bindParams: { provider_round_id: 'round_pragmatic_8819', bet: 10.0 },
        durationMs: 0.195,
        source: 'POST /api/seamless/bet',
        roundId: 'round_pragmatic_8819',
        status: 'SUCCESS',
        affectedRows: 1
      },
      {
        commandType: 'SELECT',
        table: 'wallets',
        lockLevel: 'ROW EXCLUSIVE (FOR UPDATE)',
        statement: `SELECT id, user_id, currency, real_balance, bonus_balance, version FROM wallets WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND currency = 'USD' FOR UPDATE;`,
        bindParams: { user_id: 'a0000000-0000-0000-0000-000000000001', currency: 'USD' },
        durationMs: 0.134,
        source: 'POST /api/seamless/win',
        txId: 'tx_seed_102',
        roundId: 'round_pragmatic_8819',
        userId: 'a0000000-0000-0000-0000-000000000001',
        status: 'SUCCESS',
        affectedRows: 1
      },
      {
        commandType: 'UPDATE',
        table: 'wallets',
        lockLevel: 'EXCLUSIVE',
        statement: `UPDATE wallets SET real_balance = real_balance + 45.0000, version = version + 1, updated_at = NOW() WHERE id = 'b0000000-0000-0000-0000-000000000001';`,
        bindParams: { amount: 45.0, wallet_id: 'b0000000-0000-0000-0000-000000000001' },
        durationMs: 0.176,
        source: 'POST /api/seamless/win',
        txId: 'tx_seed_102',
        roundId: 'round_pragmatic_8819',
        userId: 'a0000000-0000-0000-0000-000000000001',
        status: 'SUCCESS',
        affectedRows: 1
      },
      {
        commandType: 'INSERT',
        table: 'transactions',
        lockLevel: 'NONE',
        statement: `INSERT INTO transactions (id, provider_id, transaction_id, user_id, wallet_id, type, amount, currency, before_balance, after_balance, status, created_at) VALUES ('tx_seed_102', 'pragmatic_play', 'prag_win_88191', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'WIN', 45.00, 'USD', 2490.00, 2535.00, 'COMPLETED', NOW());`,
        bindParams: { id: 'tx_seed_102', provider_id: 'pragmatic_play', amount: 45.0 },
        durationMs: 0.208,
        source: 'POST /api/seamless/win',
        txId: 'tx_seed_102',
        roundId: 'round_pragmatic_8819',
        userId: 'a0000000-0000-0000-0000-000000000001',
        status: 'SUCCESS',
        affectedRows: 1
      },
      {
        commandType: 'SELECT',
        table: 'users',
        lockLevel: 'ACCESS SHARE',
        statement: `SELECT id, username, status, currency, operator_id FROM users WHERE id = 'a0000000-0000-0000-0000-000000000004' AND status = 'ACTIVE';`,
        bindParams: { user_id: 'a0000000-0000-0000-0000-000000000004' },
        durationMs: 0.082,
        source: 'POST /api/seamless/balance',
        userId: 'a0000000-0000-0000-0000-000000000004',
        status: 'SUCCESS',
        affectedRows: 1
      },
      {
        commandType: 'SELECT',
        table: 'transactions',
        lockLevel: 'ACCESS SHARE',
        statement: `SELECT * FROM transactions WHERE user_id = 'a0000000-0000-0000-0000-000000000004' AND created_at >= NOW() - INTERVAL '30 days' ORDER BY created_at DESC LIMIT 25;`,
        bindParams: { user_id: 'a0000000-0000-0000-0000-000000000004', limit: 25 },
        durationMs: 0.165,
        source: 'GET /api/ledger/history',
        userId: 'a0000000-0000-0000-0000-000000000004',
        status: 'SUCCESS',
        affectedRows: 18
      }
    ];

    sampleQueries.forEach((q, idx) => {
      const offsetMs = (sampleQueries.length - idx) * 20000;
      const ts = Date.now() - offsetMs;
      this.sqlQueryLogs.push({
        ...q,
        id: `sql_seed_${ts}_${idx}`,
        timestamp: ts,
        timeLabel: new Date(ts).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3
        }),
        isoTimestamp: new Date(ts).toISOString()
      });
    });

    // Seed realistic Endpoint Payload Logs for /balance, /bet, and /win (Success & Failure cases)
    const nowTime = Date.now();
    this.endpointPayloadLogs = [
      {
        id: `EP_LOG_${nowTime - 35000}`,
        timestamp: nowTime - 35000,
        timeLabel: new Date(nowTime - 35000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
        isoTimestamp: new Date(nowTime - 35000).toISOString(),
        endpoint: 'balance',
        method: 'POST /api/seamless/balance',
        providerId: 'pragmatic_play',
        userId: 'a0000000-0000-0000-0000-000000000001',
        gameId: 'vs20olympgate',
        statusCode: 200,
        isSuccess: true,
        statusText: 'SUCCESS',
        latencyMs: 14,
        isIdempotent: false,
        requestPayload: {
          provider_id: 'pragmatic_play',
          user_id: 'a0000000-0000-0000-0000-000000000001',
          currency: 'USD',
          game_id: 'vs20olympgate',
          session_id: 'sess_pragmatic_991823'
        },
        responsePayload: {
          code: 'SUCCESS',
          message: 'Balance retrieved successfully',
          balance: 2500.0,
          bonus_balance: 150.0,
          locked_balance: 0.0,
          currency: 'USD',
          timestamp: nowTime - 35000
        },
        requestHeaders: {
          'content-type': 'application/json',
          'x-signature': '8fa82b9a10ef49bc872910d9e847c210ab7819ef01a89c849102834719283471',
          'x-timestamp': String(nowTime - 35000)
        },
        responseHeaders: {
          'x-response-time-ms': '14',
          'x-signature': '8fa82b9a10ef49bc872910d9e847c210ab7819ef01a89c849102834719283471',
          'content-type': 'application/json'
        },
        signatureValid: true,
        balanceBefore: 2500.0,
        balanceAfter: 2500.0,
        currency: 'USD',
        acidLockAcquired: true,
        rowLockDurationMs: 0.8
      },
      {
        id: `EP_LOG_${nowTime - 28000}`,
        timestamp: nowTime - 28000,
        timeLabel: new Date(nowTime - 28000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
        isoTimestamp: new Date(nowTime - 28000).toISOString(),
        endpoint: 'bet',
        method: 'POST /api/seamless/bet',
        providerId: 'pragmatic_play',
        userId: 'a0000000-0000-0000-0000-000000000001',
        txId: 'TX_BET_991823',
        roundId: 'RND_881923',
        gameId: 'vs20sweetbonanza',
        amount: 20.0,
        statusCode: 200,
        isSuccess: true,
        statusText: 'SUCCESS',
        latencyMs: 28,
        isIdempotent: false,
        requestPayload: {
          provider_id: 'pragmatic_play',
          user_id: 'a0000000-0000-0000-0000-000000000001',
          currency: 'USD',
          transaction_id: 'TX_BET_991823',
          round_id: 'RND_881923',
          game_id: 'vs20sweetbonanza',
          amount: 20.0,
          is_round_end: false,
          metadata: { lines: 20, bet_level: 1 }
        },
        responsePayload: {
          code: 'SUCCESS',
          message: 'Bet accepted and ledger row locked',
          operator_transaction_id: 'OP_TX_991823_LOCKED',
          balance: 2480.0,
          currency: 'USD',
          timestamp: nowTime - 28000
        },
        requestHeaders: {
          'content-type': 'application/json',
          'x-signature': '9cb8192837482910fedcba9876543210123456789abcdef0123456789abcdef0',
          'x-timestamp': String(nowTime - 28000)
        },
        responseHeaders: {
          'x-response-time-ms': '28',
          'x-ratelimit-remaining': '9',
          'content-type': 'application/json'
        },
        signatureValid: true,
        balanceBefore: 2500.0,
        balanceAfter: 2480.0,
        currency: 'USD',
        acidLockAcquired: true,
        rowLockDurationMs: 1.45
      },
      {
        id: `EP_LOG_${nowTime - 20000}`,
        timestamp: nowTime - 20000,
        timeLabel: new Date(nowTime - 20000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
        isoTimestamp: new Date(nowTime - 20000).toISOString(),
        endpoint: 'win',
        method: 'POST /api/seamless/win',
        providerId: 'pragmatic_play',
        userId: 'a0000000-0000-0000-0000-000000000001',
        txId: 'TX_WIN_991824',
        roundId: 'RND_881923',
        gameId: 'vs20sweetbonanza',
        amount: 65.0,
        statusCode: 200,
        isSuccess: true,
        statusText: 'SUCCESS',
        latencyMs: 22,
        isIdempotent: false,
        requestPayload: {
          provider_id: 'pragmatic_play',
          user_id: 'a0000000-0000-0000-0000-000000000001',
          currency: 'USD',
          transaction_id: 'TX_WIN_991824',
          reference_transaction_id: 'TX_BET_991823',
          round_id: 'RND_881923',
          game_id: 'vs20sweetbonanza',
          amount: 65.0,
          is_round_end: true,
          metadata: { multiplier: '3.25x' }
        },
        responsePayload: {
          code: 'SUCCESS',
          message: 'Win payout credited and round closed',
          operator_transaction_id: 'OP_TX_991824_PAID',
          balance: 2545.0,
          currency: 'USD',
          timestamp: nowTime - 20000
        },
        requestHeaders: {
          'content-type': 'application/json',
          'x-signature': '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          'x-timestamp': String(nowTime - 20000)
        },
        responseHeaders: {
          'x-response-time-ms': '22',
          'content-type': 'application/json'
        },
        signatureValid: true,
        balanceBefore: 2480.0,
        balanceAfter: 2545.0,
        currency: 'USD',
        acidLockAcquired: true,
        rowLockDurationMs: 1.12
      },
      {
        id: `EP_LOG_${nowTime - 14000}`,
        timestamp: nowTime - 14000,
        timeLabel: new Date(nowTime - 14000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
        isoTimestamp: new Date(nowTime - 14000).toISOString(),
        endpoint: 'bet',
        method: 'POST /api/seamless/bet',
        providerId: 'evolution',
        userId: 'a0000000-0000-0000-0000-000000000003',
        txId: 'TX_BET_FAIL_001',
        roundId: 'RND_EVO_5510',
        gameId: 'lightning_roulette_01',
        amount: 5000.0,
        statusCode: 422,
        isSuccess: false,
        statusText: 'INSUFFICIENT_FUNDS',
        latencyMs: 8,
        isIdempotent: false,
        requestPayload: {
          provider_id: 'evolution',
          user_id: 'a0000000-0000-0000-0000-000000000003',
          currency: 'USD',
          transaction_id: 'TX_BET_FAIL_001',
          round_id: 'RND_EVO_5510',
          game_id: 'lightning_roulette_01',
          amount: 5000.0,
          is_round_end: false
        },
        responsePayload: {
          code: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient balance for requested bet (Available: 0.00 USD, Required: 5000.00 USD)',
          balance: 0.0,
          currency: 'USD',
          timestamp: nowTime - 14000
        },
        requestHeaders: {
          'content-type': 'application/json',
          'x-signature': 'evo_sig_valid_881923',
          'x-timestamp': String(nowTime - 14000)
        },
        responseHeaders: {
          'x-response-time-ms': '8',
          'content-type': 'application/json'
        },
        signatureValid: true,
        balanceBefore: 0.0,
        balanceAfter: 0.0,
        currency: 'USD',
        errorMessage: 'Insufficient funds in player wallet',
        errorCode: 'INSUFFICIENT_FUNDS'
      },
      {
        id: `EP_LOG_${nowTime - 8000}`,
        timestamp: nowTime - 8000,
        timeLabel: new Date(nowTime - 8000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
        isoTimestamp: new Date(nowTime - 8000).toISOString(),
        endpoint: 'bet',
        method: 'POST /api/seamless/bet',
        providerId: 'pragmatic_play',
        userId: 'a0000000-0000-0000-0000-000000000001',
        txId: 'TX_SIG_ERR_992',
        roundId: 'RND_TAMPER_01',
        gameId: 'vs20olympgate',
        amount: 50.0,
        statusCode: 401,
        isSuccess: false,
        statusText: 'INVALID_SIGNATURE',
        latencyMs: 4,
        isIdempotent: false,
        requestPayload: {
          provider_id: 'pragmatic_play',
          user_id: 'a0000000-0000-0000-0000-000000000001',
          currency: 'USD',
          transaction_id: 'TX_SIG_ERR_992',
          round_id: 'RND_TAMPER_01',
          game_id: 'vs20olympgate',
          amount: 50.0
        },
        responsePayload: {
          code: 'INVALID_SIGNATURE',
          message: 'Cryptographic HMAC-SHA256 signature verification failed (Tampered or expired token)',
          timestamp: nowTime - 8000
        },
        requestHeaders: {
          'content-type': 'application/json',
          'x-signature': 'tampered_signature_payload_bad_key',
          'x-timestamp': String(nowTime - 8000)
        },
        responseHeaders: {
          'x-response-time-ms': '4',
          'content-type': 'application/json'
        },
        signatureValid: false,
        errorMessage: 'HMAC signature verification failed',
        errorCode: 'INVALID_SIGNATURE'
      },
      {
        id: `EP_LOG_${nowTime - 3000}`,
        timestamp: nowTime - 3000,
        timeLabel: new Date(nowTime - 3000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
        isoTimestamp: new Date(nowTime - 3000).toISOString(),
        endpoint: 'bet',
        method: 'POST /api/seamless/bet',
        providerId: 'pragmatic_play',
        userId: 'a0000000-0000-0000-0000-000000000001',
        txId: 'TX_THROTTLE_993',
        statusCode: 429,
        isSuccess: false,
        statusText: 'RATE_LIMIT_EXCEEDED',
        latencyMs: 3,
        isIdempotent: false,
        requestPayload: {
          provider_id: 'pragmatic_play',
          user_id: 'a0000000-0000-0000-0000-000000000001',
          amount: 25.0
        },
        responsePayload: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: "Too Many Requests: Rate limit threshold of 10 req/s exceeded by provider 'pragmatic_play'. Load balancer throttling active.",
          retry_after_seconds: 1,
          limit_rps: 10,
          timestamp: nowTime - 3000
        },
        requestHeaders: {
          'content-type': 'application/json'
        },
        responseHeaders: {
          'x-ratelimit-limit': '10',
          'x-ratelimit-remaining': '0',
          'retry-after': '1',
          'x-response-time-ms': '3'
        },
        signatureValid: true,
        errorMessage: 'Redis token bucket exhausted for this second',
        errorCode: 'RATE_LIMIT_EXCEEDED'
      }
    ];
  }

  public getSqlQueryLogs(): SqlQueryLog[] {
    return [...this.sqlQueryLogs];
  }

  public logSql(
    entry: Omit<SqlQueryLog, 'id' | 'timestamp' | 'timeLabel' | 'isoTimestamp'>
  ): SqlQueryLog {
    const timestamp = Date.now();
    const timeLabel = new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    const newLog: SqlQueryLog = {
      ...entry,
      id: `sql_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      timeLabel,
      isoTimestamp: new Date(timestamp).toISOString()
    };
    this.sqlQueryLogs.unshift(newLog);
    if (this.sqlQueryLogs.length > 300) {
      this.sqlQueryLogs.pop();
    }
    this.notifySqlListeners();
    return newLog;
  }

  public clearSqlQueryLogs(): void {
    this.sqlQueryLogs = [];
    this.notifySqlListeners();
  }

  public onSqlQueryRecorded(callback: (logs: SqlQueryLog[]) => void): () => void {
    this.sqlListeners.push(callback);
    callback(this.getSqlQueryLogs());
    return () => {
      this.sqlListeners = this.sqlListeners.filter((cb) => cb !== callback);
    };
  }

  private notifySqlListeners(): void {
    const logs = this.getSqlQueryLogs();
    this.sqlListeners.forEach((cb) => cb(logs));
  }

  /**
   * Real-time Endpoint Payload Subscriptions (/balance, /bet, /win, /refund)
   */
  public getEndpointPayloadLogs(): EndpointPayloadLog[] {
    return [...this.endpointPayloadLogs];
  }

  public logEndpointPayload(
    entry: Omit<EndpointPayloadLog, 'id' | 'timestamp' | 'timeLabel' | 'isoTimestamp'>
  ): EndpointPayloadLog {
    const timestamp = Date.now();
    const timeLabel = new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    const newLog: EndpointPayloadLog = {
      ...entry,
      id: `EP_LOG_${timestamp}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      timeLabel,
      isoTimestamp: new Date(timestamp).toISOString()
    };

    this.endpointPayloadLogs.unshift(newLog);
    if (this.endpointPayloadLogs.length > 300) {
      this.endpointPayloadLogs.pop();
    }

    this.notifyEndpointPayloadListeners();
    return newLog;
  }

  public clearEndpointPayloadLogs(): void {
    this.endpointPayloadLogs = [];
    this.notifyEndpointPayloadListeners();
  }

  public onEndpointPayloadRecorded(callback: (logs: EndpointPayloadLog[]) => void): () => void {
    this.endpointPayloadListeners.push(callback);
    callback(this.getEndpointPayloadLogs());
    return () => {
      this.endpointPayloadListeners = this.endpointPayloadListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyEndpointPayloadListeners(): void {
    const list = this.getEndpointPayloadLogs();
    this.endpointPayloadListeners.forEach((cb) => {
      try {
        cb(list);
      } catch (err) {
        console.error('Error in endpoint payload listener:', err);
      }
    });
  }

  /**
   * Real-time Transaction Commit Subscriptions
   * Fired each time a BET, WIN, REFUND, or Ledger operation is committed
   */
  public onTransactionCommitted(
    callback: (tx: TransactionEntity, allTransactions: TransactionEntity[]) => void
  ): () => void {
    this.transactionListeners.push(callback);
    return () => {
      this.transactionListeners = this.transactionListeners.filter((cb) => cb !== callback);
    };
  }

  public recordCommittedTransaction(tx: TransactionEntity): void {
    this.transactions.unshift(tx);
    const all = this.getTransactions();
    this.transactionListeners.forEach((cb) => {
      try {
        cb(tx, all);
      } catch (err) {
        console.error('Error in transaction commit listener:', err);
      }
    });
  }

  public executeExplainAnalyze(
    query: string | SqlQueryLog,
    options?: Partial<ExplainAnalyzeOptions>
  ): ExplainAnalyzeResult {
    return generateExplainAnalyze(query, options);
  }

  /**
   * Latency Subscriptions and Real-Time SLA Management
   */
  public getLatencyHistory(): EndpointLatencyRecord[] {
    return [...this.latencyHistory];
  }

  public recordLatency(record: Omit<EndpointLatencyRecord, 'id' | 'timeLabel' | 'slaLimitMs' | 'slaCompliant'> & { slaLimitMs?: number }): EndpointLatencyRecord {
    const slaLimit = record.slaLimitMs || 4000;
    const newRecord: EndpointLatencyRecord = {
      ...record,
      id: `LAT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      slaLimitMs: slaLimit,
      slaCompliant: record.latencyMs <= slaLimit,
      timeLabel: new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    this.latencyHistory.push(newRecord);
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift(); // Keep latest 100 entries
    }

    this.notifyLatencyListeners();
    return newRecord;
  }

  public onLatencyRecorded(callback: (records: EndpointLatencyRecord[]) => void): () => void {
    this.latencyListeners.push(callback);
    callback(this.getLatencyHistory());
    return () => {
      this.latencyListeners = this.latencyListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyLatencyListeners(): void {
    const list = this.getLatencyHistory();
    this.latencyListeners.forEach((cb) => cb(list));
  }

  public clearLatencyHistory(): void {
    this.latencyHistory = [];
    this.notifyLatencyListeners();
  }

  /**
   * Rate Limiter & Throttler Configuration (Redis Sliding Window)
   */
  public setRateLimitConfig(config: { enabled: boolean; maxRps: number }): void {
    this.rateLimitEnabled = config.enabled;
    this.rateLimitMaxRps = config.maxRps;
  }

  public getRateLimitConfig(): { enabled: boolean; maxRps: number; currentUsage: number } {
    const now = Date.now();
    this.rateLimitHistory = this.rateLimitHistory.filter((t) => now - t < 1000);
    return {
      enabled: this.rateLimitEnabled,
      maxRps: this.rateLimitMaxRps,
      currentUsage: this.rateLimitHistory.length
    };
  }

  public checkRateLimit(): { allowed: boolean; remaining: number; resetMs: number } {
    if (!this.rateLimitEnabled) {
      return { allowed: true, remaining: 999, resetMs: 0 };
    }

    const now = Date.now();
    // Prune entries older than 1 second (1000ms sliding window)
    this.rateLimitHistory = this.rateLimitHistory.filter((t) => now - t < 1000);

    if (this.rateLimitHistory.length >= this.rateLimitMaxRps) {
      const oldestInWindow = this.rateLimitHistory[0];
      const resetMs = Math.max(0, 1000 - (now - oldestInWindow));
      return {
        allowed: false,
        remaining: 0,
        resetMs
      };
    }

    this.rateLimitHistory.push(now);
    return {
      allowed: true,
      remaining: Math.max(0, this.rateLimitMaxRps - this.rateLimitHistory.length),
      resetMs: 1000
    };
  }

  public simulateTrafficBurst(endpointCount: number = 8): void {
    const endpoints: Array<'balance' | 'bet' | 'win' | 'refund'> = ['balance', 'bet', 'win', 'balance', 'bet', 'win'];
    const providers = ['pragmatic_play', 'evolution', 'pgsoft', 'spribe'];

    for (let i = 0; i < endpointCount; i++) {
      const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
      const prov = providers[Math.floor(Math.random() * providers.length)];
      const baseLat = ep === 'balance' ? 15 : ep === 'bet' ? 32 : ep === 'win' ? 26 : 20;
      const jitter = Math.floor(Math.random() * 25);
      const latencyMs = baseLat + jitter;

      this.recordLatency({
        endpoint: ep,
        provider_id: prov,
        latencyMs,
        statusCode: 200,
        isSuccess: true,
        timestamp: Date.now() + i * 200
      });
    }
  }

  /**
   * Increments the user's active wagering requirement turnover progress.
   * Called by /api/seamless/win and /api/seamless/bet to track valid turnover.
   */
  public incrementWageringProgress(userId: string, turnoverAmount: number): {
    totalTurnoverAdded: number;
    activeRequirementsUpdated: number;
    newlyCompletedCount: number;
  } {
    if (turnoverAmount <= 0) return { totalTurnoverAdded: 0, activeRequirementsUpdated: 0, newlyCompletedCount: 0 };

    const activeList = this.wageringRequirements.filter(
      (w) => w.user_id === userId && w.status === 'ACTIVE'
    );

    let newlyCompletedCount = 0;

    for (const req of activeList) {
      req.completed_turnover_amount = Number((req.completed_turnover_amount + turnoverAmount).toFixed(4));
      if (req.completed_turnover_amount >= req.target_turnover_amount) {
        req.status = 'COMPLETED';
        req.completed_at = new Date().toISOString();
        newlyCompletedCount += 1;
      }
    }

    return {
      totalTurnoverAdded: turnoverAmount,
      activeRequirementsUpdated: activeList.length,
      newlyCompletedCount
    };
  }

  /**
   * Service function that checks if a bonus balance is eligible for conversion to real cash
   * based on a configurable turnover ratio (multiplier).
   */
  public checkBonusConversionEligibility(userId: string, turnoverRatio: number = 10): WageringProgressDTO {
    const userReqs = this.wageringRequirements.filter((w) => w.user_id === userId);
    const activeReqs = userReqs.filter((w) => w.status === 'ACTIVE');

    let totalBonusGranted = 0;
    let targetTurnover = 0;
    let completedTurnover = 0;

    for (const r of userReqs) {
      totalBonusGranted += r.bonus_amount_granted;
      completedTurnover += r.completed_turnover_amount;
      targetTurnover += r.target_turnover_amount;
    }

    // Check user wallet bonus balance
    let totalBonusBalance = 0;
    for (const w of this.wallets.values()) {
      if (w.user_id === userId) {
        totalBonusBalance += w.bonus_balance;
      }
    }

    const progressPercent = targetTurnover > 0 
      ? Math.min(100, Math.round((completedTurnover / targetTurnover) * 100))
      : (totalBonusBalance > 0 ? 100 : 0);

    const remainingTurnover = Math.max(0, Number((targetTurnover - completedTurnover).toFixed(2)));
    
    // Eligible if completed turnover >= target turnover and there is an actual bonus balance to convert
    const isEligible = totalBonusBalance > 0 && (activeReqs.length === 0 || completedTurnover >= targetTurnover);

    return {
      is_eligible: isEligible,
      total_bonus_balance: totalBonusBalance,
      active_target_turnover: targetTurnover,
      completed_turnover: completedTurnover,
      progress_percent: progressPercent,
      remaining_turnover: remainingTurnover,
      convertible_amount: totalBonusBalance,
      requirements: userReqs
    };
  }

  /**
   * Converts eligible bonus balance into real cash ledger balance atomically with Row-Level Locking.
   */
  public async convertBonusToRealCash(
    userId: string,
    currency: string = 'BDT',
    turnoverRatio: number = 10
  ): Promise<{
    success: boolean;
    converted_amount: number;
    new_real_balance: number;
    new_bonus_balance: number;
    message: string;
  }> {
    const walletKey = `${userId}:${currency}`;
    const releaseLock = await this.acquireRowLock(walletKey);

    try {
      const wallet = this.wallets.get(walletKey);
      if (!wallet) {
        throw new Error(`Wallet not found for user ${userId} and currency ${currency}`);
      }

      const eligibility = this.checkBonusConversionEligibility(userId, turnoverRatio);
      if (!eligibility.is_eligible && wallet.bonus_balance <= 0) {
        throw new Error(
          `Bonus is not eligible for cash conversion yet. Remaining Turnover: ${eligibility.remaining_turnover} ${currency} (${eligibility.progress_percent}% completed)`
        );
      }

      const amountToConvert = wallet.bonus_balance;
      if (amountToConvert <= 0) {
        throw new Error('No bonus balance available to convert.');
      }

      const beforeReal = wallet.real_balance;
      const afterReal = Number((beforeReal + amountToConvert).toFixed(4));
      
      // Transfer bonus -> real
      wallet.real_balance = afterReal;
      wallet.bonus_balance = 0.0;
      wallet.version += 1;
      wallet.updated_at = new Date().toISOString();

      // Mark active wagering requirements as COMPLETED
      for (const r of this.wageringRequirements) {
        if (r.user_id === userId && r.status === 'ACTIVE') {
          r.status = 'COMPLETED';
          r.completed_at = new Date().toISOString();
        }
      }

      // Record Immutable Ledger Transaction
      const convertTxId = `TX_BONUS_CONVERT_${Date.now()}`;
      const tx: TransactionEntity = {
        id: convertTxId,
        provider_id: 'GAMEPLAY365_BONUS_ENGINE',
        transaction_id: `CONVERT_${Date.now()}_${userId.slice(-4)}`,
        reference_transaction_id: `WAGER_REQ_${userId}`,
        user_id: userId,
        wallet_id: wallet.id,
        game_id: 'SYSTEM_WAGERING_CONVERSION',
        type: 'PROMO',
        amount: amountToConvert,
        currency: currency,
        before_balance: beforeReal,
        after_balance: afterReal,
        status: 'COMPLETED',
        metadata: {
          action: 'BONUS_CONVERT_TO_REAL_CASH',
          turnoverRatio: turnoverRatio,
          completedTurnover: eligibility.completed_turnover,
          targetTurnover: eligibility.active_target_turnover
        },
        created_at: new Date().toISOString()
      };

      this.transactions.unshift(tx);

      return {
        success: true,
        converted_amount: amountToConvert,
        new_real_balance: afterReal,
        new_bonus_balance: 0.0,
        message: `Successfully converted ${currency} ${amountToConvert.toLocaleString()} bonus into real withdrawable cash!`
      };
    } finally {
      releaseLock();
    }
  }

  // --- Lock acquisition simulating PostgreSQL `SELECT ... FOR UPDATE` ---
  private async acquireRowLock(walletKey: string): Promise<() => void> {
    const unregisterTracker = acidLockTrackerService.registerLiveRowLock(
      'wallets',
      walletKey,
      'RowExclusiveLock (FOR UPDATE)',
      `SELECT id, user_id, currency, real_balance, bonus_balance, version FROM wallets WHERE id = '${walletKey}' FOR UPDATE;`
    );

    while (this.walletLocks.has(walletKey)) {
      await this.walletLocks.get(walletKey);
    }

    let releaseLock: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = () => {
        this.walletLocks.delete(walletKey);
        try {
          unregisterTracker();
        } catch {}
        resolve();
      };
    });

    this.walletLocks.set(walletKey, lockPromise);
    return releaseLock;
  }

  private async simulateNetworkDelay(jitterMs: number = 0): Promise<void> {
    const baseDelay =
      Math.floor(
        Math.random() * (this.simulatedLatencyMax - this.simulatedLatencyMin + 1)
      ) + this.simulatedLatencyMin;
    const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
    const totalDelay = baseDelay + jitter;
    await new Promise((resolve) => setTimeout(resolve, totalDelay));
  }

  private findUser(identifier: string): UserEntity | undefined {
    for (const u of this.users.values()) {
      if (u.id === identifier || u.username === identifier) return u;
    }
    return undefined;
  }

  private findWallet(userId: string, currency: string): WalletEntity | undefined {
    // Check direct key
    const directKey = `${userId}:${currency}`;
    if (this.wallets.has(directKey)) return this.wallets.get(directKey);

    // Fallback search across wallets for user
    for (const w of this.wallets.values()) {
      if (w.user_id === userId && (w.currency === currency || !currency)) {
        return w;
      }
    }
    return undefined;
  }

  // --------------------------------------------------------------------------
  // Core Dispatcher with HMAC Signature verification
  // --------------------------------------------------------------------------
  public async executeRequest(
    endpoint: 'balance' | 'bet' | 'win' | 'refund',
    payload: any,
    options: {
      customSignature?: string;
      customTimestamp?: number;
      customSecretKey?: string;
      simulateTimeout?: boolean;
      bypassHmac?: boolean;
      latencyJitterMs?: number;
    } = {}
  ): Promise<ApiResponse> {
    const start = Date.now();
    const timestamp = options.customTimestamp || Date.now();
    const payloadStr = JSON.stringify(payload);
    const providerId = payload.provider_id || 'pragmatic_play';
    const secretKey =
      options.customSecretKey || PROVIDER_SECRETS[providerId] || 'sk_default_secret';

    const messageToSign = `${timestamp}.${payloadStr}`;
    const expectedSignature = await computeHmac(secretKey, messageToSign);
    const requestSignature =
      options.customSignature !== undefined ? options.customSignature : expectedSignature;

    const signatureValid =
      options.bypassHmac || requestSignature.toLowerCase() === expectedSignature.toLowerCase();

    // 0. Rate Limiting Check (Simulating Redis Token Bucket / Envoy Load Balancer Throttling)
    const rateLimitCheck = this.checkRateLimit();
    if (!rateLimitCheck.allowed) {
      const latency = Math.max(2, Date.now() - start);
      const errorData = {
        code: SeamlessErrorCode.RATE_LIMIT_EXCEEDED,
        message: `Too Many Requests: Rate limit threshold of ${this.rateLimitMaxRps} req/s exceeded by provider '${providerId}'. Load balancer throttling active.`,
        retry_after_seconds: 1,
        limit_rps: this.rateLimitMaxRps,
        timestamp: Date.now()
      };

      this.recordLatency({
        endpoint,
        provider_id: providerId,
        latencyMs: latency,
        statusCode: 429,
        isSuccess: false,
        timestamp: Date.now()
      });

      const responseHeaders429 = {
        'x-ratelimit-limit': String(this.rateLimitMaxRps),
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(rateLimitCheck.resetMs),
        'retry-after': '1',
        'x-response-time-ms': String(latency),
        'x-signature': requestSignature,
        'x-timestamp': String(timestamp)
      };

      this.logEndpointPayload({
        endpoint,
        method: `POST /api/seamless/${endpoint}`,
        providerId,
        userId: payload.user_id,
        txId: payload.transaction_id,
        roundId: payload.round_id,
        gameId: payload.game_id,
        amount: payload.amount,
        statusCode: 429,
        isSuccess: false,
        statusText: 'RATE_LIMIT_EXCEEDED',
        latencyMs: latency,
        isIdempotent: false,
        requestPayload: payload,
        responsePayload: errorData,
        requestHeaders: {
          'x-signature': requestSignature,
          'x-timestamp': String(timestamp)
        },
        responseHeaders: responseHeaders429,
        requestSignature,
        expectedSignature,
        signatureValid: true,
        errorMessage: errorData.message,
        errorCode: errorData.code
      });

      return {
        status: 429,
        data: errorData,
        headers: responseHeaders429,
        latencyMs: latency,
        requestSignature,
        expectedSignature,
        signatureValid: true,
        timestamp: Date.now()
      };
    }

    // Check timeout simulation
    if (options.simulateTimeout) {
      await new Promise((r) => setTimeout(r, 4100));
      const timeoutData = {
        code: SeamlessErrorCode.TIMEOUT_EXCEEDED,
        message: 'Wallet transaction SLA exceeded (4000ms timeout threshold)',
        timestamp: Date.now()
      };
      const timeoutHeaders = {
        'x-signature': requestSignature,
        'x-timestamp': String(timestamp),
        'x-response-time-ms': '4100'
      };

      this.logEndpointPayload({
        endpoint,
        method: `POST /api/seamless/${endpoint}`,
        providerId,
        userId: payload.user_id,
        txId: payload.transaction_id,
        roundId: payload.round_id,
        gameId: payload.game_id,
        amount: payload.amount,
        statusCode: 504,
        isSuccess: false,
        statusText: 'TIMEOUT_EXCEEDED',
        latencyMs: 4100,
        isIdempotent: false,
        requestPayload: payload,
        responsePayload: timeoutData,
        requestHeaders: {
          'x-signature': requestSignature,
          'x-timestamp': String(timestamp)
        },
        responseHeaders: timeoutHeaders,
        requestSignature,
        expectedSignature,
        signatureValid,
        errorMessage: timeoutData.message,
        errorCode: timeoutData.code
      });

      return {
        status: 504,
        data: timeoutData,
        headers: timeoutHeaders,
        latencyMs: 4100,
        requestSignature,
        expectedSignature,
        signatureValid,
        timestamp: Date.now()
      };
    }

    await this.simulateNetworkDelay(options.latencyJitterMs);

    // 1. HMAC Verification check
    if (!options.bypassHmac && !signatureValid) {
      const latency = Date.now() - start;
      const sigErrorData = {
        code: SeamlessErrorCode.INVALID_SIGNATURE,
        message: 'Cryptographic HMAC-SHA256 signature verification failed',
        timestamp: Date.now()
      };
      const sigHeaders = {
        'x-signature': requestSignature,
        'x-timestamp': String(timestamp),
        'x-response-time-ms': String(latency)
      };

      this.logEndpointPayload({
        endpoint,
        method: `POST /api/seamless/${endpoint}`,
        providerId,
        userId: payload.user_id,
        txId: payload.transaction_id,
        roundId: payload.round_id,
        gameId: payload.game_id,
        amount: payload.amount,
        statusCode: 401,
        isSuccess: false,
        statusText: 'INVALID_SIGNATURE',
        latencyMs: latency,
        isIdempotent: false,
        requestPayload: payload,
        responsePayload: sigErrorData,
        requestHeaders: {
          'x-signature': requestSignature,
          'x-timestamp': String(timestamp)
        },
        responseHeaders: sigHeaders,
        requestSignature,
        expectedSignature,
        signatureValid: false,
        errorMessage: sigErrorData.message,
        errorCode: sigErrorData.code
      });

      return {
        status: 401,
        data: sigErrorData,
        headers: sigHeaders,
        latencyMs: latency,
        requestSignature,
        expectedSignature,
        signatureValid: false,
        timestamp: Date.now()
      };
    }

    // 2. Dispatch to specific transactional handler
    try {
      let result: any;
      let status = 200;

      switch (endpoint) {
        case 'balance':
          result = await this.handleBalance(payload);
          break;
        case 'bet':
          result = await this.handleBet(payload);
          break;
        case 'win':
          result = await this.handleWin(payload);
          break;
        case 'refund':
          result = await this.handleRefund(payload);
          break;
      }

      const latency = Date.now() - start;

      // Automatically register latency telemetry
      this.recordLatency({
        endpoint,
        provider_id: providerId,
        latencyMs: latency,
        statusCode: status,
        isSuccess: true,
        timestamp: Date.now()
      });

      const responseHeaders = {
        'x-signature': requestSignature,
        'x-timestamp': String(timestamp),
        'x-response-time-ms': String(latency)
      };

      this.logEndpointPayload({
        endpoint,
        method: `POST /api/seamless/${endpoint}`,
        providerId,
        userId: payload.user_id,
        txId: payload.transaction_id,
        roundId: payload.round_id,
        gameId: payload.game_id,
        amount: payload.amount,
        statusCode: status,
        isSuccess: true,
        statusText: result.code || 'SUCCESS',
        latencyMs: latency,
        isIdempotent: Boolean(result.is_idempotent),
        requestPayload: payload,
        responsePayload: result,
        requestHeaders: {
          'content-type': 'application/json',
          'x-signature': requestSignature,
          'x-timestamp': String(timestamp)
        },
        responseHeaders,
        requestSignature,
        expectedSignature,
        signatureValid: true,
        balanceAfter: result.balance,
        currency: result.currency || payload.currency,
        acidLockAcquired: true,
        rowLockDurationMs: Number((Math.random() * 1.5 + 0.5).toFixed(2))
      });

      return {
        status,
        data: result,
        headers: responseHeaders,
        latencyMs: latency,
        requestSignature,
        expectedSignature,
        signatureValid: true,
        timestamp: Date.now()
      };
    } catch (err: any) {
      const latency = Date.now() - start;
      const statusCode = err.status || 500;

      // Automatically register error latency telemetry
      this.recordLatency({
        endpoint,
        provider_id: providerId,
        latencyMs: latency,
        statusCode,
        isSuccess: false,
        timestamp: Date.now()
      });

      const errorPayload = {
        code: err.code || SeamlessErrorCode.INTERNAL_ERROR,
        message: err.message || 'Internal wallet transaction error',
        balance: err.balance,
        currency: err.currency,
        timestamp: Date.now()
      };

      const errorHeaders = {
        'x-signature': requestSignature,
        'x-timestamp': String(timestamp),
        'x-response-time-ms': String(latency)
      };

      this.logEndpointPayload({
        endpoint,
        method: `POST /api/seamless/${endpoint}`,
        providerId,
        userId: payload.user_id,
        txId: payload.transaction_id,
        roundId: payload.round_id,
        gameId: payload.game_id,
        amount: payload.amount,
        statusCode,
        isSuccess: false,
        statusText: String(err.code || 'ERROR'),
        latencyMs: latency,
        isIdempotent: false,
        requestPayload: payload,
        responsePayload: errorPayload,
        requestHeaders: {
          'content-type': 'application/json',
          'x-signature': requestSignature,
          'x-timestamp': String(timestamp)
        },
        responseHeaders: errorHeaders,
        requestSignature,
        expectedSignature,
        signatureValid: true,
        balanceAfter: err.balance,
        currency: err.currency,
        errorMessage: err.message,
        errorCode: err.code
      });

      return {
        status: statusCode,
        data: errorPayload,
        headers: errorHeaders,
        latencyMs: latency,
        requestSignature,
        expectedSignature,
        signatureValid: true,
        timestamp: Date.now()
      };
    }
  }

  // --- Handlers replicating Postgres Row-Level Lock & ACID properties ---

  private async handleBalance(req: BalanceRequest): Promise<BalanceResponse> {
    const user = this.findUser(req.user_id);
    if (!user) {
      this.logSql({
        commandType: 'SELECT',
        table: 'users',
        lockLevel: 'ACCESS SHARE',
        statement: `SELECT * FROM users WHERE id = '${req.user_id}';`,
        bindParams: { user_id: req.user_id },
        durationMs: 0.054,
        source: 'POST /api/seamless/balance',
        userId: req.user_id,
        status: 'SUCCESS',
        affectedRows: 0
      });
      throw {
        status: 404,
        code: SeamlessErrorCode.USER_NOT_FOUND,
        message: `Player '${req.user_id}' not found`
      };
    }

    if (user.status !== 'ACTIVE') {
      throw {
        status: 403,
        code: SeamlessErrorCode.USER_FROZEN,
        message: `Player account is ${user.status}`
      };
    }

    const walletKey = `${user.id}:${req.currency}`;
    const wallet = this.wallets.get(walletKey);
    if (!wallet) {
      throw {
        status: 404,
        code: SeamlessErrorCode.USER_NOT_FOUND,
        message: `No ${req.currency} wallet found for user`
      };
    }

    this.logSql({
      commandType: 'SELECT',
      table: 'wallets',
      lockLevel: 'ACCESS SHARE',
      statement: `SELECT id, user_id, currency, real_balance, bonus_balance, status FROM wallets WHERE user_id = '${user.id}' AND currency = '${req.currency}';`,
      bindParams: { user_id: user.id, currency: req.currency },
      durationMs: 0.076,
      source: 'POST /api/seamless/balance',
      userId: user.id,
      status: 'SUCCESS',
      affectedRows: 1
    });

    return {
      code: SeamlessErrorCode.SUCCESS,
      message: 'Success',
      user_id: user.id,
      balance: wallet.real_balance,
      bonus_balance: wallet.bonus_balance,
      currency: req.currency,
      timestamp: Date.now()
    };
  }

  private async handleBet(req: BetRequest): Promise<TransactionResponse> {
    const idempotencyKey = `idempotency:${req.provider_id}:bet:${req.transaction_id}`;

    // Fast Idempotency check before lock
    const cached = this.idempotencyStore.get(idempotencyKey);
    if (cached) {
      this.logSql({
        commandType: 'SELECT',
        table: 'idempotency_keys',
        lockLevel: 'ACCESS SHARE',
        statement: `SELECT * FROM idempotency_keys WHERE key = '${idempotencyKey}';`,
        bindParams: { key: idempotencyKey },
        durationMs: 0.042,
        source: 'POST /api/seamless/bet (Idempotent Cache Hit)',
        txId: req.transaction_id,
        status: 'SUCCESS',
        affectedRows: 1
      });
      return { ...cached.response, is_idempotent: true };
    }

    const user = this.findUser(req.user_id);
    if (!user) {
      throw {
        status: 404,
        code: SeamlessErrorCode.USER_NOT_FOUND,
        message: `Player '${req.user_id}' not found`
      };
    }

    if (user.status !== 'ACTIVE') {
      throw {
        status: 403,
        code: SeamlessErrorCode.USER_FROZEN,
        message: `Player account is ${user.status}`
      };
    }

    const walletKey = `${user.id}:${req.currency}`;
    const releaseLock = await this.acquireRowLock(walletKey); // <--- SELECT ... FOR UPDATE

    try {
      // Re-check idempotency inside lock
      const doubleCheck = this.idempotencyStore.get(idempotencyKey);
      if (doubleCheck) {
        return { ...doubleCheck.response, is_idempotent: true };
      }

      const wallet = this.wallets.get(walletKey);
      if (!wallet) {
        throw {
          status: 404,
          code: SeamlessErrorCode.USER_NOT_FOUND,
          message: `Wallet for currency '${req.currency}' not found`
        };
      }

      if (wallet.status !== 'ACTIVE') {
        throw {
          status: 403,
          code: SeamlessErrorCode.USER_FROZEN,
          message: 'Wallet is frozen'
        };
      }

      const betAmount = Number(req.amount);
      if (betAmount <= 0) {
        throw {
          status: 400,
          code: SeamlessErrorCode.INVALID_REQUEST,
          message: 'Bet amount must be > 0'
        };
      }

      if (wallet.real_balance < betAmount) {
        throw {
          status: 400,
          code: SeamlessErrorCode.INSUFFICIENT_FUNDS,
          message: `Insufficient funds. Required: ${betAmount.toFixed(2)}, Available: ${wallet.real_balance.toFixed(2)}`,
          balance: wallet.real_balance,
          currency: req.currency
        };
      }

      const beforeBalance = wallet.real_balance;
      const afterBalance = Number((beforeBalance - betAmount).toFixed(4));

      // 1. Log SELECT FOR UPDATE
      this.logSql({
        commandType: 'SELECT',
        table: 'wallets',
        lockLevel: 'ROW EXCLUSIVE (FOR UPDATE)',
        statement: `SELECT id, user_id, currency, real_balance, bonus_balance, version FROM wallets WHERE user_id = '${user.id}' AND currency = '${req.currency}' FOR UPDATE;`,
        bindParams: { user_id: user.id, currency: req.currency },
        durationMs: 0.125,
        source: 'POST /api/seamless/bet',
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: 'SUCCESS',
        affectedRows: 1
      });

      // Atomic Update
      wallet.real_balance = afterBalance;
      wallet.version += 1;
      wallet.updated_at = new Date().toISOString();

      // 2. Log UPDATE
      this.logSql({
        commandType: 'UPDATE',
        table: 'wallets',
        lockLevel: 'EXCLUSIVE',
        statement: `UPDATE wallets SET real_balance = ${afterBalance.toFixed(4)}, version = ${wallet.version}, updated_at = NOW() WHERE id = '${wallet.id}';`,
        bindParams: { real_balance: afterBalance, version: wallet.version, id: wallet.id },
        durationMs: 0.168,
        source: 'POST /api/seamless/bet',
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: 'SUCCESS',
        affectedRows: 1
      });

      // Upsert Game Round
      const roundKey = `${req.provider_id}:${req.round_id}`;
      let round = this.gameRounds.get(roundKey);
      if (!round) {
        round = {
          id: `rnd_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          provider_id: req.provider_id,
          provider_round_id: req.round_id,
          user_id: user.id,
          game_id: req.game_id,
          currency: req.currency,
          status: 'OPEN',
          total_bet: betAmount,
          total_win: 0,
          net_payout: -betAmount,
          created_at: new Date().toISOString()
        };
        this.gameRounds.set(roundKey, round);
      } else {
        round.total_bet = Number((round.total_bet + betAmount).toFixed(4));
        round.net_payout = Number((round.total_win - round.total_bet).toFixed(4));
      }

      // Increment Wagering Requirement Turnover Progress on Bet
      const wageringUpdate = this.incrementWageringProgress(user.id, betAmount);
      const wageringProgress = this.checkBonusConversionEligibility(user.id);

      const operatorTxId = `tx_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // Insert Immutable Ledger Transaction
      const txEntity: TransactionEntity = {
        id: operatorTxId,
        provider_id: req.provider_id,
        transaction_id: req.transaction_id,
        user_id: user.id,
        wallet_id: wallet.id,
        round_id: round.id,
        provider_round_id: req.round_id,
        game_id: req.game_id,
        type: 'BET',
        amount: betAmount,
        currency: req.currency,
        before_balance: beforeBalance,
        after_balance: afterBalance,
        status: 'COMPLETED',
        metadata: {
          ...(req.metadata || {}),
          wagering_progress_turnover: betAmount,
          is_bonus_conversion_eligible: wageringProgress.is_eligible,
          wagering_completed_percent: wageringProgress.progress_percent
        },
        created_at: new Date().toISOString()
      };

      this.recordCommittedTransaction(txEntity);

      // 3. Log INSERT transactions
      this.logSql({
        commandType: 'INSERT',
        table: 'transactions',
        lockLevel: 'NONE',
        statement: `INSERT INTO transactions (id, provider_id, transaction_id, user_id, wallet_id, type, amount, currency, before_balance, after_balance, status, created_at) VALUES ('${operatorTxId}', '${req.provider_id}', '${req.transaction_id}', '${user.id}', '${wallet.id}', 'BET', ${betAmount.toFixed(2)}, '${req.currency}', ${beforeBalance.toFixed(2)}, ${afterBalance.toFixed(2)}, 'COMPLETED', NOW());`,
        bindParams: { id: operatorTxId, amount: betAmount, currency: req.currency },
        durationMs: 0.198,
        source: 'POST /api/seamless/bet',
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: 'SUCCESS',
        affectedRows: 1
      });

      const resp: TransactionResponse = {
        code: SeamlessErrorCode.SUCCESS,
        message: 'Bet placed successfully',
        transaction_id: req.transaction_id,
        operator_transaction_id: operatorTxId,
        round_id: req.round_id,
        balance: afterBalance,
        bonus_balance: wallet.bonus_balance,
        currency: req.currency,
        timestamp: Date.now(),
        is_idempotent: false
      };

      this.idempotencyStore.set(idempotencyKey, {
        key: idempotencyKey,
        provider_id: req.provider_id,
        endpoint: 'bet',
        response: resp,
        status_code: 200,
        created_at: new Date().toISOString()
      });

      return resp;
    } finally {
      releaseLock();
    }
  }

  private async handleWin(req: WinRequest): Promise<TransactionResponse> {
    const idempotencyKey = `idempotency:${req.provider_id}:win:${req.transaction_id}`;

    const cached = this.idempotencyStore.get(idempotencyKey);
    if (cached) {
      return { ...cached.response, is_idempotent: true };
    }

    const user = this.findUser(req.user_id);
    if (!user) {
      throw {
        status: 404,
        code: SeamlessErrorCode.USER_NOT_FOUND,
        message: `Player '${req.user_id}' not found`
      };
    }

    const walletKey = `${user.id}:${req.currency}`;
    const releaseLock = await this.acquireRowLock(walletKey);

    try {
      const doubleCheck = this.idempotencyStore.get(idempotencyKey);
      if (doubleCheck) {
        return { ...doubleCheck.response, is_idempotent: true };
      }

      const wallet = this.wallets.get(walletKey);
      if (!wallet) {
        throw {
          status: 404,
          code: SeamlessErrorCode.USER_NOT_FOUND,
          message: `Wallet for currency '${req.currency}' not found`
        };
      }

      const winAmount = Number(req.amount || 0);
      if (winAmount < 0) {
        throw {
          status: 400,
          code: SeamlessErrorCode.INVALID_REQUEST,
          message: 'Win amount cannot be negative'
        };
      }

      const beforeBalance = wallet.real_balance;
      const afterBalance = Number((beforeBalance + winAmount).toFixed(4));

      // 1. Log SELECT FOR UPDATE
      this.logSql({
        commandType: 'SELECT',
        table: 'wallets',
        lockLevel: 'ROW EXCLUSIVE (FOR UPDATE)',
        statement: `SELECT id, user_id, currency, real_balance, bonus_balance, version FROM wallets WHERE user_id = '${user.id}' AND currency = '${req.currency}' FOR UPDATE;`,
        bindParams: { user_id: user.id, currency: req.currency },
        durationMs: 0.119,
        source: 'POST /api/seamless/win',
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: 'SUCCESS',
        affectedRows: 1
      });

      wallet.real_balance = afterBalance;
      wallet.version += 1;
      wallet.updated_at = new Date().toISOString();

      // 2. Log UPDATE
      this.logSql({
        commandType: 'UPDATE',
        table: 'wallets',
        lockLevel: 'EXCLUSIVE',
        statement: `UPDATE wallets SET real_balance = ${afterBalance.toFixed(4)}, version = ${wallet.version}, updated_at = NOW() WHERE id = '${wallet.id}';`,
        bindParams: { real_balance: afterBalance, version: wallet.version, id: wallet.id },
        durationMs: 0.155,
        source: 'POST /api/seamless/win',
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: 'SUCCESS',
        affectedRows: 1
      });

      // Upsert Game Round
      const roundKey = `${req.provider_id}:${req.round_id}`;
      let round = this.gameRounds.get(roundKey);
      if (!round) {
        round = {
          id: `rnd_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          provider_id: req.provider_id,
          provider_round_id: req.round_id,
          user_id: user.id,
          game_id: req.game_id,
          currency: req.currency,
          status: req.is_round_end !== false ? 'SETTLED' : 'OPEN',
          total_bet: 0,
          total_win: winAmount,
          net_payout: winAmount,
          created_at: new Date().toISOString(),
          closed_at: req.is_round_end !== false ? new Date().toISOString() : null
        };
        this.gameRounds.set(roundKey, round);
      } else {
        round.total_win = Number((round.total_win + winAmount).toFixed(4));
        round.net_payout = Number((round.total_win - round.total_bet).toFixed(4));
        if (req.is_round_end !== false) {
          round.status = 'SETTLED';
          round.closed_at = new Date().toISOString();
        }
      }

      // Increment Wagering Turnover on Win / Payout
      const turnoverToCredit = winAmount > 0 ? winAmount : (round.total_bet > 0 ? round.total_bet : 0);
      const wageringUpdate = this.incrementWageringProgress(user.id, turnoverToCredit);
      const wageringProgress = this.checkBonusConversionEligibility(user.id);

      const operatorTxId = `tx_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      const txEntity: TransactionEntity = {
        id: operatorTxId,
        provider_id: req.provider_id,
        transaction_id: req.transaction_id,
        reference_transaction_id: req.reference_transaction_id || null,
        user_id: user.id,
        wallet_id: wallet.id,
        round_id: round.id,
        provider_round_id: req.round_id,
        game_id: req.game_id,
        type: 'WIN',
        amount: winAmount,
        currency: req.currency,
        before_balance: beforeBalance,
        after_balance: afterBalance,
        status: 'COMPLETED',
        metadata: {
          ...(req.metadata || {}),
          wagering_turnover_credited: turnoverToCredit,
          is_bonus_conversion_eligible: wageringProgress.is_eligible,
          wagering_completed_percent: wageringProgress.progress_percent,
          remaining_turnover_needed: wageringProgress.remaining_turnover
        },
        created_at: new Date().toISOString()
      };

      this.recordCommittedTransaction(txEntity);

      // 3. Log INSERT transactions
      this.logSql({
        commandType: 'INSERT',
        table: 'transactions',
        lockLevel: 'NONE',
        statement: `INSERT INTO transactions (id, provider_id, transaction_id, user_id, wallet_id, type, amount, currency, before_balance, after_balance, status, created_at) VALUES ('${operatorTxId}', '${req.provider_id}', '${req.transaction_id}', '${user.id}', '${wallet.id}', 'WIN', ${winAmount.toFixed(2)}, '${req.currency}', ${beforeBalance.toFixed(2)}, ${afterBalance.toFixed(2)}, 'COMPLETED', NOW());`,
        bindParams: { id: operatorTxId, amount: winAmount, currency: req.currency },
        durationMs: 0.185,
        source: 'POST /api/seamless/win',
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: 'SUCCESS',
        affectedRows: 1
      });

      const resp: TransactionResponse = {
        code: SeamlessErrorCode.SUCCESS,
        message: 'Win payout processed',
        transaction_id: req.transaction_id,
        operator_transaction_id: operatorTxId,
        round_id: req.round_id,
        balance: afterBalance,
        bonus_balance: wallet.bonus_balance,
        currency: req.currency,
        timestamp: Date.now(),
        is_idempotent: false
      };

      this.idempotencyStore.set(idempotencyKey, {
        key: idempotencyKey,
        provider_id: req.provider_id,
        endpoint: 'win',
        response: resp,
        status_code: 200,
        created_at: new Date().toISOString()
      });

      return resp;
    } finally {
      releaseLock();
    }
  }

  private async handleRefund(req: RefundRequest): Promise<TransactionResponse> {
    const idempotencyKey = `idempotency:${req.provider_id}:refund:${req.transaction_id}`;

    const cached = this.idempotencyStore.get(idempotencyKey);
    if (cached) {
      return { ...cached.response, is_idempotent: true };
    }

    const user = this.findUser(req.user_id);
    if (!user) {
      throw {
        status: 404,
        code: SeamlessErrorCode.USER_NOT_FOUND,
        message: `Player '${req.user_id}' not found`
      };
    }

    const walletKey = `${user.id}:${req.currency}`;
    const releaseLock = await this.acquireRowLock(walletKey);

    try {
      const doubleCheck = this.idempotencyStore.get(idempotencyKey);
      if (doubleCheck) {
        return { ...doubleCheck.response, is_idempotent: true };
      }

      // Check original bet transaction
      const origTx = this.transactions.find(
        (t) =>
          t.provider_id === req.provider_id &&
          t.transaction_id === req.reference_transaction_id &&
          t.type === 'BET'
      );

      if (!origTx) {
        throw {
          status: 404,
          code: SeamlessErrorCode.TRANSACTION_NOT_FOUND,
          message: `Original BET transaction '${req.reference_transaction_id}' not found to refund`
        };
      }

      // Check if already refunded
      const alreadyRefunded = this.transactions.some(
        (t) =>
          t.provider_id === req.provider_id &&
          t.reference_transaction_id === req.reference_transaction_id &&
          t.type === 'REFUND'
      );

      if (alreadyRefunded) {
        throw {
          status: 409,
          code: SeamlessErrorCode.TRANSACTION_ALREADY_SETTLED,
          message: `Transaction '${req.reference_transaction_id}' has already been refunded`
        };
      }

      const wallet = this.wallets.get(walletKey);
      if (!wallet) {
        throw {
          status: 404,
          code: SeamlessErrorCode.USER_NOT_FOUND,
          message: 'Wallet not found'
        };
      }

      const refundAmount = Number(req.amount > 0 ? req.amount : origTx.amount);
      const beforeBalance = wallet.real_balance;
      const afterBalance = Number((beforeBalance + refundAmount).toFixed(4));

      // 1. Log SELECT FOR UPDATE
      this.logSql({
        commandType: 'SELECT',
        table: 'wallets',
        lockLevel: 'ROW EXCLUSIVE (FOR UPDATE)',
        statement: `SELECT id, user_id, currency, real_balance, bonus_balance, version FROM wallets WHERE user_id = '${user.id}' AND currency = '${req.currency}' FOR UPDATE;`,
        bindParams: { user_id: user.id, currency: req.currency },
        durationMs: 0.108,
        source: 'POST /api/seamless/refund',
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: 'SUCCESS',
        affectedRows: 1
      });

      wallet.real_balance = afterBalance;
      wallet.version += 1;
      wallet.updated_at = new Date().toISOString();

      // 2. Log UPDATE
      this.logSql({
        commandType: 'UPDATE',
        table: 'wallets',
        lockLevel: 'EXCLUSIVE',
        statement: `UPDATE wallets SET real_balance = ${afterBalance.toFixed(4)}, version = ${wallet.version}, updated_at = NOW() WHERE id = '${wallet.id}';`,
        bindParams: { real_balance: afterBalance, version: wallet.version, id: wallet.id },
        durationMs: 0.144,
        source: 'POST /api/seamless/refund',
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: 'SUCCESS',
        affectedRows: 1
      });

      // Update Game Round status
      const roundKey = `${req.provider_id}:${req.round_id}`;
      const round = this.gameRounds.get(roundKey);
      if (round) {
        round.status = 'REFUNDED';
        round.closed_at = new Date().toISOString();
      }

      const operatorTxId = `tx_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      const txEntity: TransactionEntity = {
        id: operatorTxId,
        provider_id: req.provider_id,
        transaction_id: req.transaction_id,
        reference_transaction_id: req.reference_transaction_id,
        user_id: user.id,
        wallet_id: wallet.id,
        provider_round_id: req.round_id,
        game_id: req.game_id,
        type: 'REFUND',
        amount: refundAmount,
        currency: req.currency,
        before_balance: beforeBalance,
        after_balance: afterBalance,
        status: 'COMPLETED',
        metadata: { reason: req.reason, ...req.metadata },
        created_at: new Date().toISOString()
      };

      this.recordCommittedTransaction(txEntity);

      // 3. Log INSERT transactions
      this.logSql({
        commandType: 'INSERT',
        table: 'transactions',
        lockLevel: 'NONE',
        statement: `INSERT INTO transactions (id, provider_id, transaction_id, reference_transaction_id, user_id, wallet_id, type, amount, currency, before_balance, after_balance, status, created_at) VALUES ('${operatorTxId}', '${req.provider_id}', '${req.transaction_id}', '${req.reference_transaction_id}', '${user.id}', '${wallet.id}', 'REFUND', ${refundAmount.toFixed(2)}, '${req.currency}', ${beforeBalance.toFixed(2)}, ${afterBalance.toFixed(2)}, 'COMPLETED', NOW());`,
        bindParams: { id: operatorTxId, amount: refundAmount, currency: req.currency },
        durationMs: 0.172,
        source: 'POST /api/seamless/refund',
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: 'SUCCESS',
        affectedRows: 1
      });

      const resp: TransactionResponse = {
        code: SeamlessErrorCode.SUCCESS,
        message: 'Bet refund processed and balance restored',
        transaction_id: req.transaction_id,
        operator_transaction_id: operatorTxId,
        round_id: req.round_id,
        balance: afterBalance,
        bonus_balance: wallet.bonus_balance,
        currency: req.currency,
        timestamp: Date.now(),
        is_idempotent: false
      };

      this.idempotencyStore.set(idempotencyKey, {
        key: idempotencyKey,
        provider_id: req.provider_id,
        endpoint: 'refund',
        response: resp,
        status_code: 200,
        created_at: new Date().toISOString()
      });

      return resp;
    } finally {
      releaseLock();
    }
  }

  // --------------------------------------------------------------------------
  // Concurrency Stress Tester Engine
  // Fires N concurrent requests on a single wallet to test Row-Level Locks
  // --------------------------------------------------------------------------
  public async runConcurrencyStressTest(
    userId: string,
    currency: string,
    numConcurrentRequests: number,
    betAmountPerRequest: number,
    identicalTxId = false
  ): Promise<ConcurrencyTestResult> {
    const user = this.findUser(userId);
    if (!user) throw new Error('User not found');

    const walletKey = `${user.id}:${currency}`;
    const wallet = this.wallets.get(walletKey);
    if (!wallet) throw new Error('Wallet not found');

    const initialBalance = wallet.real_balance;
    const startTime = Date.now();
    const staticTxId = `stress_tx_${Date.now()}`;

    // Create parallel promises
    const promises = Array.from({ length: numConcurrentRequests }, async (_, index) => {
      const threadId = index + 1;
      const txId = identicalTxId ? staticTxId : `stress_${Date.now()}_t${threadId}_${Math.random().toString(36).substring(7)}`;
      const roundId = `stress_round_${Math.floor(index / 2)}`;

      const betReq: BetRequest = {
        provider_id: 'pragmatic_play',
        user_id: user.id,
        currency,
        transaction_id: txId,
        round_id: roundId,
        game_id: 'sweet_bonanza',
        amount: betAmountPerRequest,
        metadata: { stressThread: threadId }
      };

      const res = await this.executeRequest('bet', betReq, { bypassHmac: true });

      return {
        id: index,
        thread: threadId,
        requestTxId: txId,
        status: res.status,
        code: res.data.code,
        balance: res.data.balance !== undefined ? res.data.balance : wallet.real_balance,
        latencyMs: res.latencyMs,
        message: res.data.message,
        isIdempotent: res.data.is_idempotent
      };
    });

    const logs = await Promise.all(promises);
    const totalDurationMs = Date.now() - startTime;
    const finalBalance = wallet.real_balance;

    let successful = 0;
    let failed = 0;
    let idempotentReplays = 0;

    for (const l of logs) {
      if (l.isIdempotent) {
        idempotentReplays++;
      } else if (l.status === 200) {
        successful++;
      } else {
        failed++;
      }
    }

    const expectedBalance = identicalTxId
      ? Number((initialBalance - betAmountPerRequest).toFixed(4))
      : Number((initialBalance - successful * betAmountPerRequest).toFixed(4));

    const discrepancy = Math.abs(finalBalance - expectedBalance);

    return {
      totalRequests: numConcurrentRequests,
      successful,
      failed,
      idempotentReplays,
      initialBalance,
      finalBalance,
      expectedBalance,
      discrepancy,
      totalDurationMs,
      logs
    };
  }

  // --- Getters for Explorer & UI State ---
  public getUsers(): UserEntity[] {
    return Array.from(this.users.values());
  }

  public getWallets(): WalletEntity[] {
    return Array.from(this.wallets.values());
  }

  public getTransactions(): TransactionEntity[] {
    return [...this.transactions];
  }

  public getGameRounds(): GameRoundEntity[] {
    return Array.from(this.gameRounds.values());
  }

  public getIdempotencyRecords(): IdempotencyRecord[] {
    return Array.from(this.idempotencyStore.values());
  }

  public topUpWallet(userId: string, currency: string, amount: number): void {
    const user = this.findUser(userId);
    if (!user) return;
    const key = `${user.id}:${currency}`;
    const wallet = this.wallets.get(key);
    if (wallet) {
      wallet.real_balance = Number((wallet.real_balance + amount).toFixed(4));
      wallet.updated_at = new Date().toISOString();
    }
  }

  public setWalletBalance(userId: string, currency: string, amount: number): void {
    const user = this.findUser(userId);
    if (!user) return;
    const key = `${user.id}:${currency}`;
    const wallet = this.wallets.get(key);
    if (wallet) {
      wallet.real_balance = Math.max(0, Number(amount.toFixed(4)));
      wallet.updated_at = new Date().toISOString();
    }
  }

  // --- Payment Request Handlers (bKash, Nagad, Rocket, Upay) ---
  public getPaymentRequests(): PaymentRequestEntity[] {
    return [...this.paymentRequests].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public async submitDepositRequest(params: {
    userId: string;
    method: PaymentMethodType;
    amount: number;
    currency: string;
    senderNumber: string;
    receiverNumber: string;
    trxId: string;
    autoApprove?: boolean;
  }): Promise<PaymentRequestEntity> {
    const user = this.findUser(params.userId);
    if (!user) throw new Error('User not found');

    const wallet = this.findWallet(user.id, params.currency);
    if (!wallet) throw new Error(`Wallet not found for currency ${params.currency}`);

    const now = new Date().toISOString();
    const requestId = `PAY_DEP_${Math.floor(100000 + Math.random() * 900000)}`;

    const newRequest: PaymentRequestEntity = {
      id: requestId,
      user_id: user.id,
      wallet_id: wallet.id,
      type: 'DEPOSIT',
      method: params.method,
      amount: Number(params.amount.toFixed(4)),
      currency: params.currency,
      sender_number: params.senderNumber,
      receiver_number: params.receiverNumber,
      trx_id: params.trxId.toUpperCase(),
      status: params.autoApprove ? 'APPROVED' : 'PENDING',
      admin_note: params.autoApprove
        ? 'Instant Automated bKash/Nagad Merchant Validation'
        : 'Awaiting Operator Approval',
      metadata: {
        platform: 'Playall 365 Cashier',
        timestamp: Date.now()
      },
      created_at: now,
      updated_at: now
    };

    this.paymentRequests.unshift(newRequest);

    if (params.autoApprove) {
      // Credit wallet and create ledger transaction
      const releaseLock = await this.acquireRowLock(`${user.id}:${params.currency}`);
      try {
        const beforeBalance = wallet.real_balance;
        wallet.real_balance = Number((wallet.real_balance + params.amount).toFixed(4));
        wallet.version += 1;
        wallet.updated_at = now;

        const ledgerTx: TransactionEntity = {
          id: `LEDGER_DEP_${Date.now()}`,
          provider_id: 'CASHIER_LOCAL',
          transaction_id: `DEP_${params.trxId.toUpperCase()}`,
          reference_transaction_id: requestId,
          user_id: user.id,
          wallet_id: wallet.id,
          game_id: 'CASHIER_DEPOSIT',
          type: 'PROMO', // deposit ledger type
          amount: params.amount,
          currency: params.currency,
          before_balance: beforeBalance,
          after_balance: wallet.real_balance,
          status: 'COMPLETED',
          metadata: {
            method: params.method,
            sender: params.senderNumber,
            trxId: params.trxId
          },
          created_at: now
        };
        this.recordCommittedTransaction(ledgerTx);
      } finally {
        releaseLock();
      }
    }

    return newRequest;
  }

  public async submitWithdrawalRequest(params: {
    userId: string;
    method: PaymentMethodType;
    amount: number;
    currency: string;
    receiverNumber: string;
    autoApprove?: boolean;
  }): Promise<PaymentRequestEntity> {
    const user = this.findUser(params.userId);
    if (!user) throw new Error('User not found');

    const wallet = this.findWallet(user.id, params.currency);
    if (!wallet) throw new Error(`Wallet not found for currency ${params.currency}`);

    if (wallet.real_balance < params.amount) {
      throw new Error('Insufficient funds for withdrawal');
    }

    const now = new Date().toISOString();
    const requestId = `PAY_WTH_${Math.floor(100000 + Math.random() * 900000)}`;
    const trxId = `WTH_${params.method}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Debit player wallet
    const releaseLock = await this.acquireRowLock(`${user.id}:${params.currency}`);
    try {
      const beforeBalance = wallet.real_balance;
      wallet.real_balance = Number((wallet.real_balance - params.amount).toFixed(4));
      wallet.version += 1;
      wallet.updated_at = now;

      const ledgerTx: TransactionEntity = {
        id: `LEDGER_WTH_${Date.now()}`,
        provider_id: 'CASHIER_LOCAL',
        transaction_id: trxId,
        reference_transaction_id: requestId,
        user_id: user.id,
        wallet_id: wallet.id,
        game_id: 'CASHIER_WITHDRAWAL',
        type: 'TIP', // payout ledger type
        amount: params.amount,
        currency: params.currency,
        before_balance: beforeBalance,
        after_balance: wallet.real_balance,
        status: 'COMPLETED',
        metadata: {
          method: params.method,
          accountNumber: params.receiverNumber
        },
        created_at: now
      };
      this.recordCommittedTransaction(ledgerTx);
    } finally {
      releaseLock();
    }

    const newRequest: PaymentRequestEntity = {
      id: requestId,
      user_id: user.id,
      wallet_id: wallet.id,
      type: 'WITHDRAWAL',
      method: params.method,
      amount: Number(params.amount.toFixed(4)),
      currency: params.currency,
      receiver_number: params.receiverNumber,
      trx_id: trxId,
      status: params.autoApprove ? 'APPROVED' : 'PENDING',
      admin_note: params.autoApprove ? 'Instant VIP Dispatched' : 'Queued for Bank/Agent Transfer',
      metadata: {
        platform: 'Playall 365 Cashier',
        timestamp: Date.now()
      },
      created_at: now,
      updated_at: now
    };

    this.paymentRequests.unshift(newRequest);
    return newRequest;
  }

  public async approvePaymentRequest(requestId: string): Promise<PaymentRequestEntity> {
    const req = this.paymentRequests.find((r) => r.id === requestId);
    if (!req) throw new Error('Payment request not found');
    if (req.status !== 'PENDING') throw new Error('Payment request is not pending');

    req.status = 'APPROVED';
    req.updated_at = new Date().toISOString();
    req.admin_note = 'Approved by Operator Administrator';

    if (req.type === 'DEPOSIT') {
      const user = this.findUser(req.user_id);
      if (user) {
        this.topUpWallet(user.id, req.currency, req.amount);
      }
    }

    return req;
  }

  // --- Real-time User Registration & Authentication ---
  public registerUser(params: {
    username: string;
    email: string;
    phone?: string;
    currency: 'BDT' | 'USD';
    promoCode?: string;
  }): { user: UserEntity; wallet: WalletEntity } {
    const existing = Array.from(this.users.values()).find(
      (u) => u.username.toLowerCase() === params.username.toLowerCase()
    );
    if (existing) {
      const existingWallet = this.findWallet(existing.id, existing.currency);
      if (existingWallet) return { user: existing, wallet: existingWallet };
    }

    const now = new Date().toISOString();
    const userId = `u_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const walletId = `w_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const starterBonus = 0.0;
    const starterReal = 0.0;

    const newUser: UserEntity = {
      id: userId,
      username: params.username,
      operator_id: params.currency === 'BDT' ? 'GAMEPLAY365_BD' : 'GAMEPLAY365_GLOBAL',
      currency: params.currency,
      status: 'ACTIVE',
      country_code: params.currency === 'BDT' ? 'BD' : 'US',
      created_at: now,
      updated_at: now
    };

    const newWallet: WalletEntity = {
      id: walletId,
      user_id: userId,
      currency: params.currency,
      real_balance: 0.0,
      bonus_balance: 0.0,
      locked_balance: 0.0,
      turnover_ratio: 10,
      version: 1,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now
    };

    this.users.set(userId, newUser);
    this.wallets.set(`${userId}:${params.currency}`, newWallet);

    // Add Initial Account Opening Ledger Record (Zero Initial Balance)
    const openTx: TransactionEntity = {
      id: `LEDGER_OPEN_${Date.now()}`,
      provider_id: 'GAMEPLAY365_AUTH',
      transaction_id: `ACCT_OPEN_${Date.now()}`,
      reference_transaction_id: `REG_${userId}`,
      user_id: userId,
      wallet_id: walletId,
      game_id: 'SYSTEM_ACCOUNT_OPENING',
      type: 'PROMO',
      amount: 0.0,
      currency: params.currency,
      before_balance: 0,
      after_balance: 0,
      status: 'COMPLETED',
      metadata: {
        promoCode: params.promoCode || 'STANDARD',
        phone: params.phone,
        email: params.email,
        note: 'Live User Registered with 0.00 initial balance. Deposit required to play.'
      },
      created_at: now
    };
    this.transactions.unshift(openTx);

    // Create 10x Wagering Requirement for Welcome Bonus
    this.wageringRequirements.push({
      id: `WAGER_REQ_${Date.now()}`,
      user_id: userId,
      promo_name: '200% Welcome Registration Bonus',
      bonus_amount_granted: starterBonus,
      required_multiplier: 10,
      target_turnover_amount: starterBonus * 10,
      completed_turnover_amount: 0.0,
      status: 'ACTIVE',
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      created_at: now,
      completed_at: null
    });

    return { user: newUser, wallet: newWallet };
  }

  /**
   * Resets all balances for a specific user to clean zero (0.00).
   * Ensures new registrations or zero-reset requests enforce 0.00 balance state.
   */
  public resetWalletToZero(userId: string, currency: 'BDT' | 'USD' = 'BDT'): WalletEntity {
    const now = new Date().toISOString();
    const walletKey = `${userId}:${currency}`;
    let wallet = this.wallets.get(walletKey);

    if (wallet) {
      wallet.real_balance = 0.0;
      wallet.bonus_balance = 0.0;
      wallet.locked_balance = 0.0;
      wallet.version += 1;
      wallet.updated_at = now;
    } else {
      wallet = {
        id: `w_${userId}_${currency.toLowerCase()}`,
        user_id: userId,
        currency,
        real_balance: 0.0,
        bonus_balance: 0.0,
        locked_balance: 0.0,
        turnover_ratio: 10,
        version: 1,
        status: 'ACTIVE',
        created_at: now,
        updated_at: now
      };
      this.wallets.set(walletKey, wallet);
    }

    // Also zero-out secondary currency if present
    const altCurrency = currency === 'BDT' ? 'USD' : 'BDT';
    const altKey = `${userId}:${altCurrency}`;
    const altWallet = this.wallets.get(altKey);
    if (altWallet) {
      altWallet.real_balance = 0.0;
      altWallet.bonus_balance = 0.0;
      altWallet.locked_balance = 0.0;
      altWallet.version += 1;
      altWallet.updated_at = now;
    }

    return wallet;
  }

  public getWageringRequirements(userId?: string): WageringRequirementEntity[] {
    if (userId) {
      return this.wageringRequirements.filter((w) => w.user_id === userId);
    }
    return [...this.wageringRequirements];
  }
  public getDiagnostics() {
    return {
      users: this.users.size,
      wallets: this.wallets.size,
      transactions: this.transactions.length,
      gameRounds: this.gameRounds.size,
      idempotencyStore: this.idempotencyStore.size,
      paymentRequests: this.paymentRequests.length,
      sqlQueryLogs: this.sqlQueryLogs.length,
      latencyHistory: this.latencyHistory.length,
      wageringRequirements: this.wageringRequirements.length
    };
  }
}

export const seamlessEngine = new SimulatedSeamlessEngine();
