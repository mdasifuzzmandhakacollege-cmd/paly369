import React, { useState, useEffect, useMemo } from 'react';
import {
  Send,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Key,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Sliders,
  Sparkles,
  ArrowRight,
  Code2,
  Download,
  Terminal,
  FileCode,
  Layers,
  FileSpreadsheet,
  Zap,
  RotateCcw,
  CheckCheck,
  Cpu,
  Activity,
  Gauge,
  Flame,
  SlidersHorizontal,
  Timer,
  Wifi,
  Filter,
  Trash2,
  ListFilter,
  ExternalLink,
  Info
} from 'lucide-react';
import { seamlessEngine, ApiResponse, PROVIDER_SECRETS, computeHmac } from '../services/simulatedWalletEngine';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { EndpointPayloadLogViewer } from './EndpointPayloadLogViewer';

interface ProviderSimulatorProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  onLedgerMutated: () => void;
}

type Endpoint = 'balance' | 'bet' | 'win' | 'refund';

export interface SimulatorLogEntry {
  id: string;
  timestamp: number;
  timeLabel: string;
  method: string;
  endpoint: Endpoint;
  providerId: string;
  txId?: string;
  statusCode: number;
  statusText: string;
  latencyMs: number;
  isIdempotent?: boolean;
  rateLimitExceeded?: boolean;
  tokensUsed?: number;
  maxRps?: number;
  response: ApiResponse;
  requestPayload: any;
}

interface IdempotencyStressResult {
  txId: string;
  endpoint: Endpoint;
  req1: ApiResponse;
  req2: ApiResponse;
  burstCount?: number;
  burstSuccessCount?: number;
  timestamp: number;
  passed: boolean;
  notes: string[];
}

// Syntax Highlighted JSON Code Component with Line Numbers & Token Coloring
const JsonSyntaxHighlighter: React.FC<{ data: any; isMinified?: boolean }> = ({ data, isMinified = false }) => {
  const jsonString = useMemo(() => {
    return isMinified ? JSON.stringify(data) : JSON.stringify(data, null, 2);
  }, [data, isMinified]);

  if (isMinified) {
    return (
      <div className="font-mono text-xs p-3 bg-slate-950 rounded-xl border border-slate-800 text-emerald-300 break-all select-all">
        {jsonString}
      </div>
    );
  }

  const lines = jsonString.split('\n');

  // Tokenize each line into colored spans
  const renderTokens = (line: string) => {
    const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      const matchStart = match.index;
      const matchText = match[0];

      // Leading whitespace, braces, commas, brackets
      if (matchStart > lastIndex) {
        elements.push(
          <span key={`punct-${lastIndex}`} className="text-slate-400">
            {line.substring(lastIndex, matchStart)}
          </span>
        );
      }

      // Determine syntax token style
      let tokenClass = 'text-emerald-300';
      if (/^"/.test(matchText)) {
        if (/:$/.test(matchText)) {
          // JSON Property Key
          tokenClass = 'text-cyan-300 font-bold';
        } else {
          // String Value
          tokenClass = 'text-amber-300';
        }
      } else if (/^(true|false)$/.test(matchText)) {
        // Boolean
        tokenClass = 'text-purple-400 font-bold';
      } else if (/^null$/.test(matchText)) {
        // Null
        tokenClass = 'text-rose-400 italic';
      } else if (/^-?\d+/.test(matchText)) {
        // Number
        tokenClass = 'text-emerald-400 font-semibold';
      }

      elements.push(
        <span key={`token-${matchStart}`} className={tokenClass}>
          {matchText}
        </span>
      );

      lastIndex = matchStart + matchText.length;
    }

    if (lastIndex < line.length) {
      elements.push(
        <span key={`tail-${lastIndex}`} className="text-slate-400">
          {line.substring(lastIndex)}
        </span>
      );
    }

    return elements;
  };

  return (
    <div className="font-mono text-xs bg-slate-950 rounded-xl border border-slate-800 p-3 overflow-x-auto max-h-[380px] shadow-inner select-text">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
              <td className="w-8 pr-3 text-right select-none text-slate-600 text-[10px] font-mono border-r border-slate-800/80">
                {idx + 1}
              </td>
              <td className="pl-3 whitespace-pre font-mono leading-relaxed">
                {renderTokens(line)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface ProviderPreset {
  id: string;
  name: string;
  defaultGameId: string;
  defaultBet: number;
  defaultWin: number;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'pragmatic_play',
    name: 'Pragmatic Play (Sweet Bonanza)',
    defaultGameId: 'vs20sweetbonanza',
    defaultBet: 20.0,
    defaultWin: 55.0
  },
  {
    id: 'evolution',
    name: 'Evolution Gaming (Lightning Roulette)',
    defaultGameId: 'lightning_roulette_01',
    defaultBet: 50.0,
    defaultWin: 150.0
  },
  {
    id: 'pgsoft',
    name: 'PG Soft (Fortune Tiger)',
    defaultGameId: 'fortune_tiger_88',
    defaultBet: 10.0,
    defaultWin: 30.0
  },
  {
    id: 'spribe',
    name: 'Spribe Turbo (Aviator Crash)',
    defaultGameId: 'aviator_crash',
    defaultBet: 25.0,
    defaultWin: 85.0
  }
];

export const ProviderSimulator: React.FC<ProviderSimulatorProps> = ({
  currentUser,
  currentWallet,
  onLedgerMutated
}) => {
  const [providerId, setProviderId] = useState<string>('pragmatic_play');
  const [endpoint, setEndpoint] = useState<Endpoint>('bet');
  const [secretKey, setSecretKey] = useState<string>(
    PROVIDER_SECRETS['pragmatic_play'] || 'sk_live_pragmatic_seamless_88492048102'
  );

  // Form Fields
  const [amount, setAmount] = useState<number>(20);
  const [gameId, setGameId] = useState<string>('vs20sweetbonanza');
  const [roundId, setRoundId] = useState<string>(`RND_${Math.floor(100000 + Math.random() * 900000)}`);
  const [transactionId, setTransactionId] = useState<string>(
    `TX_${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [refTxId, setRefTxId] = useState<string>('');
  const [isRoundEnd, setIsRoundEnd] = useState<boolean>(true);
  const [refundReason, setRefundReason] = useState<string>('GAME_CANCELLED_BY_PROVIDER');

  // Fault Injection Flags
  const [tamperSignature, setTamperSignature] = useState<boolean>(false);
  const [simulateReplayAttack, setSimulateReplayAttack] = useState<boolean>(false);
  const [simulateTimeout, setSimulateTimeout] = useState<boolean>(false);
  const [latencyJitterMs, setLatencyJitterMs] = useState<number>(0);

  // Main Simulator View Switcher
  const [simViewMode, setSimViewMode] = useState<'workbench' | 'payload_viewer'>('workbench');

  // Execution & Response State
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [inspectorTab, setInspectorTab] = useState<'body' | 'headers' | 'audit'>('body');
  const [rightPanelTab, setRightPanelTab] = useState<'inspector' | 'payload_viewer' | 'debug_log'>('inspector');
  const [isMinified, setIsMinified] = useState<boolean>(false);

  // Idempotency Stress-Tester State
  const [stressTesting, setStressTesting] = useState<boolean>(false);
  const [stressResult, setStressResult] = useState<IdempotencyStressResult | null>(null);
  const [stressMode, setStressMode] = useState<'dual' | 'burst'>('dual');

  // Request Throttler & Rate Limiter State
  const [rateLimitEnabled, setRateLimitEnabled] = useState<boolean>(true);
  const [rateLimitRps, setRateLimitRps] = useState<number>(10);
  const [currentRpsUsage, setCurrentRpsUsage] = useState<number>(0);
  const [throttlerFloodTesting, setThrottlerFloodTesting] = useState<boolean>(false);
  const [floodCount, setFloodCount] = useState<number>(15);
  const [throttlerResults, setThrottlerResults] = useState<{
    totalSent: number;
    accepted: number;
    throttled: number;
    responses: ApiResponse[];
    timestamp: number;
  } | null>(null);

  // Debug Log State & Filters
  const [debugLogs, setDebugLogs] = useState<SimulatorLogEntry[]>(() => {
    const now = Date.now();
    return [
      {
        id: `LOG_${now - 12000}`,
        timestamp: now - 12000,
        timeLabel: new Date(now - 12000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        method: 'POST /api/seamless/bet',
        endpoint: 'bet',
        providerId: 'pragmatic_play',
        txId: 'TX_SEED_882910',
        statusCode: 200,
        statusText: 'SUCCESS',
        latencyMs: 24,
        isIdempotent: false,
        rateLimitExceeded: false,
        tokensUsed: 1,
        maxRps: 10,
        requestPayload: { provider_id: 'pragmatic_play', user_id: currentUser.id, amount: 20, game_id: 'vs20sweetbonanza' },
        response: {
          status: 200,
          data: { code: 'SUCCESS', message: 'Transaction processed', balance: 2500.0, operator_transaction_id: 'OP_882910' },
          headers: { 'x-ratelimit-limit': '10', 'x-ratelimit-remaining': '9', 'x-signature': 'hmac_valid', 'x-response-time-ms': '24' },
          latencyMs: 24,
          requestSignature: 'valid_sig',
          expectedSignature: 'valid_sig',
          signatureValid: true,
          timestamp: now - 12000
        }
      },
      {
        id: `LOG_${now - 6000}`,
        timestamp: now - 6000,
        timeLabel: new Date(now - 6000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        method: 'POST /api/seamless/bet',
        endpoint: 'bet',
        providerId: 'pragmatic_play',
        txId: 'TX_SEED_882911',
        statusCode: 429,
        statusText: 'RATE_LIMIT_EXCEEDED',
        latencyMs: 3,
        isIdempotent: false,
        rateLimitExceeded: true,
        tokensUsed: 11,
        maxRps: 10,
        requestPayload: { provider_id: 'pragmatic_play', user_id: currentUser.id, amount: 50 },
        response: {
          status: 429,
          data: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: "Too Many Requests: Rate limit threshold of 10 req/s exceeded by provider 'pragmatic_play'. Load balancer throttling active.",
            retry_after_seconds: 1,
            limit_rps: 10,
            timestamp: now - 6000
          },
          headers: {
            'x-ratelimit-limit': '10',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '980',
            'retry-after': '1',
            'x-response-time-ms': '3'
          },
          latencyMs: 3,
          requestSignature: 'valid_sig',
          expectedSignature: 'valid_sig',
          signatureValid: true,
          timestamp: now - 6000
        }
      }
    ];
  });

  const [logFilter, setLogFilter] = useState<'all' | '429' | '200' | 'errors'>('all');

  // Push entry to debug log
  const pushDebugLog = (
    ep: Endpoint,
    reqPayload: any,
    res: ApiResponse,
    opts?: { isIdemp?: boolean; maxRpsVal?: number; currentTokens?: number }
  ) => {
    const now = Date.now();
    const is429 = res.status === 429;
    const logItem: SimulatorLogEntry = {
      id: `LOG_${now}_${Math.floor(100 + Math.random() * 900)}`,
      timestamp: now,
      timeLabel: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      method: `POST /api/seamless/${ep}`,
      endpoint: ep,
      providerId: reqPayload.provider_id || providerId,
      txId: reqPayload.transaction_id,
      statusCode: res.status,
      statusText: res.data?.code || (res.status === 200 ? 'SUCCESS' : is429 ? 'RATE_LIMIT_EXCEEDED' : `HTTP_${res.status}`),
      latencyMs: res.latencyMs,
      isIdempotent: opts?.isIdemp || res.data?.is_idempotent || false,
      rateLimitExceeded: is429,
      tokensUsed: opts?.currentTokens,
      maxRps: opts?.maxRpsVal || rateLimitRps,
      response: res,
      requestPayload: reqPayload
    };

    setDebugLogs((prev) => [logItem, ...prev.slice(0, 49)]); // Keep latest 50 logs
  };

  // Sync Rate Limiter Config with engine
  useEffect(() => {
    seamlessEngine.setRateLimitConfig({
      enabled: rateLimitEnabled,
      maxRps: rateLimitRps
    });
  }, [rateLimitEnabled, rateLimitRps]);

  // Monitor Sliding-Window Token Usage
  useEffect(() => {
    const interval = setInterval(() => {
      const config = seamlessEngine.getRateLimitConfig();
      setCurrentRpsUsage(config.currentUsage);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Update secret key when provider changes
  useEffect(() => {
    const defaultSecret = PROVIDER_SECRETS[providerId] || 'sk_default_secret';
    setSecretKey(defaultSecret);
    const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);
    if (preset) {
      setGameId(preset.defaultGameId);
      if (endpoint === 'bet') setAmount(preset.defaultBet);
      if (endpoint === 'win') setAmount(preset.defaultWin);
    }
  }, [providerId, endpoint]);

  // Generate payload object based on endpoint
  const getPayload = () => {
    const base = {
      provider_id: providerId,
      user_id: currentUser.id,
      currency: currentUser.currency || 'USD'
    };

    switch (endpoint) {
      case 'balance':
        return {
          ...base,
          game_id: gameId,
          session_id: `sess_${currentUser.username}_${Date.now()}`
        };
      case 'bet':
        return {
          ...base,
          transaction_id: transactionId,
          round_id: roundId,
          game_id: gameId,
          amount: Number(amount),
          is_round_end: isRoundEnd,
          metadata: {
            lines: 20,
            bet_level: 1,
            client_ip: '192.168.1.1'
          }
        };
      case 'win':
        return {
          ...base,
          transaction_id: transactionId,
          reference_transaction_id: refTxId || undefined,
          round_id: roundId,
          game_id: gameId,
          amount: Number(amount),
          is_round_end: isRoundEnd,
          metadata: {
            multiplier: '2.75x',
            free_spins: false
          }
        };
      case 'refund':
        return {
          ...base,
          transaction_id: transactionId,
          reference_transaction_id: refTxId || 'TX_PREVIOUS_BET',
          round_id: roundId,
          game_id: gameId,
          amount: Number(amount),
          reason: refundReason,
          metadata: {
            provider_error: 'PROVIDER_SOCKET_DROP_504'
          }
        };
    }
  };

  const [liveSignature, setLiveSignature] = useState<string>('');
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(Date.now());

  // Update timestamp every second if not simulating replay attack
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimestamp(
        simulateReplayAttack ? Date.now() - 10 * 60 * 1000 : Date.now()
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [simulateReplayAttack]);

  const payload = getPayload();
  const rawPayloadOneLine = JSON.stringify(payload);

  // Compute live signature asynchronously
  useEffect(() => {
    computeHmac(secretKey, `${currentTimestamp}.${rawPayloadOneLine}`)
      .then(sig => setLiveSignature(sig))
      .catch(err => console.error('Failed to compute live signature', err));
  }, [rawPayloadOneLine, currentTimestamp, secretKey]);

  const effectiveSignature = tamperSignature ? `${liveSignature.slice(0, -6)}tamper` : liveSignature;

  // Execute Request Handler
  const handleSendRequest = async () => {
    setLoading(true);
    setResponse(null);

    try {
      const res = await seamlessEngine.executeRequest(endpoint, payload, {
        customSignature: effectiveSignature,
        customTimestamp: currentTimestamp,
        customSecretKey: secretKey,
        simulateTimeout,
        latencyJitterMs
      });

      setResponse(res);
      pushDebugLog(endpoint, payload, res);

      // If it was a bet, capture transactionId as default refTxId for subsequent win/refund
      if (endpoint === 'bet' && res.status === 200) {
        setRefTxId(transactionId);
      }

      onLedgerMutated();
    } catch (err: any) {
      console.error('Request execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Quick helper to regenerate fresh IDs
  const handleRegenerateIds = () => {
    const newTxId = `TX_${Math.floor(100000 + Math.random() * 900000)}`;
    const newRoundId = `RND_${Math.floor(100000 + Math.random() * 900000)}`;
    setTransactionId(newTxId);
    setRoundId(newRoundId);
  };

  const handleCopyJson = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadResponseJson = () => {
    if (!response) return;
    const payloadStr = JSON.stringify(response.data, null, 2);
    const blob = new Blob([payloadStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `response_${endpoint}_${providerId}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDebugLogsJson = () => {
    const logsStr = JSON.stringify(debugLogs, null, 2);
    const blob = new Blob([logsStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `simulator_debug_logs_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Replay exactly the current payload without generating a new UUID
  const handleReplayCurrentTransaction = async () => {
    setLoading(true);
    try {
      const res = await seamlessEngine.executeRequest(endpoint, payload, {
        customSignature: effectiveSignature,
        customTimestamp: currentTimestamp,
        customSecretKey: secretKey,
        simulateTimeout,
        latencyJitterMs
      });
      setResponse(res);
      pushDebugLog(endpoint, payload, res, { isIdemp: true });
      onLedgerMutated();
    } catch (err: any) {
      console.error('Replay error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Run automated Idempotency Dual/Burst stress test with identical UUID
  const handleRunIdempotencyStressTest = async (mode: 'dual' | 'burst' = 'dual') => {
    setStressTesting(true);
    setStressMode(mode);

    const testTxId = `IDEMP_${Date.now().toString(36).toUpperCase()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const testRoundId = `RND_${Math.floor(100000 + Math.random() * 900000)}`;

    const testPayload = {
      provider_id: providerId,
      user_id: currentUser.id,
      currency: currentUser.currency || 'USD',
      game_id: gameId,
      round_id: testRoundId,
      transaction_id: testTxId,
      amount: Number(amount) || 20.0,
      is_round_end: isRoundEnd,
      metadata: {
        stress_test: true,
        mode,
        timestamp: Date.now()
      }
    };

    try {
      // 1. Dispatch Initial Request
      const req1 = await seamlessEngine.executeRequest(endpoint, testPayload, {
        customSecretKey: secretKey,
        latencyJitterMs
      });
      pushDebugLog(endpoint, testPayload, req1);

      let req2: ApiResponse;
      let burstSuccessCount = 0;
      const notes: string[] = [];

      if (mode === 'burst') {
        const burstPromises = [
          seamlessEngine.executeRequest(endpoint, testPayload, { customSecretKey: secretKey, latencyJitterMs }),
          seamlessEngine.executeRequest(endpoint, testPayload, { customSecretKey: secretKey, latencyJitterMs }),
          seamlessEngine.executeRequest(endpoint, testPayload, { customSecretKey: secretKey, latencyJitterMs }),
          seamlessEngine.executeRequest(endpoint, testPayload, { customSecretKey: secretKey, latencyJitterMs })
        ];

        const burstResponses = await Promise.all(burstPromises);
        req2 = burstResponses[0];
        burstResponses.forEach((r) => pushDebugLog(endpoint, testPayload, r, { isIdemp: true }));
        burstSuccessCount = burstResponses.filter(r => r.status === 200 && r.data.is_idempotent).length;

        notes.push(`Dispatched 5 concurrent requests with identical transaction UUID '${testTxId}'.`);
        notes.push(`1st request acquired ACID row-lock (${req1.latencyMs}ms); 4 burst replays served from idempotency cache (${req2.latencyMs}ms).`);
      } else {
        req2 = await seamlessEngine.executeRequest(endpoint, testPayload, {
          customSecretKey: secretKey,
          latencyJitterMs
        });
        pushDebugLog(endpoint, testPayload, req2, { isIdemp: true });

        notes.push(`Dispatched 2 consecutive requests with identical transaction UUID '${testTxId}'.`);
        notes.push(`Request #1 created ledger entry (${req1.latencyMs}ms); Request #2 returned cached idempotent response (${req2.latencyMs}ms).`);
      }

      const passed =
        req1.status === 200 &&
        req2.status === 200 &&
        req2.data.is_idempotent === true &&
        req1.data.balance === req2.data.balance;

      if (passed) {
        notes.push('ACID Verification Succeeded: ZERO duplicate balance debit/credit recorded in PostgreSQL ledger.');
      } else {
        notes.push('Idempotency check failed to verify identical balance or cache hit.');
      }

      const result: IdempotencyStressResult = {
        txId: testTxId,
        endpoint,
        req1,
        req2,
        burstCount: mode === 'burst' ? 5 : 2,
        burstSuccessCount: mode === 'burst' ? burstSuccessCount + 1 : 2,
        timestamp: Date.now(),
        passed,
        notes
      };

      setStressResult(result);
      setResponse(req2);
      onLedgerMutated();
    } catch (err: any) {
      console.error('Idempotency stress test failed:', err);
    } finally {
      setStressTesting(false);
    }
  };

  // Run Request Throttler Flood Spike Test (Simulate Traffic Burst to provoke HTTP 429)
  const handleRunThrottlerFloodTest = async (count: number = floodCount) => {
    setThrottlerFloodTesting(true);
    setThrottlerResults(null);

    const promises: Promise<{ payload: any; res: ApiResponse }>[] = [];
    for (let i = 0; i < count; i++) {
      const floodTxId = `FLOOD_${Date.now().toString(36).toUpperCase()}_${i}_${Math.floor(1000 + Math.random() * 9000)}`;
      const floodPayload = {
        provider_id: providerId,
        user_id: currentUser.id,
        currency: currentUser.currency || 'USD',
        game_id: gameId,
        round_id: `RND_FLOOD_${i}_${Math.floor(1000 + Math.random() * 9000)}`,
        transaction_id: floodTxId,
        amount: Number(amount) || 10.0,
        is_round_end: isRoundEnd
      };

      promises.push(
        seamlessEngine.executeRequest(endpoint, floodPayload, {
          customSecretKey: secretKey,
          latencyJitterMs
        }).then(res => ({ payload: floodPayload, res }))
      );
    }

    try {
      const results = await Promise.all(promises);
      const responses = results.map(r => r.res);
      
      // Log all into Debug Log
      results.forEach(item => {
        pushDebugLog(endpoint, item.payload, item.res, { maxRpsVal: rateLimitRps });
      });

      const accepted = responses.filter((r) => r.status >= 200 && r.status < 300).length;
      const throttled = responses.filter((r) => r.status === 429).length;

      setThrottlerResults({
        totalSent: count,
        accepted,
        throttled,
        responses,
        timestamp: Date.now()
      });

      // Point the Response Inspector to a 429 response if present, else first response
      const first429 = responses.find((r) => r.status === 429);
      if (first429) {
        setResponse(first429);
        setRightPanelTab('inspector');
      } else if (responses.length > 0) {
        setResponse(responses[0]);
      }

      onLedgerMutated();
    } catch (err: any) {
      console.error('Throttler flood test error:', err);
    } finally {
      setThrottlerFloodTesting(false);
    }
  };

  // Filtered Debug Logs
  const filteredDebugLogs = useMemo(() => {
    return debugLogs.filter((log) => {
      if (logFilter === '429') return log.statusCode === 429;
      if (logFilter === '200') return log.statusCode === 200;
      if (logFilter === 'errors') return log.statusCode >= 400 && log.statusCode !== 429;
      return true;
    });
  }, [debugLogs, logFilter]);

  const count429 = debugLogs.filter((l) => l.statusCode === 429).length;
  const count200 = debugLogs.filter((l) => l.statusCode === 200).length;

  return (
    <div className="space-y-6">
      {/* Top View Mode Switcher: Interactive Workbench vs Real-Time Payload Log Viewer */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-2 font-mono text-xs overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSimViewMode('workbench')}
            className={`px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
              simViewMode === 'workbench'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Interactive Workbench &amp; Fault Injector</span>
          </button>

          <button
            onClick={() => setSimViewMode('payload_viewer')}
            className={`px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap relative ${
              simViewMode === 'payload_viewer'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-950 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Real-Time /balance, /bet, /win Payload Log Viewer</span>
            <span className="relative flex h-2 w-2 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 pr-1">
          <span>Active Player:</span>
          <span className="text-white font-bold">{currentUser.username}</span>
          <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            {currentWallet ? `${currentWallet.real_balance.toFixed(2)} ${currentWallet.currency}` : '0.00 USD'}
          </span>
        </div>
      </div>

      {simViewMode === 'payload_viewer' ? (
        <EndpointPayloadLogViewer
          currentUser={currentUser}
          currentWallet={currentWallet}
          onLedgerMutated={onLedgerMutated}
          initialEndpointFilter="all"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Request Configuration, Fault Injection & Rate Limiter (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
        
        {/* Step 1: Provider & Endpoint Selection */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              1. Provider &amp; Endpoint Selector
            </h2>
            <button
              onClick={handleRegenerateIds}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regen IDs</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Provider Select */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Aggregator / Game Provider
              </label>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                {PROVIDER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Seamless Endpoint Select */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Seamless Core API Endpoint
              </label>
              <div className="grid grid-cols-4 gap-1">
                {(['balance', 'bet', 'win', 'refund'] as Endpoint[]).map((ep) => (
                  <button
                    key={ep}
                    type="button"
                    onClick={() => setEndpoint(ep)}
                    className={`py-2 text-xs font-bold font-mono rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                      endpoint === ep
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    /{ep}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Payload Parameter Configuration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              2. Request Payload &amp; Mutation Parameters
            </h2>
            <span className="text-xs font-mono text-slate-400">
              User: <span className="text-white font-bold">{currentUser.username}</span> ({currentUser.currency})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            {/* Game ID */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Game ID</label>
              <input
                type="text"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Amount */}
            {endpoint !== 'balance' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Amount ({currentUser.currency})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500 font-bold"
                  />
                  <div className="absolute right-2.5 top-2 text-xs font-mono text-slate-500">
                    {currentUser.currency}
                  </div>
                </div>
              </div>
            )}

            {/* Round ID */}
            {endpoint !== 'balance' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Provider Round ID
                </label>
                <input
                  type="text"
                  value={roundId}
                  onChange={(e) => setRoundId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Transaction ID */}
            {endpoint !== 'balance' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Transaction UUID (Idempotency Key)
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Reference Transaction ID (for win or refund) */}
            {(endpoint === 'win' || endpoint === 'refund') && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Reference Bet Transaction ID
                </label>
                <input
                  type="text"
                  placeholder="TX_ORIGINAL_BET"
                  value={refTxId}
                  onChange={(e) => setRefTxId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-blue-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Refund Reason */}
            {endpoint === 'refund' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Refund Reason</label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value="GAME_CANCELLED_BY_PROVIDER">GAME_CANCELLED_BY_PROVIDER</option>
                  <option value="PROVIDER_HTTP_504_TIMEOUT">PROVIDER_HTTP_504_TIMEOUT</option>
                  <option value="ORPHAN_BET_REVERT">ORPHAN_BET_REVERT</option>
                  <option value="MANUAL_OPERATOR_VOID">MANUAL_OPERATOR_VOID</option>
                </select>
              </div>
            )}
          </div>

          {/* Fault Injection Toggles */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Fault Injection &amp; Negative Security Tests
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center space-x-2 bg-slate-900/80 p-2 rounded border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tamperSignature}
                  onChange={(e) => setTamperSignature(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                />
                <span className="text-[11px] text-slate-300">
                  Tamper Sig <span className="text-rose-400">(401)</span>
                </span>
              </label>

              <label className="flex items-center space-x-2 bg-slate-900/80 p-2 rounded border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateReplayAttack}
                  onChange={(e) => setSimulateReplayAttack(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                />
                <span className="text-[11px] text-slate-300">
                  Replay &gt;5m <span className="text-rose-400">(401)</span>
                </span>
              </label>

              <label className="flex items-center space-x-2 bg-slate-900/80 p-2 rounded border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateTimeout}
                  onChange={(e) => setSimulateTimeout(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                />
                <span className="text-[11px] text-slate-300">
                  Timeout SLA <span className="text-rose-400">(&gt;4s)</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Step 3: Real-Time HMAC-SHA256 Signer & Execution Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              3. HMAC-SHA256 Security Header Pipeline
            </h2>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              X-Signature = HMAC-SHA256(timestamp + &quot;.&quot; + rawBody, secret)
            </span>
          </div>

          <div className="bg-slate-950 rounded-lg p-3 font-mono text-xs border border-slate-800 mb-4">
            <div className="text-slate-500 text-[10px] uppercase mb-1">Computed X-Signature Header:</div>
            <div
              className={`break-all font-bold ${
                tamperSignature ? 'text-rose-400 line-through' : 'text-emerald-400'
              }`}
            >
              {effectiveSignature}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 border-t border-slate-800/80 pt-1.5">
              <span>X-Timestamp: {currentTimestamp}</span>
              <span>X-Provider-Id: {providerId}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleSendRequest}
              disabled={loading || stressTesting}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                loading
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Executing ACID Transaction...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  Dispatch POST /api/seamless/{endpoint}
                </>
              )}
            </button>

            <button
              onClick={handleReplayCurrentTransaction}
              disabled={loading || stressTesting}
              className="px-4 py-3 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              title="Replay this exact request with the same UUID to test idempotency"
            >
              <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
              <span>Replay Same UUID</span>
            </button>
          </div>
        </div>

        {/* Step 4: Dedicated Rate Limiter & Throttler Configuration Panel */}
        <div className="bg-slate-900 border border-cyan-500/40 rounded-xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Panel Header & Master Toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  rateLimitEnabled ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Gauge className="w-4 h-4 text-cyan-400" />
                4. API Gateway Rate Limiter &amp; Throttling
              </h2>
            </div>
            
            {/* Master Toggle */}
            <button
              onClick={() => setRateLimitEnabled(!rateLimitEnabled)}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                rateLimitEnabled
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${rateLimitEnabled ? 'bg-cyan-400' : 'bg-slate-500'}`} />
              {rateLimitEnabled ? 'LIMITER ACTIVE' : 'THROTTLER BYPASS'}
            </button>
          </div>

          <p className="text-xs text-slate-300 mb-4 leading-relaxed font-sans">
            Configure the Redis Sliding-Window Token Bucket threshold to simulate API Gateway backpressure. Exceeding the RPS threshold intercepts requests before database row locks and returns <code className="text-rose-400 font-mono bg-slate-950 px-1 py-0.5 rounded border border-rose-500/30 font-bold">HTTP 429 Too Many Requests</code> with standard <code className="text-amber-400 font-mono">Retry-After: 1</code> headers.
          </p>

          {/* RPS Threshold Configuration & Presets */}
          <div className="space-y-4 mb-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                  Requests-Per-Second (RPS) Threshold:
                </label>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-cyan-300 font-extrabold text-sm bg-cyan-950 px-2.5 py-0.5 rounded border border-cyan-500/40 shadow-inner">
                    {rateLimitRps} RPS
                  </span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-3">
                {[
                  { rps: 2, label: '2 RPS', sub: 'Strict Trap' },
                  { rps: 5, label: '5 RPS', sub: 'Stress Cap' },
                  { rps: 10, label: '10 RPS', sub: 'Standard SLA' },
                  { rps: 25, label: '25 RPS', sub: 'High Volume' },
                  { rps: 50, label: '50 RPS', sub: 'Enterprise' }
                ].map((tier) => (
                  <button
                    key={tier.rps}
                    type="button"
                    onClick={() => {
                      setRateLimitRps(tier.rps);
                      if (!rateLimitEnabled) setRateLimitEnabled(true);
                    }}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer font-mono ${
                      rateLimitRps === tier.rps && rateLimitEnabled
                        ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-md shadow-cyan-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-bold text-cyan-300">{tier.label}</div>
                    <div className="text-[9px] text-slate-500 font-sans">{tier.sub}</div>
                  </button>
                ))}
              </div>

              {/* Slider for fine-grain tuning (1 to 100 RPS) */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={rateLimitRps}
                  onChange={(e) => {
                    setRateLimitRps(Number(e.target.value));
                    if (!rateLimitEnabled) setRateLimitEnabled(true);
                  }}
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={rateLimitRps}
                  onChange={(e) => {
                    setRateLimitRps(Math.max(1, Number(e.target.value)));
                    if (!rateLimitEnabled) setRateLimitEnabled(true);
                  }}
                  className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Real-time Sliding Window Token Capacity Meter */}
            <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-cyan-400" />
                  1s Rolling Window Token Usage:
                </span>
                <span
                  className={`font-bold ${
                    !rateLimitEnabled
                      ? 'text-slate-500'
                      : currentRpsUsage >= rateLimitRps
                      ? 'text-rose-400 animate-pulse'
                      : currentRpsUsage > rateLimitRps * 0.7
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {rateLimitEnabled ? `${currentRpsUsage} / ${rateLimitRps} Tokens Consumed` : 'Unmetered (Bypass)'}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-200 ${
                    !rateLimitEnabled
                      ? 'bg-slate-700 w-0'
                      : currentRpsUsage >= rateLimitRps
                      ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-600'
                      : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
                  }`}
                  style={{
                    width: rateLimitEnabled ? `${Math.min(100, (currentRpsUsage / rateLimitRps) * 100)}%` : '0%'
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-0.5">
                <span>Algorithm: Redis In-Memory Sliding Window</span>
                <span>{currentRpsUsage >= rateLimitRps ? '⚠️ 429 REJECTIONS ACTIVE' : '✅ CAPACITY OK'}</span>
              </div>
            </div>
          </div>

          {/* Burst Traffic Flood Generator Action */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Burst Traffic Simulator (Trigger 429 Responses):
              </span>
              <div className="flex items-center space-x-1 font-mono text-[11px]">
                {[5, 10, 15, 25].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setFloodCount(cnt)}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      floodCount === cnt
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {cnt}x
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (!rateLimitEnabled) setRateLimitEnabled(true);
                handleRunThrottlerFloodTest(floodCount);
              }}
              disabled={throttlerFloodTesting || loading}
              className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                throttlerFloodTesting
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-cyan-500/25'
              }`}
            >
              {throttlerFloodTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Dispatching {floodCount} Concurrent Requests...
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4 text-amber-300" />
                  Dispatch {floodCount} Concurrent Requests Burst (Flood Test)
                </>
              )}
            </button>

            {/* Flood Test Results Report */}
            {throttlerResults && !throttlerFloodTesting && (
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-3.5 space-y-3 font-mono">
                <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Burst Execution Summary:
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(throttlerResults.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-2.5">
                    <div className="text-emerald-400 font-extrabold text-base">
                      {throttlerResults.accepted} / {throttlerResults.totalSent}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">HTTP 200 (Accepted)</div>
                  </div>

                  <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-2.5">
                    <div className="text-rose-400 font-extrabold text-base">
                      {throttlerResults.throttled} / {throttlerResults.totalSent}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">HTTP 429 (Throttled)</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 font-sans space-y-1">
                  <div className="text-cyan-300 font-mono font-bold text-[10px] uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Rate Limiter Verification:
                  </div>
                  <div>
                    {throttlerResults.throttled > 0 ? (
                      <span>
                        ✅ Rate limit threshold of <strong>{rateLimitRps} RPS</strong> successfully enforced: <strong>{throttlerResults.accepted}</strong> requests processed normally, and <strong>{throttlerResults.throttled}</strong> requests were rejected with <code className="text-rose-400 font-mono font-bold">HTTP 429 Too Many Requests</code>. See entries in the debug log.
                      </span>
                    ) : (
                      <span>
                        All {throttlerResults.totalSent} requests fit inside the {rateLimitRps} RPS window. Reduce RPS threshold to 2 or 5 to trigger 429 rejections.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 5: Dedicated Idempotency Key Stress-Tester */}
        <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Zap className="w-4 h-4 text-purple-400" />
                5. Idempotency Key Replay Stress-Tester
              </h2>
            </div>
            <span className="text-[10px] font-mono text-purple-300 bg-purple-950/80 border border-purple-500/30 px-2 py-0.5 rounded font-bold">
              ACID Mutex
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => handleRunIdempotencyStressTest('dual')}
              disabled={stressTesting || loading}
              className={`p-3 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                stressTesting && stressMode === 'dual'
                  ? 'bg-purple-900/40 border-purple-500 text-white'
                  : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 hover:border-purple-500/40 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Dual Replay (2x Same UUID)
                </span>
                <span className="text-[10px] text-slate-500">Sequential</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Sends original transaction followed immediately by duplicate with identical UUID.
              </p>
            </button>

            <button
              onClick={() => handleRunIdempotencyStressTest('burst')}
              disabled={stressTesting || loading}
              className={`p-3 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                stressTesting && stressMode === 'burst'
                  ? 'bg-purple-900/40 border-purple-500 text-white'
                  : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 hover:border-purple-500/40 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Burst Stress (5x Same UUID)
                </span>
                <span className="text-[10px] text-slate-500">Concurrent</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Simulates 5 simultaneous requests with identical UUID to test row locks &amp; idempotency cache.
              </p>
            </button>
          </div>
        </div>

      </div>

      {/* Right Column: Live HTTP Response Inspector & Debug Log Console (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col min-h-[600px]">
          
          {/* Main Subtabs Header: Inspector vs Live Payload Logs vs Debug Log */}
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setRightPanelTab('inspector')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  rightPanelTab === 'inspector'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Response Inspector</span>
              </button>

              <button
                onClick={() => setRightPanelTab('payload_viewer')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  rightPanelTab === 'payload_viewer'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Payload Logs</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </button>

              <button
                onClick={() => setRightPanelTab('debug_log')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap relative ${
                  rightPanelTab === 'debug_log'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Debug Console</span>
                <span className="px-1.5 py-0.2 bg-slate-800 text-[10px] rounded-full text-slate-300">
                  {debugLogs.length}
                </span>
                {count429 > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500/30 text-rose-300 text-[10px] rounded-full border border-rose-500/40 font-bold animate-pulse">
                    {count429} throttled
                  </span>
                )}
              </button>
            </div>

            {/* Actions for current tab */}
            {rightPanelTab === 'inspector' && response && (
              <div className="flex items-center space-x-1.5 font-mono text-xs">
                <button
                  onClick={() => setIsMinified(!isMinified)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                    isMinified
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title="Toggle Minified vs Pretty-Printed JSON"
                >
                  {isMinified ? 'Minified' : 'Beautified'}
                </button>

                <button
                  onClick={handleDownloadResponseJson}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white cursor-pointer"
                  title="Download Raw Response JSON"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                </button>

                <button
                  onClick={handleCopyJson}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] flex items-center gap-1 font-bold cursor-pointer"
                  title="Copy JSON Payload to Clipboard"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}

            {rightPanelTab === 'debug_log' && (
              <div className="flex items-center space-x-1.5 font-mono text-xs">
                <button
                  onClick={handleDownloadDebugLogsJson}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white cursor-pointer"
                  title="Export Debug Logs as JSON"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                </button>

                <button
                  onClick={() => setDebugLogs([])}
                  className="p-1.5 rounded bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 cursor-pointer"
                  title="Clear Debug Logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* VIEW 1: RESPONSE INSPECTOR */}
          {rightPanelTab === 'inspector' && (
            <div className="flex-1 flex flex-col">
              {!response && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl p-6">
                  <Send className="w-10 h-10 mb-3 text-slate-600 animate-pulse" />
                  <p className="text-xs font-semibold text-slate-400 font-mono">Awaiting Request Execution</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs font-mono">
                    Select an endpoint or trigger a rate limit burst to inspect raw HTTP 200 / 429 payloads, headers, and ACID locks.
                  </p>
                </div>
              )}

              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs text-cyan-300 font-mono">Acquiring Row-Level Lock &amp; Evaluating Rate Limiter...</p>
                </div>
              )}

              {response && !loading && (
                <div className="space-y-4 flex-1 flex flex-col">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg ${
                          response.status >= 200 && response.status < 300
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : response.status === 429
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm shadow-rose-500/20'
                            : response.status === 401
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        HTTP {response.status}
                      </span>
                      <span className="text-xs font-bold text-white font-mono">
                        {response.data.code || (response.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'SUCCESS')}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span
                        className={`font-bold ${
                          response.status === 429
                            ? 'text-cyan-400'
                            : response.latencyMs > 3800
                            ? 'text-rose-400'
                            : response.latencyMs > 1000
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {response.latencyMs}ms
                      </span>
                      <span className="text-[10px] text-slate-500">(&lt;4s SLA)</span>
                    </div>
                  </div>

                  {/* HTTP 429 Special Alert Callout */}
                  {response.status === 429 && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-1.5 text-xs text-rose-200 font-mono">
                      <div className="flex items-center gap-1.5 font-bold text-rose-400">
                        <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <span>HTTP 429 TOO MANY REQUESTS OBSERVED</span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                        API Gateway token bucket exhausted for this 1-second rolling window. Database row-locking was bypassed to preserve PostgreSQL connection pool capacity.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                        <span className="bg-slate-900 px-2 py-1 rounded border border-slate-800">
                          Retry-After: <strong className="text-amber-300">1s</strong>
                        </span>
                        <span className="bg-slate-900 px-2 py-1 rounded border border-slate-800">
                          X-RateLimit-Limit: <strong className="text-cyan-300">{rateLimitRps} req/s</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Idempotency Alert Banner if replayed */}
                  {response.data.is_idempotent && (
                    <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-2 text-xs text-cyan-300 font-mono">
                      <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <div>
                        <span className="font-bold">Idempotent Replay:</span> Returned cached response without duplicate ledger deduction.
                      </div>
                    </div>
                  )}

                  {/* Player Balance Mutation Snapshot */}
                  {response.data.balance !== undefined && (
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2 font-mono">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 flex items-center justify-between">
                        <span>Player Ledger Snapshot</span>
                        <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Row-Locked
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Updated Real Balance:</span>
                        <span className="font-bold text-amber-400 text-sm">
                          {response.data.currency === 'BDT' ? '৳' : '$'}{Number(response.data.balance).toFixed(2)} {response.data.currency || 'USD'}
                        </span>
                      </div>
                      {response.data.bonus_balance !== undefined && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Bonus Balance:</span>
                          <span className="font-bold text-cyan-400">
                            {response.data.currency === 'BDT' ? '৳' : '$'}{Number(response.data.bonus_balance).toFixed(2)} {response.data.currency || 'USD'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Response Inspector Navigation Subtabs */}
                  <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                    <button
                      onClick={() => setInspectorTab('body')}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                        inspectorTab === 'body'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Payload (JSON)</span>
                    </button>

                    <button
                      onClick={() => setInspectorTab('headers')}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                        inspectorTab === 'headers'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Headers</span>
                    </button>

                    <button
                      onClick={() => setInspectorTab('audit')}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                        inspectorTab === 'audit'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Audit &amp; Mutex</span>
                    </button>
                  </div>

                  {/* Inspector Tab 1: JSON Body */}
                  {inspectorTab === 'body' && (
                    <div className="flex-1 min-h-[200px] flex flex-col">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                        <span className="flex items-center gap-1 text-cyan-400">
                          <Terminal className="w-3 h-3" />
                          <span>Raw Response Payload</span>
                        </span>
                        <span className="text-slate-500 text-[10px]">application/json</span>
                      </div>
                      <JsonSyntaxHighlighter data={response.data} isMinified={isMinified} />
                    </div>
                  )}

                  {/* Inspector Tab 2: HTTP Headers */}
                  {inspectorTab === 'headers' && (
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono space-y-2">
                      <div className="text-[10px] uppercase font-bold text-amber-400 mb-2 flex items-center justify-between">
                        <span>HTTP Response Headers</span>
                        <span className="text-[9px] text-slate-500">{Object.keys(response.headers).length} Headers</span>
                      </div>
                      <div className="space-y-1.5 divide-y divide-slate-900">
                        {Object.entries(response.headers).map(([k, v]) => (
                          <div key={k} className="flex flex-col sm:flex-row sm:justify-between pt-1 gap-1">
                            <span className="text-slate-400 font-bold">{k}:</span>
                            <span className="text-emerald-300 break-all">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inspector Tab 3: ACID Mutex & Security Audit */}
                  {inspectorTab === 'audit' && (
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono space-y-2.5">
                      <div className="text-[10px] uppercase font-bold text-purple-400 mb-1">
                        ACID &amp; Rate Limiter Audit Trail
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">HTTP Status:</span>
                          <span className={response.status === 429 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                            {response.status} {response.status === 429 ? 'THROTTLED' : 'OK'}
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">HMAC Signature:</span>
                          <span className="font-bold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> VALIDATED
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">SLA Response:</span>
                          <span className="font-bold text-cyan-400">{response.latencyMs} ms (&lt;4,000ms)</span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">Rate Limit State:</span>
                          <span className="font-bold text-amber-400">
                            {response.status === 429 ? '429 EXCEEDED' : 'ENFORCED'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: DEDICATED SIMULATOR DEBUG LOG CONSOLE */}
          {rightPanelTab === 'debug_log' && (
            <div className="flex-1 flex flex-col space-y-3">
              {/* Filter Pills */}
              <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                <button
                  onClick={() => setLogFilter('all')}
                  className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                    logFilter === 'all'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({debugLogs.length})
                </button>

                <button
                  onClick={() => setLogFilter('429')}
                  className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
                    logFilter === '429'
                      ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                      : 'text-rose-400 hover:bg-rose-950/40'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>429 ({count429})</span>
                </button>

                <button
                  onClick={() => setLogFilter('200')}
                  className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                    logFilter === '200'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-emerald-400 hover:bg-emerald-950/40'
                  }`}
                >
                  200 OK ({count200})
                </button>
              </div>

              {/* Debug Log Stream Table */}
              <div className="flex-1 overflow-y-auto max-h-[500px] space-y-2 pr-1 font-mono text-xs">
                {filteredDebugLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
                    <ListFilter className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-xs">No matching debug log records found.</p>
                  </div>
                ) : (
                  filteredDebugLogs.map((log) => {
                    const is429 = log.statusCode === 429;
                    const is200 = log.statusCode === 200;

                    return (
                      <div
                        key={log.id}
                        onClick={() => {
                          setResponse(log.response);
                          setRightPanelTab('inspector');
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                          is429
                            ? 'bg-rose-950/30 border-rose-500/40 hover:border-rose-400 hover:bg-rose-950/50'
                            : is200
                            ? 'bg-slate-950 border-slate-800/80 hover:border-emerald-500/40 hover:bg-slate-900'
                            : 'bg-amber-950/30 border-amber-500/40 hover:border-amber-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                is429
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                  : is200
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              HTTP {log.statusCode}
                            </span>
                            <span className="font-bold text-white text-xs">{log.method}</span>
                          </div>

                          <div className="flex items-center space-x-1.5 text-[10px] text-slate-500">
                            <span>{log.timeLabel}</span>
                            <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] mt-1 pt-1 border-t border-slate-900">
                          <span className="text-slate-400 truncate max-w-[200px]">
                            {is429 ? (
                              <span className="text-rose-300 font-bold flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-rose-400 inline" />
                                RATE_LIMIT_EXCEEDED (Retry-After: 1s)
                              </span>
                            ) : log.isIdempotent ? (
                              <span className="text-cyan-300 font-bold">CACHED REPLAY (Idempotent)</span>
                            ) : (
                              <span>Provider: {log.providerId}</span>
                            )}
                          </span>

                          <span className={`font-bold ${is429 ? 'text-cyan-400' : 'text-slate-300'}`}>
                            {log.latencyMs}ms
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: LIVE PAYLOAD LOG VIEWER */}
          {rightPanelTab === 'payload_viewer' && (
            <div className="flex-1">
              <EndpointPayloadLogViewer
                currentUser={currentUser}
                currentWallet={currentWallet}
                onLedgerMutated={onLedgerMutated}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  )}
</div>
);
};
