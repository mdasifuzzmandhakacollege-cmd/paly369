import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Flame,
  HelpCircle,
  Key,
  Layers,
  ListFilter,
  Lock,
  Pause,
  Play,
  PlaySquare,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Zap
} from 'lucide-react';
import {
  seamlessEngine,
  EndpointPayloadLog,
  ApiResponse,
  PROVIDER_SECRETS
} from '../services/simulatedWalletEngine';
import { UserEntity, WalletEntity } from '../server/types/seamless';

interface EndpointPayloadLogViewerProps {
  currentUser?: UserEntity;
  currentWallet?: WalletEntity;
  onLedgerMutated?: () => void;
  initialEndpointFilter?: 'all' | 'balance' | 'bet' | 'win' | 'refund';
}

export const EndpointPayloadLogViewer: React.FC<EndpointPayloadLogViewerProps> = ({
  currentUser,
  currentWallet,
  onLedgerMutated,
  initialEndpointFilter = 'all'
}) => {
  const [logs, setLogs] = useState<EndpointPayloadLog[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [endpointFilter, setEndpointFilter] = useState<'all' | 'balance' | 'bet' | 'win' | 'refund'>(initialEndpointFilter);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'errors' | '429' | 'idempotent'>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLivePaused, setIsLivePaused] = useState<boolean>(false);
  const [inspectorViewTab, setInspectorViewTab] = useState<'split' | 'request' | 'response' | 'headers' | 'diagnostics'>('split');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExecutingQuickTest, setIsExecutingQuickTest] = useState<boolean>(false);
  const [quickTestNotice, setQuickTestNotice] = useState<string | null>(null);

  // Subscribe to real-time endpoint payload logs
  useEffect(() => {
    const unsubscribe = seamlessEngine.onEndpointPayloadRecorded((incomingLogs) => {
      if (!isLivePaused) {
        setLogs(incomingLogs);
      }
    });

    // Initial load
    const initial = seamlessEngine.getEndpointPayloadLogs();
    setLogs(initial);
    if (initial.length > 0 && !selectedLogId) {
      setSelectedLogId(initial[0].id);
    }

    return () => {
      unsubscribe();
    };
  }, [isLivePaused]);

  // Keep selected log in sync if logs change and nothing is selected
  useEffect(() => {
    if (logs.length > 0 && (!selectedLogId || !logs.find((l) => l.id === selectedLogId))) {
      setSelectedLogId(logs[0].id);
    }
  }, [logs, selectedLogId]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Endpoint filter
      if (endpointFilter !== 'all' && log.endpoint !== endpointFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'success' && !log.isSuccess) return false;
      if (statusFilter === 'errors' && log.isSuccess) return false;
      if (statusFilter === '429' && log.statusCode !== 429) return false;
      if (statusFilter === 'idempotent' && !log.isIdempotent) return false;

      // Provider filter
      if (providerFilter !== 'all' && log.providerId !== providerFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const strRep = (
          `${log.id} ${log.method} ${log.endpoint} ${log.providerId} ${log.userId || ''} ${log.txId || ''} ${log.roundId || ''} ${log.statusText} ${log.errorMessage || ''} ${JSON.stringify(log.requestPayload)} ${JSON.stringify(log.responsePayload)}`
        ).toLowerCase();
        if (!strRep.includes(query)) return false;
      }

      return true;
    });
  }, [logs, endpointFilter, statusFilter, providerFilter, searchQuery]);

  // Selected Log object
  const selectedLog = useMemo(() => {
    return logs.find((l) => l.id === selectedLogId) || filteredLogs[0] || logs[0] || null;
  }, [logs, selectedLogId, filteredLogs]);

  // Telemetry metrics
  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter((l) => l.isSuccess).length;
    const failure = total - success;
    const throttled429 = logs.filter((l) => l.statusCode === 429).length;
    const avgLatency = total > 0 ? Math.round(logs.reduce((acc, l) => acc + l.latencyMs, 0) / total) : 0;
    const balanceCalls = logs.filter((l) => l.endpoint === 'balance').length;
    const betCalls = logs.filter((l) => l.endpoint === 'bet').length;
    const winCalls = logs.filter((l) => l.endpoint === 'win').length;

    return {
      total,
      success,
      failure,
      throttled429,
      avgLatency,
      successRate: total > 0 ? Math.round((success / total) * 100) : 100,
      balanceCalls,
      betCalls,
      winCalls
    };
  }, [logs]);

  // Clear Logs
  const handleClearLogs = () => {
    seamlessEngine.clearEndpointPayloadLogs();
    setLogs([]);
    setSelectedLogId(null);
  };

  // Export to JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `seamless_payload_logs_${new Date().toISOString().slice(0, 19)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Quick Mock Execution Handlers to test real-time payloads
  const runQuickEndpointTest = async (
    type: 'balance_200' | 'bet_200' | 'win_200' | 'bet_422' | 'bet_401' | 'win_404' | 'bet_429' | 'win_504'
  ) => {
    setIsExecutingQuickTest(true);
    const userId = currentUser?.id || 'a0000000-0000-0000-0000-000000000001';
    const currency = currentUser?.currency || 'USD';
    const prov = 'pragmatic_play';
    const randId = Math.floor(100000 + Math.random() * 900000);

    try {
      if (type === 'balance_200') {
        setQuickTestNotice('Executing GET /balance (200 OK)...');
        await seamlessEngine.executeRequest('balance', {
          provider_id: prov,
          user_id: userId,
          currency,
          game_id: 'vs20olympgate'
        });
      } else if (type === 'bet_200') {
        setQuickTestNotice('Executing POST /bet (200 OK)...');
        await seamlessEngine.executeRequest('bet', {
          provider_id: prov,
          user_id: userId,
          currency,
          game_id: 'vs20sweetbonanza',
          transaction_id: `TX_BET_TEST_${randId}`,
          round_id: `RND_TEST_${randId}`,
          amount: 10.0,
          is_round_end: false
        });
      } else if (type === 'win_200') {
        setQuickTestNotice('Executing POST /win (200 OK)...');
        // First place a small bet to open the round
        await seamlessEngine.executeRequest('bet', {
          provider_id: prov,
          user_id: userId,
          currency,
          game_id: 'vs20sweetbonanza',
          transaction_id: `TX_BET_TEST_${randId}`,
          round_id: `RND_TEST_${randId}`,
          amount: 5.0,
          is_round_end: false
        });
        // Then settle win
        await seamlessEngine.executeRequest('win', {
          provider_id: prov,
          user_id: userId,
          currency,
          game_id: 'vs20sweetbonanza',
          transaction_id: `TX_WIN_TEST_${randId}`,
          reference_transaction_id: `TX_BET_TEST_${randId}`,
          round_id: `RND_TEST_${randId}`,
          amount: 25.0,
          is_round_end: true
        });
      } else if (type === 'bet_422') {
        setQuickTestNotice('Executing POST /bet (422 Insufficient Balance Error)...');
        await seamlessEngine.executeRequest('bet', {
          provider_id: prov,
          user_id: userId,
          currency,
          game_id: 'vs20olympgate',
          transaction_id: `TX_BET_EXCESS_${randId}`,
          round_id: `RND_EXCESS_${randId}`,
          amount: 9999999.00
        });
      } else if (type === 'bet_401') {
        setQuickTestNotice('Executing POST /bet (401 Invalid Signature Error)...');
        await seamlessEngine.executeRequest(
          'bet',
          {
            provider_id: prov,
            user_id: userId,
            currency,
            game_id: 'vs20olympgate',
            transaction_id: `TX_BAD_SIG_${randId}`,
            round_id: `RND_BAD_SIG_${randId}`,
            amount: 15.0
          },
          { customSignature: '0000000000000000badsignature000000000000000000000000' }
        );
      } else if (type === 'win_404') {
        setQuickTestNotice('Executing POST /win (404 Round Not Found Error)...');
        await seamlessEngine.executeRequest('win', {
          provider_id: prov,
          user_id: userId,
          currency,
          game_id: 'vs20olympgate',
          transaction_id: `TX_GHOST_WIN_${randId}`,
          round_id: `RND_NON_EXISTENT_ROUND_${randId}`,
          amount: 50.0
        });
      } else if (type === 'bet_429') {
        setQuickTestNotice('Executing POST /bet (429 Rate Limit Throttled)...');
        // Temporarily enforce strict 1 RPS and trigger burst
        const oldRps = seamlessEngine.rateLimitMaxRps;
        const oldEnabled = seamlessEngine.rateLimitEnabled;
        seamlessEngine.setRateLimitConfig({ enabled: true, maxRps: 1 });
        await seamlessEngine.executeRequest('bet', {
          provider_id: prov,
          user_id: userId,
          amount: 10.0
        });
        await seamlessEngine.executeRequest('bet', {
          provider_id: prov,
          user_id: userId,
          amount: 10.0
        });
        seamlessEngine.setRateLimitConfig({ enabled: oldEnabled, maxRps: oldRps });
      } else if (type === 'win_504') {
        setQuickTestNotice('Executing POST /win (504 SLA Timeout Simulation)...');
        await seamlessEngine.executeRequest(
          'win',
          {
            provider_id: prov,
            user_id: userId,
            currency,
            game_id: 'vs20olympgate',
            transaction_id: `TX_TIMEOUT_${randId}`,
            round_id: `RND_TIMEOUT_${randId}`,
            amount: 10.0
          },
          { simulateTimeout: true }
        );
      }

      if (onLedgerMutated) {
        onLedgerMutated();
      }

      // Auto-select latest log
      const updated = seamlessEngine.getEndpointPayloadLogs();
      if (updated.length > 0) {
        setSelectedLogId(updated[0].id);
      }
    } catch (err: any) {
      console.warn('Quick test executed with handled error:', err);
    } finally {
      setIsExecutingQuickTest(false);
      setTimeout(() => setQuickTestNotice(null), 2500);
    }
  };

  // 1-Click Replay Selected Log
  const handleReplayLog = async (log: EndpointPayloadLog) => {
    setIsExecutingQuickTest(true);
    setQuickTestNotice(`Replaying ${log.method}...`);
    try {
      await seamlessEngine.executeRequest(log.endpoint, log.requestPayload);
      if (onLedgerMutated) {
        onLedgerMutated();
      }
      const updated = seamlessEngine.getEndpointPayloadLogs();
      if (updated.length > 0) {
        setSelectedLogId(updated[0].id);
      }
    } catch (err) {
      console.warn('Replay error:', err);
    } finally {
      setIsExecutingQuickTest(false);
      setTimeout(() => setQuickTestNotice(null), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar & Quick Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                {!isLivePaused ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                )}
              </span>
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>Real-Time Endpoint Payload Log Viewer</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  /balance · /bet · /win
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Live HTTP payload interceptor, cryptographic HMAC verifier, and failure diagnosis engine.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setIsLivePaused(!isLivePaused)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                isLivePaused
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isLivePaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isLivePaused ? 'Resume Stream' : 'Pause Stream'}</span>
            </button>

            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Download Logs as JSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={handleClearLogs}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Clear all captured payload logs"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Telemetry Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1 text-xs font-mono">
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-sans">Total Requests</span>
            <span className="text-base font-bold text-white">{stats.total}</span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-emerald-400 block font-sans">Success (200 OK)</span>
            <span className="text-base font-bold text-emerald-400">{stats.success} ({stats.successRate}%)</span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-rose-400 block font-sans">Failures / Errors</span>
            <span className="text-base font-bold text-rose-400">{stats.failure}</span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-amber-400 block font-sans">429 Throttled</span>
            <span className="text-base font-bold text-amber-400">{stats.throttled429}</span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-cyan-400 block font-sans">Avg Latency (SLA)</span>
            <span className="text-base font-bold text-cyan-400">{stats.avgLatency}ms</span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-purple-400 block font-sans">Endpoint Split</span>
            <span className="text-[11px] font-bold text-slate-300">
              <span className="text-cyan-400">{stats.balanceCalls}B</span> · <span className="text-amber-400">{stats.betCalls}T</span> · <span className="text-emerald-400">{stats.winCalls}W</span>
            </span>
          </div>
        </div>

        {/* 2. Interactive Instant Test Trigger Bar */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 font-mono">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Instant Test Payload Triggers (Simulate Endpoints):</span>
            </div>
            {quickTestNotice && (
              <span className="text-[11px] text-cyan-400 font-mono animate-pulse font-bold">
                {quickTestNotice}
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-1.5 text-xs font-mono">
            {/* Success Cases */}
            <span className="text-[10px] text-slate-500 font-bold uppercase mr-1">Success:</span>
            <button
              onClick={() => runQuickEndpointTest('balance_200')}
              disabled={isExecutingQuickTest}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>/balance (200)</span>
            </button>

            <button
              onClick={() => runQuickEndpointTest('bet_200')}
              disabled={isExecutingQuickTest}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>/bet (200)</span>
            </button>

            <button
              onClick={() => runQuickEndpointTest('win_200')}
              disabled={isExecutingQuickTest}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>/win (200)</span>
            </button>

            <span className="text-slate-700 mx-1">|</span>

            {/* Failure Cases */}
            <span className="text-[10px] text-slate-500 font-bold uppercase mr-1">Failures:</span>
            <button
              onClick={() => runQuickEndpointTest('bet_422')}
              disabled={isExecutingQuickTest}
              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
              title="Test 422 Insufficient Funds error"
            >
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              <span>/bet (422 Low Balance)</span>
            </button>

            <button
              onClick={() => runQuickEndpointTest('bet_401')}
              disabled={isExecutingQuickTest}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
              title="Test 401 HMAC Signature Mismatch"
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span>/bet (401 Bad Sig)</span>
            </button>

            <button
              onClick={() => runQuickEndpointTest('win_404')}
              disabled={isExecutingQuickTest}
              className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
              title="Test 404 Round Not Found"
            >
              <Search className="w-3 h-3 text-purple-400" />
              <span>/win (404 No Round)</span>
            </button>

            <button
              onClick={() => runQuickEndpointTest('bet_429')}
              disabled={isExecutingQuickTest}
              className="px-2.5 py-1 rounded-lg bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
              title="Test 429 Rate Limit Exceeded"
            >
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              <span>/bet (429 Throttle)</span>
            </button>

            <button
              onClick={() => runQuickEndpointTest('win_504')}
              disabled={isExecutingQuickTest}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
              title="Test 504 SLA Timeout (>4000ms)"
            >
              <Clock className="w-3 h-3 text-slate-400" />
              <span>/win (504 Timeout)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Filters & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs font-mono">
        {/* Endpoint filter buttons */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0">
          <span className="text-slate-500 text-[10px] font-bold uppercase mr-1">Endpoint:</span>
          {(['all', 'balance', 'bet', 'win', 'refund'] as const).map((ep) => (
            <button
              key={ep}
              onClick={() => setEndpointFilter(ep)}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                endpointFilter === ep
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {ep === 'all' ? 'All Endpoints' : `/${ep}`}
            </button>
          ))}
        </div>

        {/* Status filter buttons */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0">
          <span className="text-slate-500 text-[10px] font-bold uppercase mr-1">Status:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('success')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'success'
                ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                : 'bg-slate-950 text-emerald-400 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            200 OK
          </button>
          <button
            onClick={() => setStatusFilter('errors')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'errors'
                ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                : 'bg-slate-950 text-rose-400 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            Errors (4xx/5xx)
          </button>
          <button
            onClick={() => setStatusFilter('429')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === '429'
                ? 'bg-rose-500/40 text-rose-200 border border-rose-500/60'
                : 'bg-slate-950 text-rose-400 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            429 Throttled
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px] flex-1 md:flex-initial">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search TxID, Round, Error..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      </div>

      {/* 4. Main Master-Detail Payload Log Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left List: Stream of Requests (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col h-[650px] shadow-lg">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400 border-b border-slate-800 pb-2 mb-2">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Captured Log Stream</span>
            </span>
            <span className="text-[10px] text-slate-500">
              Showing {filteredLogs.length} of {logs.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs scrollbar-thin scrollbar-thumb-slate-800">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <ListFilter className="w-10 h-10 mb-2 text-slate-600 animate-pulse" />
                <p className="text-xs font-bold text-slate-400">No matching logs found</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Adjust your search or click an Instant Test button above to capture a call.
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isSelected = selectedLog?.id === log.id;
                const is200 = log.statusCode === 200;
                const is429 = log.statusCode === 429;
                const is401 = log.statusCode === 401;
                const is422 = log.statusCode === 422;
                const is504 = log.statusCode === 504;

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-slate-950 border-cyan-500 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                        : is429
                        ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-400'
                        : !log.isSuccess
                        ? 'bg-rose-950/10 border-rose-500/20 hover:border-rose-400'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    {/* Header Row: Status, Method, Timestamp */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            is200
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : is429
                              ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                              : is401
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : is422
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {log.statusCode}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.endpoint === 'balance'
                              ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                              : log.endpoint === 'bet'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                              : log.endpoint === 'win'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                              : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          /{log.endpoint}
                        </span>

                        <span className="text-xs font-bold text-white">
                          {log.statusText}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                        <Clock className="w-3 h-3 text-slate-600" />
                        <span>{log.timeLabel}</span>
                      </div>
                    </div>

                    {/* Metadata Detail Row */}
                    <div className="text-[11px] space-y-0.5 text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="truncate max-w-[210px] text-slate-400">
                          {log.txId ? (
                            <span>Tx: <strong className="text-slate-200">{log.txId}</strong></span>
                          ) : (
                            <span>Provider: <strong className="text-slate-200">{log.providerId}</strong></span>
                          )}
                        </span>
                        <span
                          className={`font-bold ${
                            log.latencyMs > 3800
                              ? 'text-rose-400'
                              : log.latencyMs > 1000
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {log.latencyMs}ms
                        </span>
                      </div>

                      {log.amount !== undefined && (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">
                            Amount: <strong className="text-amber-300">{log.amount.toFixed(2)} {log.currency || 'USD'}</strong>
                          </span>
                          {log.isIdempotent && (
                            <span className="text-cyan-400 font-bold text-[9px] bg-cyan-500/10 px-1 py-0.2 rounded">
                              REPLAY (Cached)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Error snippet if present */}
                      {!log.isSuccess && (
                        <div className="text-[10px] text-rose-300 truncate pt-0.5 font-sans">
                          ⚠️ {log.errorMessage || log.statusText}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail: Full Inspector (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[650px] shadow-lg overflow-y-auto">
          {!selectedLog ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8">
              <Code2 className="w-12 h-12 mb-3 text-slate-600 animate-pulse" />
              <p className="text-sm font-bold text-slate-400 font-mono">Select a Log Record to Inspect</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm font-mono">
                Click on any HTTP /balance, /bet, or /win entry on the left to inspect raw request JSON, response JSON, and headers.
              </p>
            </div>
          ) : (
            <div className="space-y-4 flex-1 flex flex-col font-mono text-xs">
              {/* Header Status & Replay Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                      selectedLog.statusCode >= 200 && selectedLog.statusCode < 300
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : selectedLog.statusCode === 429
                        ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    HTTP {selectedLog.statusCode}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-white">{selectedLog.method}</div>
                    <div className="text-[10px] text-slate-400">{selectedLog.isoTimestamp}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 rounded text-[11px] font-bold ${
                      selectedLog.latencyMs > 3800
                        ? 'text-rose-400 bg-rose-500/10'
                        : selectedLog.latencyMs > 1000
                        ? 'text-amber-400 bg-amber-500/10'
                        : 'text-emerald-400 bg-emerald-500/10'
                    }`}
                  >
                    {selectedLog.latencyMs}ms latency
                  </span>

                  <button
                    onClick={() => handleReplayLog(selectedLog)}
                    disabled={isExecutingQuickTest}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-all disabled:opacity-50"
                    title="Re-execute this exact payload"
                  >
                    <RefreshCw className={`w-3 h-3 ${isExecutingQuickTest ? 'animate-spin' : ''}`} />
                    <span>Replay</span>
                  </button>
                </div>
              </div>

              {/* Diagnosis Alert Callout for Failures */}
              {!selectedLog.isSuccess && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-rose-400">
                    <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Failure Diagnosis: {selectedLog.statusText || 'ERROR'}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                    {selectedLog.errorMessage || selectedLog.responsePayload?.message || 'Transaction could not be completed.'}
                  </p>
                  {selectedLog.statusCode === 429 && (
                    <div className="text-[10px] text-amber-300 pt-1">
                      💡 <strong>Remediation:</strong> Token bucket exhausted. Ensure client respects <code>Retry-After: 1s</code> and avoids exceeding allowed RPS limit.
                    </div>
                  )}
                  {selectedLog.statusCode === 401 && (
                    <div className="text-[10px] text-amber-300 pt-1">
                      💡 <strong>Remediation:</strong> HMAC signature mismatch. Verify SHA-256 secret key matches <code>X-Secret-Key</code> and message follows <code>{'${timestamp}.${payload}'}</code>.
                    </div>
                  )}
                  {selectedLog.statusCode === 422 && (
                    <div className="text-[10px] text-amber-300 pt-1">
                      💡 <strong>Remediation:</strong> Insufficient balance. Prompt user to deposit or reduce bet stake.
                    </div>
                  )}
                  {selectedLog.statusCode === 404 && (
                    <div className="text-[10px] text-amber-300 pt-1">
                      💡 <strong>Remediation:</strong> Round not found. Ensure <code>/bet</code> is called first to open the round before settling <code>/win</code>.
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab Navigation */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setInspectorViewTab('split')}
                  className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                    inspectorViewTab === 'split' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Side-by-Side Payloads
                </button>
                <button
                  onClick={() => setInspectorViewTab('request')}
                  className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                    inspectorViewTab === 'request' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Request Body
                </button>
                <button
                  onClick={() => setInspectorViewTab('response')}
                  className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                    inspectorViewTab === 'response' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Response Body
                </button>
                <button
                  onClick={() => setInspectorViewTab('headers')}
                  className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                    inspectorViewTab === 'headers' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  HTTP Headers
                </button>
                <button
                  onClick={() => setInspectorViewTab('diagnostics')}
                  className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                    inspectorViewTab === 'diagnostics' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ACID Mutex
                </button>
              </div>

              {/* View 1: Side-by-Side Payloads */}
              {inspectorViewTab === 'split' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-[320px]">
                  {/* Request Column */}
                  <div className="flex flex-col bg-slate-950 rounded-xl border border-slate-800 p-3">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-900 text-[11px]">
                      <span className="font-bold text-amber-400 flex items-center gap-1">
                        <Send className="w-3 h-3 text-amber-400" />
                        <span>Request Payload (Sent)</span>
                      </span>
                      <button
                        onClick={() => handleCopy(JSON.stringify(selectedLog.requestPayload, null, 2), 'req_json')}
                        className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedKey === 'req_json' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="flex-1 overflow-x-auto text-[11px] text-amber-200/90 font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-900 max-h-[300px]">
                      {JSON.stringify(selectedLog.requestPayload, null, 2)}
                    </pre>
                  </div>

                  {/* Response Column */}
                  <div className="flex flex-col bg-slate-950 rounded-xl border border-slate-800 p-3">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-900 text-[11px]">
                      <span className={`font-bold flex items-center gap-1 ${selectedLog.isSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <Code2 className="w-3 h-3" />
                        <span>Response Payload ({selectedLog.statusCode})</span>
                      </span>
                      <button
                        onClick={() => handleCopy(JSON.stringify(selectedLog.responsePayload, null, 2), 'res_json')}
                        className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedKey === 'res_json' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre
                      className={`flex-1 overflow-x-auto text-[11px] font-mono p-2.5 rounded-lg border max-h-[300px] ${
                        selectedLog.isSuccess
                          ? 'text-emerald-300 bg-slate-900/60 border-slate-900'
                          : 'text-rose-300 bg-rose-950/20 border-rose-950/40'
                      }`}
                    >
                      {JSON.stringify(selectedLog.responsePayload, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* View 2: Full Request Body */}
              {inspectorViewTab === 'request' && (
                <div className="flex-1 flex flex-col bg-slate-950 rounded-xl border border-slate-800 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400">Full Request JSON Payload</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(selectedLog.requestPayload, null, 2), 'req_full')}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedKey === 'req_full' ? 'Copied to Clipboard' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="flex-1 overflow-x-auto text-xs text-amber-200 font-mono bg-slate-900/80 p-3 rounded-lg border border-slate-900 min-h-[260px]">
                    {JSON.stringify(selectedLog.requestPayload, null, 2)}
                  </pre>
                </div>
              )}

              {/* View 3: Full Response Body */}
              {inspectorViewTab === 'response' && (
                <div className="flex-1 flex flex-col bg-slate-950 rounded-xl border border-slate-800 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-bold ${selectedLog.isSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>
                      Full HTTP {selectedLog.statusCode} Response JSON Payload
                    </span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(selectedLog.responsePayload, null, 2), 'res_full')}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedKey === 'res_full' ? 'Copied to Clipboard' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre
                    className={`flex-1 overflow-x-auto text-xs font-mono p-3 rounded-lg border min-h-[260px] ${
                      selectedLog.isSuccess
                        ? 'text-emerald-200 bg-slate-900/80 border-slate-900'
                        : 'text-rose-200 bg-rose-950/20 border-rose-950/40'
                    }`}
                  >
                    {JSON.stringify(selectedLog.responsePayload, null, 2)}
                  </pre>
                </div>
              )}

              {/* View 4: HTTP Headers */}
              {inspectorViewTab === 'headers' && (
                <div className="flex-1 space-y-3">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                      HTTP Request Headers
                    </div>
                    <div className="space-y-1 text-xs">
                      {selectedLog.requestHeaders &&
                        Object.entries(selectedLog.requestHeaders).map(([k, v]) => (
                          <div key={k} className="flex justify-between py-1 border-b border-slate-900 gap-2">
                            <span className="text-slate-400">{k}:</span>
                            <span className="text-amber-300 break-all">{v}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      HTTP Response Headers
                    </div>
                    <div className="space-y-1 text-xs">
                      {selectedLog.responseHeaders &&
                        Object.entries(selectedLog.responseHeaders).map(([k, v]) => (
                          <div key={k} className="flex justify-between py-1 border-b border-slate-900 gap-2">
                            <span className="text-slate-400">{k}:</span>
                            <span className="text-emerald-300 break-all">{v}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* View 5: ACID Mutex & Database Diagnostics */}
              {inspectorViewTab === 'diagnostics' && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                    PostgreSQL Row-Lock &amp; ACID Mutex Details
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Row-Level Lock (FOR UPDATE):</span>
                      <span className="font-bold text-emerald-400">
                        {selectedLog.acidLockAcquired ? 'ACQUIRED & RELEASED' : 'BYPASSED'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Mutex Lock Hold Duration:</span>
                      <span className="font-bold text-cyan-400">
                        {selectedLog.rowLockDurationMs ? `${selectedLog.rowLockDurationMs}ms` : '< 1.0ms'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Cryptographic HMAC-SHA256:</span>
                      <span className="font-bold text-emerald-400">
                        {selectedLog.signatureValid ? 'VALIDATED' : 'FAILED / REJECTED'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Idempotency Ledger Cache:</span>
                      <span className="font-bold text-amber-400">
                        {selectedLog.isIdempotent ? 'CACHED REPLAY' : 'FRESH MUTATION'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
