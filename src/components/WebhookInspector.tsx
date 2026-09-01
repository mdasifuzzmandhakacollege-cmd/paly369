import React, { useState, useEffect, useMemo } from 'react';
import {
  Webhook,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Play,
  Copy,
  Check,
  Filter,
  Trash2,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  Code2,
  FileJson,
  Layers,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Radio,
  Send,
  Lock,
  RefreshCw,
  Plus
} from 'lucide-react';
import { paymentGatewayEngine } from '../services/paymentGatewayEngine';
import { WebhookLog, PaymentProviderId } from '../server/types/paymentGateway';
import { soundEngine } from '../services/soundEngine';
import { webhookLogger } from '../services/webhookLogger';
import { Database } from 'lucide-react';

export const WebhookInspector: React.FC = () => {
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>(webhookLogger.getLogs());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'INVALID' | 'RETRIED'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Simulation Sandbox State
  const [simProvider, setSimProvider] = useState<PaymentProviderId>('bkash');
  const [simEventType, setSimEventType] = useState<string>('payment.success');
  const [simTamperSig, setSimTamperSig] = useState<boolean>(false);
  const [simPayload, setSimPayload] = useState<string>(
    JSON.stringify(
      {
        event: 'payment.success',
        trxID: `BK${Math.random().toString(36).substring(2, 8).toUpperCase()}99`,
        merchantInvoiceNumber: `DEP-20260822-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        amount: '2500.00',
        currency: 'BDT',
        senderNumber: '01928-384910',
        destinationAccount: '01900-112233',
        transactionStatus: 'Completed',
        timestamp: new Date().toISOString()
      },
      null,
      2
    )
  );

  // Subscribe to real-time WebhookLogger changes (syncs both memory and Firestore database)
  useEffect(() => {
    const unsub = webhookLogger.subscribe((logs) => {
      setWebhookLogs(logs);
    });
    return () => unsub();
  }, []);

  const showLocalToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    soundEngine.playClick();
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filtered Webhook list
  const filteredLogs = useMemo(() => {
    return webhookLogs.filter((log) => {
      // Provider filter
      if (providerFilter !== 'ALL' && log.provider !== providerFilter) {
        return false;
      }
      // Status filter
      if (statusFilter === 'VALID' && !log.signatureValid) return false;
      if (statusFilter === 'INVALID' && log.signatureValid) return false;
      if (statusFilter === 'RETRIED' && (!log.retryCount || log.retryCount === 0)) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesId = log.id.toLowerCase().includes(query);
        const matchesEventId = log.eventId.toLowerCase().includes(query);
        const matchesProvider = log.provider.toLowerCase().includes(query);
        const matchesEventType = (log.eventType || '').toLowerCase().includes(query);
        const matchesPayload = JSON.stringify(log.payload).toLowerCase().includes(query);
        const matchesSig = log.signature.toLowerCase().includes(query);
        return matchesId || matchesEventId || matchesProvider || matchesEventType || matchesPayload || matchesSig;
      }

      return true;
    });
  }, [webhookLogs, providerFilter, statusFilter, searchQuery]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = webhookLogs.length;
    const valid = webhookLogs.filter((w) => w.signatureValid).length;
    const invalid = total - valid;
    const retried = webhookLogs.filter((w) => (w.retryCount || 0) > 0).length;
    const avgLatency =
      total > 0
        ? Math.round(webhookLogs.reduce((acc, curr) => acc + (curr.latencyMs || 25), 0) / total)
        : 0;

    return { total, valid, invalid, retried, avgLatency };
  }, [webhookLogs]);

  // Handle Retry / Replay Webhook Event
  const handleRetryWebhook = async (webhookId: string) => {
    try {
      setRetryingId(webhookId);
      soundEngine.playClick();
      const result = await paymentGatewayEngine.reprocessWebhook(webhookId);
      showLocalToast(result.success ? 'Webhook re-processed & verified!' : 'Re-process failed: Invalid signature');
    } catch (err: any) {
      showLocalToast(`Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  // Preset Handlers for Simulator
  const applyPreset = (presetType: string) => {
    const now = new Date().toISOString();
    switch (presetType) {
      case 'bkash_success':
        setSimProvider('bkash');
        setSimEventType('payment.success');
        setSimTamperSig(false);
        setSimPayload(
          JSON.stringify(
            {
              event: 'payment.success',
              trxID: `BK${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              merchantInvoiceNumber: `DEP-20260822-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              amount: '5000.00',
              currency: 'BDT',
              senderNumber: '01712-334455',
              destinationAccount: '01900-112233',
              transactionStatus: 'Completed',
              timestamp: now
            },
            null,
            2
          )
        );
        break;

      case 'nagad_payout':
        setSimProvider('nagad');
        setSimEventType('payout.disbursed');
        setSimTamperSig(false);
        setSimPayload(
          JSON.stringify(
            {
              event: 'payout.disbursed',
              issuerTrxId: `NG_DISB_${Date.now()}`,
              orderId: `WTH-20260822-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              amount: '3500.00',
              currency: 'BDT',
              recipientAccount: '01844-992200',
              status: 'SUCCESS',
              timestamp: now
            },
            null,
            2
          )
        );
        break;

      case 'pgsoft_settle':
        setSimProvider('manual_channel' as any);
        setSimEventType('game.round_settled');
        setSimTamperSig(false);
        setSimPayload(
          JSON.stringify(
            {
              event: 'game.round_settled',
              provider: 'pgsoft',
              gameId: 'fortune-tiger',
              userId: 'u_10291',
              roundId: `RND_${Math.floor(10000000 + Math.random() * 90000000)}`,
              betAmount: 50,
              winAmount: 200,
              multiplier: 4.0,
              currency: 'BDT',
              timestamp: now
            },
            null,
            2
          )
        );
        break;

      case 'rocket_biller':
        setSimProvider('rocket');
        setSimEventType('payment.biller_confirmed');
        setSimTamperSig(false);
        setSimPayload(
          JSON.stringify(
            {
              event: 'payment.biller_confirmed',
              billerCode: 'DBBL_PLAY365_901',
              trxID: `RK${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              amount: '10000.00',
              currency: 'BDT',
              senderNumber: '01711-884422-9',
              timestamp: now
            },
            null,
            2
          )
        );
        break;

      case 'usdt_vault':
        setSimProvider('usdt_crypto');
        setSimEventType('crypto.block_confirmed');
        setSimTamperSig(false);
        setSimPayload(
          JSON.stringify(
            {
              event: 'crypto.block_confirmed',
              network: 'TRON_TRC20',
              txHash: `0x${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
              amountUSDT: '150.00',
              confirmations: 19,
              vaultAddress: 'TK89xVqLiveSeamlessCasinoCryptoVault99201',
              timestamp: now
            },
            null,
            2
          )
        );
        break;

      case 'tampered_attack':
        setSimProvider('bkash');
        setSimEventType('payment.tampered_attack');
        setSimTamperSig(true);
        setSimPayload(
          JSON.stringify(
            {
              event: 'payment.success',
              trxID: 'BK_HACKED_FAKE_99',
              merchantInvoiceNumber: 'DEP-FAKE-0000',
              amount: '100000.00',
              currency: 'BDT',
              senderNumber: '01700-000000',
              tamperPayloadNote: 'Simulated forged signature attack from untrusted IP',
              timestamp: now
            },
            null,
            2
          )
        );
        break;
    }
  };

  const handleSendSimulatedWebhook = async () => {
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(simPayload);
    } catch (e: any) {
      showLocalToast('Error: Invalid JSON Payload');
      return;
    }

    // Compute or fake signature
    const realSig = `sig_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    const usedSignature = simTamperSig ? '0000000000000000000000000000000000000000000000000000000000000000' : realSig;

    await paymentGatewayEngine.handleWebhook(simProvider, parsedPayload, usedSignature, {
      eventType: simEventType,
      expectedSignature: realSig
    });

    setIsSimulateModalOpen(false);
    showLocalToast(simTamperSig ? 'Simulated tampered webhook received (401 Rejected)' : 'Incoming webhook event received & processed (200 OK)');
    soundEngine.playWalletCredit();
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all webhook inspection logs?')) {
      paymentGatewayEngine.clearWebhookLogs();
      showLocalToast('Webhook logs cleared');
      soundEngine.playClick();
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(webhookLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `webhook-inspector-logs-${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showLocalToast('Logs exported as JSON');
  };

  const getProviderBadge = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'bkash':
        return 'bg-pink-500/20 text-pink-300 border-pink-500/40';
      case 'nagad':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'rocket':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'pgsoft':
      case 'pragmatic':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'usdt_crypto':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'bank_transfer':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header & Live Diagnostics Banner */}
      <div className="bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-2xl border border-cyan-500/40 shadow-inner">
              <Webhook className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-black text-white font-mono tracking-wide">
                  Webhook Inspector &amp; Replay Sandbox
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                  ● REALTIME LISTENER
                </span>
                <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  <Database className="w-3 h-3 text-purple-400" />
                  <span>WebhookLogger: /webhook_logs</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Intercepts and logs all incoming webhook payloads into the database for history tracking &amp; audit before display. Inspect headers, verify HMAC-SHA256 signatures, and replay failed callbacks.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setIsSimulateModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs font-mono flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Simulate Inbound Webhook</span>
            </button>

            <button
              onClick={handleExportJson}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Export Webhook Logs as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            <button
              onClick={handleClearAll}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 text-xs transition-all cursor-pointer"
              title="Clear all logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Diagnostic Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Inbound</span>
            <div className="text-xl font-black text-white mt-0.5">{stats.total}</div>
            <span className="text-[10px] text-cyan-400 block mt-0.5">Dispatched Events</span>
          </div>

          <div className="bg-slate-950/80 border border-emerald-500/30 p-3.5 rounded-2xl">
            <span className="text-[10px] text-emerald-400 uppercase font-bold block">Valid Signatures</span>
            <div className="text-xl font-black text-emerald-300 mt-0.5">
              {stats.valid} <span className="text-xs text-emerald-500/80">({stats.total ? Math.round((stats.valid / stats.total) * 100) : 100}%)</span>
            </div>
            <span className="text-[10px] text-emerald-400/70 block mt-0.5">HMAC-SHA256 Match</span>
          </div>

          <div className="bg-slate-950/80 border border-rose-500/30 p-3.5 rounded-2xl">
            <span className="text-[10px] text-rose-400 uppercase font-bold block">Invalid / Tampered</span>
            <div className="text-xl font-black text-rose-300 mt-0.5">{stats.invalid}</div>
            <span className="text-[10px] text-rose-400/70 block mt-0.5">HTTP 401 Rejections</span>
          </div>

          <div className="bg-slate-950/80 border border-amber-500/30 p-3.5 rounded-2xl">
            <span className="text-[10px] text-amber-400 uppercase font-bold block">Retried Replays</span>
            <div className="text-xl font-black text-amber-300 mt-0.5">{stats.retried}</div>
            <span className="text-[10px] text-amber-400/70 block mt-0.5">Re-processed</span>
          </div>

          <div className="bg-slate-950/80 border border-purple-500/30 p-3.5 rounded-2xl col-span-2 sm:col-span-1">
            <span className="text-[10px] text-purple-400 uppercase font-bold block">Avg Webhook SLA</span>
            <div className="text-xl font-black text-purple-300 mt-0.5">{stats.avgLatency} ms</div>
            <span className="text-[10px] text-purple-400/70 block mt-0.5">&lt; 4000ms SLA OK</span>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 font-mono text-xs">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search eventId, TrxID, signature, payload..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all font-mono"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-end">
          {/* Provider Select */}
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Providers (All)</option>
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="rocket">Rocket</option>
            <option value="pgsoft">PG Soft</option>
            <option value="usdt_crypto">USDT Crypto</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>

          {/* Status Filter */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['ALL', 'VALID', 'INVALID', 'RETRIED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  soundEngine.playClick();
                  setStatusFilter(st);
                }}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  statusFilter === st
                    ? st === 'VALID'
                      ? 'bg-emerald-500 text-slate-950'
                      : st === 'INVALID'
                      ? 'bg-rose-500 text-white'
                      : st === 'RETRIED'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Webhook Logs List */}
      <div className="space-y-3 font-mono">
        {filteredLogs.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
            <Webhook className="w-10 h-10 text-slate-600 mx-auto animate-pulse" />
            <h3 className="text-base font-bold text-slate-300">No Webhook Logs Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No matching webhook events found with current filter criteria. Use "Simulate Inbound Webhook" to fire a test callback.
            </p>
            <button
              onClick={() => setIsSimulateModalOpen(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold hover:bg-cyan-500/30 transition-all cursor-pointer inline-flex items-center space-x-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Simulate Webhook Now</span>
            </button>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedId === log.id;
            const isRetrying = retryingId === log.id;

            return (
              <div
                key={log.id}
                className={`bg-slate-900/90 border rounded-2xl transition-all overflow-hidden shadow-lg ${
                  log.signatureValid
                    ? 'border-slate-800 hover:border-emerald-500/40'
                    : 'border-rose-500/40 bg-rose-950/10 hover:border-rose-500/60'
                }`}
              >
                {/* Main Row Summary */}
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center space-x-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl border flex-shrink-0 ${
                        log.signatureValid
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {log.signatureValid ? (
                        <ShieldCheck className="w-5 h-5" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 animate-pulse" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-bold text-white text-xs">{log.eventId}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getProviderBadge(log.provider)}`}>
                          {log.provider}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {log.eventType || log.payload.event || 'payment.event'}
                        </span>
                        {log.retryCount && log.retryCount > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Retried {log.retryCount}x
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center flex-wrap gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </span>

                        <span className="text-slate-600">•</span>

                        <span className="flex items-center space-x-1">
                          <Zap className="w-3 h-3 text-cyan-400" />
                          <span>{log.latencyMs || 28}ms</span>
                        </span>

                        <span className="text-slate-600">•</span>

                        <span className={`font-bold ${log.httpStatus === 200 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          HTTP {log.httpStatus || (log.signatureValid ? 200 : 401)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center space-x-2 self-end lg:self-center">
                    {/* Retry Button */}
                    <button
                      onClick={() => handleRetryWebhook(log.id)}
                      disabled={isRetrying}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                        isRetrying
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 opacity-70 cursor-wait'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/30 hover:border-amber-400'
                      }`}
                      title="Simulate Re-processing Webhook Event"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                      <span>{isRetrying ? 'Replaying...' : 'Retry'}</span>
                    </button>

                    {/* Expand Details Toggle */}
                    <button
                      onClick={() => {
                        soundEngine.playClick();
                        setExpandedId(isExpanded ? null : log.id);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Detailed Inspection Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/90 p-4 sm:p-5 space-y-4 text-xs">
                    {/* Process Result Message Banner */}
                    <div
                      className={`p-3 rounded-xl border flex items-start space-x-2.5 ${
                        log.signatureValid
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {log.signatureValid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold">{log.processResult || (log.signatureValid ? 'Processed Successfully' : 'Signature Validation Failed')}</div>
                        {log.lastRetriedAt && (
                          <div className="text-[10px] opacity-80 mt-0.5">
                            Last retried: {new Date(log.lastRetriedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Signature Inspection Box */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-white font-bold">
                          <Lock className="w-4 h-4 text-cyan-400" />
                          <span>HMAC-SHA256 Signature Verification</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.signatureValid
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {log.signatureValid ? 'VALID SIGNATURE MATCH' : 'SIGNATURE MISMATCH / TAMPERED'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <div className="text-[10px] text-slate-400">Header Signature (X-Signature):</div>
                          <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800 text-[11px] text-slate-200 mt-1 font-mono break-all">
                            <span>{log.signature}</span>
                            <button
                              onClick={() => copyToClipboard(log.signature, `sig_${log.id}`)}
                              className="ml-2 p-1 text-slate-400 hover:text-white"
                            >
                              {copiedKey === `sig_${log.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {log.expectedSignature && (
                          <div>
                            <div className="text-[10px] text-slate-400">Expected Signature (Computed HMAC digest):</div>
                            <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800 text-[11px] text-slate-200 mt-1 font-mono break-all">
                              <span>{log.expectedSignature}</span>
                              <button
                                onClick={() => copyToClipboard(log.expectedSignature!, `exp_${log.id}`)}
                                className="ml-2 p-1 text-slate-400 hover:text-white"
                              >
                                {copiedKey === `exp_${log.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Headers & Payload Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Incoming HTTP Headers */}
                      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between text-white font-bold">
                          <span className="flex items-center space-x-1.5">
                            <Code2 className="w-4 h-4 text-purple-400" />
                            <span>HTTP Request Headers</span>
                          </span>
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(log.headers || {}, null, 2), `hdr_${log.id}`)}
                            className="text-[10px] text-slate-400 hover:text-white flex items-center space-x-1"
                          >
                            {copiedKey === `hdr_${log.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-purple-300 font-mono overflow-x-auto max-h-48 scrollbar-thin">
                          {JSON.stringify(log.headers || {}, null, 2)}
                        </pre>
                      </div>

                      {/* JSON Payload Body */}
                      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between text-white font-bold">
                          <span className="flex items-center space-x-1.5">
                            <FileJson className="w-4 h-4 text-emerald-400" />
                            <span>Inbound JSON Payload</span>
                          </span>
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(log.payload, null, 2), `pld_${log.id}`)}
                            className="text-[10px] text-slate-400 hover:text-white flex items-center space-x-1"
                          >
                            {copiedKey === `pld_${log.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-emerald-300 font-mono overflow-x-auto max-h-48 scrollbar-thin">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. SIMULATION MODAL */}
      {isSimulateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 sm:p-6 w-full max-w-2xl shadow-2xl space-y-5 font-mono">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Simulate Inbound Webhook Callback</h3>
                  <p className="text-[11px] text-slate-400">Fire a mock webhook request to test signature verification &amp; retry engine</p>
                </div>
              </div>
              <button
                onClick={() => setIsSimulateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Quick Presets Buttons */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Quick Presets:</span>
              <div className="flex items-center flex-wrap gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => applyPreset('bkash_success')}
                  className="px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-300 border border-pink-500/40 hover:bg-pink-500/30"
                >
                  bKash Payment (200 OK)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('nagad_payout')}
                  className="px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30"
                >
                  Nagad Payout Disbursed
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('rocket_biller')}
                  className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30"
                >
                  Rocket DBBL Callback
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('pgsoft_settle')}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30"
                >
                  PG Soft Round Settle
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('usdt_vault')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                >
                  USDT TRC-20 Vault
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('tampered_attack')}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 font-bold"
                >
                  ⚠️ Tampered Attack (401)
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Provider Adapter:</label>
                <select
                  value={simProvider}
                  onChange={(e) => setSimProvider(e.target.value as PaymentProviderId)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="bkash">bKash Tokenized</option>
                  <option value="nagad">Nagad Direct</option>
                  <option value="rocket">Rocket DBBL</option>
                  <option value="usdt_crypto">USDT TRC20</option>
                  <option value="bank_transfer">Bank Transfer (NPSB)</option>
                  <option value="card_payment">Card Gateway (3DS)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Event Type Header:</label>
                <input
                  type="text"
                  value={simEventType}
                  onChange={(e) => setSimEventType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Tamper Signature Toggle */}
            <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={simTamperSig}
                onChange={(e) => setSimTamperSig(e.target.checked)}
                className="rounded accent-rose-500 w-4 h-4"
              />
              <div className="text-xs">
                <span className="font-bold text-white">Simulate Tampered Signature (Man-in-the-Middle Attack)</span>
                <p className="text-[10px] text-slate-400">Injects an invalid HMAC hash to verify rejection with HTTP 401 Unauthorized</p>
              </div>
            </label>

            {/* JSON Payload Editor */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">JSON Payload Body:</label>
              <textarea
                rows={7}
                value={simPayload}
                onChange={(e) => setSimPayload(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-emerald-300 font-mono focus:outline-none focus:border-cyan-500 scrollbar-thin"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendSimulatedWebhook}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Webhook Callback</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Local Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 right-6 z-50 bg-slate-900/95 border border-cyan-500 text-cyan-300 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-mono flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
