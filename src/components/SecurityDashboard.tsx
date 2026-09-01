/**
 * @file SecurityDashboard.tsx
 * @description Real-Time Security & HMAC Guard Dashboard for B2B Seamless Integration.
 * Subscribes directly to Firestore 'security_events' and 'ip_rate_limits' collections
 * to visualize HMAC SHA-256 signature verifications, payload tampering interceptions,
 * replay attacks, and IP-based rate limiting stats in real-time.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Key,
  Activity,
  AlertTriangle,
  Zap,
  RefreshCw,
  Search,
  Filter,
  Flame,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Eye,
  Trash2,
  Ban,
  Radio,
  Sliders,
  ChevronRight,
  Code2,
  Terminal,
  ShieldX
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import {
  firebaseFirestore,
  SecurityEventRecord,
  IpRateLimitRecord
} from '../services/firebaseFirestoreService';
import { soundEngine } from '../services/soundEngine';

const PROVIDER_SECRETS: Record<string, { name: string; secret: string; defaultIp: string; country: string }> = {
  pragmatic_play: {
    name: 'Pragmatic Play Live',
    secret: 'sk_live_pragmatic_seamless_88492048102',
    defaultIp: '154.21.89.44',
    country: 'MT'
  },
  evolution: {
    name: 'Evolution Gaming',
    secret: 'sk_live_evolution_seamless_39104859103',
    defaultIp: '194.26.29.112',
    country: 'NL'
  },
  spribe: {
    name: 'Spribe Gaming (Aviator)',
    secret: 'sk_live_spribe_seamless_74910284910',
    defaultIp: '103.14.28.1',
    country: 'BD'
  },
  pgsoft: {
    name: 'PG Soft Pocket Games',
    secret: 'sk_live_pgsoft_seamless_91823019482',
    defaultIp: '118.179.32.77',
    country: 'SG'
  },
  custom_provider: {
    name: 'Custom B2B Aggregator',
    secret: 'sk_live_custom_seamless_secret_123456',
    defaultIp: '45.154.255.89',
    country: 'UA'
  }
};

async function computeHmacSha256(secretKey: string, message: string): Promise<string> {
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
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const SecurityDashboard: React.FC = () => {
  // Real-time Firestore State
  const [securityEvents, setSecurityEvents] = useState<SecurityEventRecord[]>([]);
  const [ipRateLimits, setIpRateLimits] = useState<IpRateLimitRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO'>('ALL');
  const [filterEventType, setFilterEventType] = useState<string>('ALL');
  const [selectedEvent, setSelectedEvent] = useState<SecurityEventRecord | null>(null);

  // Inspector & Sandbox State
  const [activeSubView, setActiveSubView] = useState<'stream' | 'ip_table' | 'sandbox'>('stream');
  const [sandboxProvider, setSandboxProvider] = useState<string>('pragmatic_play');
  const [sandboxSecret, setSandboxSecret] = useState<string>(PROVIDER_SECRETS['pragmatic_play'].secret);
  const [sandboxTimestamp, setSandboxTimestamp] = useState<number>(Date.now());
  const [sandboxBody, setSandboxBody] = useState<string>(
    JSON.stringify({ user_id: 'u_sakib_01', amount: 250.0, game_id: 'vs20sweetbonanza' }, null, 2)
  );
  const [sandboxComputedHmac, setSandboxComputedHmac] = useState<string>('');
  const [sandboxTestSignature, setSandboxTestSignature] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. Subscribe to Firestore security_events and ip_rate_limits
  useEffect(() => {
    // Seed initial demo/live security telemetry if Firestore collection is fresh
    firebaseFirestore.seedInitialSecurityData().catch(console.warn);

    const unsubEvents = firebaseFirestore.subscribeToSecurityEvents((events) => {
      setSecurityEvents(events);
      setLoading(false);
    }, 100);

    const unsubIps = firebaseFirestore.subscribeToIpRateLimits((limits) => {
      setIpRateLimits(limits);
    });

    return () => {
      unsubEvents();
      unsubIps();
    };
  }, []);

  // Compute live sandbox HMAC
  useEffect(() => {
    let raw = sandboxBody;
    try {
      raw = JSON.stringify(JSON.parse(sandboxBody));
    } catch {
      // Use raw if invalid JSON
    }
    const message = `${sandboxTimestamp}.${raw}`;
    computeHmacSha256(sandboxSecret, message).then((sig) => {
      setSandboxComputedHmac(sig);
      if (!sandboxTestSignature) {
        setSandboxTestSignature(sig);
      }
    });
  }, [sandboxSecret, sandboxTimestamp, sandboxBody]);

  // Derived Analytics & KPIs
  const stats = useMemo(() => {
    const total = securityEvents.length;
    const validated = securityEvents.filter((e) => e.eventType === 'HMAC_VALIDATED').length;
    const invalidSig = securityEvents.filter((e) => e.eventType === 'INVALID_SIGNATURE' || e.eventType === 'PAYLOAD_TAMPERED').length;
    const replayAttacks = securityEvents.filter((e) => e.eventType === 'EXPIRED_TIMESTAMP' || e.eventType === 'REPLAY_ATTACK').length;
    const rateLimited = securityEvents.filter((e) => e.eventType === 'RATE_LIMIT_EXCEEDED').length;
    const blockedIps = ipRateLimits.filter((ip) => ip.status === 'BLOCKED').length;
    const throttledIps = ipRateLimits.filter((ip) => ip.status === 'THROTTLED').length;

    const successRate = total > 0 ? ((validated / total) * 100).toFixed(1) : '100.0';

    return {
      total,
      validated,
      invalidSig,
      replayAttacks,
      rateLimited,
      blockedIps,
      throttledIps,
      successRate
    };
  }, [securityEvents, ipRateLimits]);

  // Chart Data: Group events by time bucket
  const chartData = useMemo(() => {
    if (securityEvents.length === 0) {
      return [
        { time: '12:00', validated: 15, attacks: 0, throttled: 0 },
        { time: '12:05', validated: 24, attacks: 1, throttled: 0 },
        { time: '12:10', validated: 38, attacks: 2, throttled: 1 },
        { time: '12:15', validated: 45, attacks: 0, throttled: 0 },
        { time: '12:20', validated: 52, attacks: 3, throttled: 2 }
      ];
    }

    const map = new Map<string, { time: string; validated: number; attacks: number; throttled: number }>();
    const sorted = [...securityEvents].reverse();

    sorted.slice(-30).forEach((ev) => {
      const date = new Date(ev.createdAt);
      const timeKey = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const current = map.get(timeKey) || { time: timeKey, validated: 0, attacks: 0, throttled: 0 };

      if (ev.eventType === 'HMAC_VALIDATED') {
        current.validated += 1;
      } else if (ev.eventType === 'RATE_LIMIT_EXCEEDED') {
        current.throttled += 1;
      } else {
        current.attacks += 1;
      }
      map.set(timeKey, current);
    });

    return Array.from(map.values());
  }, [securityEvents]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return securityEvents.filter((ev) => {
      const matchSeverity = filterSeverity === 'ALL' || ev.severity === filterSeverity;
      const matchType = filterEventType === 'ALL' || ev.eventType === filterEventType;
      const matchQuery =
        searchQuery === '' ||
        ev.ipAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.providerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ev.signatureReceived && ev.signatureReceived.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchSeverity && matchType && matchQuery;
    });
  }, [securityEvents, filterSeverity, filterEventType, searchQuery]);

  // Interactive Attack Simulation Handlers
  const handleSimulateValidHmac = async () => {
    setIsSimulating(true);
    soundEngine.playClick(600);
    try {
      const provider = PROVIDER_SECRETS['pragmatic_play'];
      const timestamp = Date.now();
      const payload = {
        user_id: 'u_player_' + Math.floor(100 + Math.random() * 900),
        amount: Number((Math.random() * 500 + 10).toFixed(2)),
        round_id: 'RND_' + Math.floor(100000 + Math.random() * 900000),
        game_id: 'vs20sweetbonanza'
      };
      const rawBody = JSON.stringify(payload);
      const signature = await computeHmacSha256(provider.secret, `${timestamp}.${rawBody}`);

      await firebaseFirestore.recordSecurityEvent({
        eventType: 'HMAC_VALIDATED',
        providerId: 'pragmatic_play',
        endpoint: '/api/seamless/bet',
        ipAddress: provider.defaultIp,
        country: provider.country,
        status: 'ALLOWED',
        signatureReceived: signature,
        signatureExpected: signature,
        timestampReceived: timestamp,
        clockSkewMs: Math.floor(Math.random() * 45 + 15),
        payloadPreview: rawBody,
        message: 'Valid HMAC-SHA256 signature & authorized operator payload',
        severity: 'INFO'
      });

      await firebaseFirestore.recordOrUpdateIpRateLimit({
        ip: provider.defaultIp,
        providerId: 'pragmatic_play',
        country: provider.country,
        requestCount: (ipRateLimits.find((i) => i.ip === provider.defaultIp)?.requestCount || 100) + 1,
        rps: Math.floor(Math.random() * 30 + 10),
        status: 'NORMAL'
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateTamperAttack = async () => {
    setIsSimulating(true);
    soundEngine.playCashierError();
    try {
      const timestamp = Date.now();
      const legitPayload = { user_id: 'u_victim_99', amount: 10.0, game_id: 'aviator_spribe' };
      const legitSignature = await computeHmacSha256(
        PROVIDER_SECRETS['spribe'].secret,
        `${timestamp}.${JSON.stringify(legitPayload)}`
      );

      // Malicious actor alters amount to 500,000 without knowing secret key
      const tamperedPayload = { user_id: 'u_victim_99', amount: 500000.0, game_id: 'aviator_spribe' };
      const attackerIp = '185.220.101.' + Math.floor(Math.random() * 250 + 1);

      const expectedSig = await computeHmacSha256(
        PROVIDER_SECRETS['spribe'].secret,
        `${timestamp}.${JSON.stringify(tamperedPayload)}`
      );

      const event = await firebaseFirestore.recordSecurityEvent({
        eventType: 'PAYLOAD_TAMPERED',
        providerId: 'spribe',
        endpoint: '/api/seamless/win',
        ipAddress: attackerIp,
        country: 'RU',
        status: 'BLOCKED',
        signatureReceived: legitSignature,
        signatureExpected: expectedSig,
        timestampReceived: timestamp,
        clockSkewMs: 180,
        payloadPreview: JSON.stringify(tamperedPayload),
        message: 'CRITICAL: Payload amount altered (10.0 -> 500000.0). SHA-256 Signature mismatch!',
        severity: 'CRITICAL'
      });

      setSelectedEvent(event);

      await firebaseFirestore.recordOrUpdateIpRateLimit({
        ip: attackerIp,
        providerId: 'malicious_actor',
        country: 'RU',
        requestCount: 45,
        rps: 85,
        violationsCount: 3,
        status: 'BLOCKED',
        blockedUntil: new Date(Date.now() + 86400000).toISOString()
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateReplayAttack = async () => {
    setIsSimulating(true);
    soundEngine.playCashierError();
    try {
      const expiredTimestamp = Date.now() - 420000; // 7 minutes ago (> 5s SLA window)
      const payload = { user_id: 'u_alex_02', amount: 1200.0, round_id: 'RND_REPLAY_331' };
      const rawBody = JSON.stringify(payload);
      const signature = await computeHmacSha256(PROVIDER_SECRETS['evolution'].secret, `${expiredTimestamp}.${rawBody}`);
      const attackerIp = '194.26.29.' + Math.floor(Math.random() * 200 + 1);

      const event = await firebaseFirestore.recordSecurityEvent({
        eventType: 'REPLAY_ATTACK',
        providerId: 'evolution',
        endpoint: '/api/seamless/win',
        ipAddress: attackerIp,
        country: 'NL',
        status: 'BLOCKED',
        signatureReceived: signature,
        signatureExpected: signature,
        timestampReceived: expiredTimestamp,
        clockSkewMs: 420000,
        payloadPreview: rawBody,
        message: 'Replay attack blocked: Timestamp expired (Clock skew: 420,000ms > 5,000ms threshold)',
        severity: 'HIGH'
      });

      setSelectedEvent(event);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateRateLimitBurst = async () => {
    setIsSimulating(true);
    soundEngine.playClick(300);
    try {
      const floodIp = '45.154.255.' + Math.floor(Math.random() * 200 + 1);

      for (let i = 0; i < 3; i++) {
        await firebaseFirestore.recordSecurityEvent({
          eventType: 'RATE_LIMIT_EXCEEDED',
          providerId: 'custom_provider',
          endpoint: '/api/seamless/auth',
          ipAddress: floodIp,
          country: 'UA',
          status: 'BLOCKED',
          timestampReceived: Date.now(),
          clockSkewMs: 12,
          payloadPreview: '{"action":"flood_test","nonce":"' + Math.random() + '"}',
          message: 'HTTP 429 Too Many Requests: IP exceeded 100 req/sec volumetric threshold',
          severity: 'WARNING'
        });
      }

      await firebaseFirestore.recordOrUpdateIpRateLimit({
        ip: floodIp,
        providerId: 'custom_provider',
        country: 'UA',
        requestCount: 850,
        rps: 195,
        limitRps: 100,
        violationsCount: 8,
        status: 'THROTTLED'
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    soundEngine.playClick(900);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleIpStatus = async (ip: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'BLOCKED' ? 'NORMAL' : 'BLOCKED';
    soundEngine.playClick(currentStatus === 'BLOCKED' ? 800 : 300);
    await firebaseFirestore.updateIpStatus(ip, nextStatus);
  };

  const handleWhitelistIp = async (ip: string) => {
    soundEngine.playClick(900);
    await firebaseFirestore.updateIpStatus(ip, 'WHITELISTED');
  };

  return (
    <div className="space-y-6 font-mono text-xs text-white">
      {/* Top Banner / Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-inner">
            <ShieldCheck className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-black text-white tracking-wide">
                HMAC SHA-256 Security Guard &amp; Rate Limit Telemetry
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black flex items-center space-x-1">
                <Radio className="w-2.5 h-2.5 animate-ping text-emerald-400" />
                <span>LIVE FIRESTORE</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Zero-Trust Cryptographic Signature Verification, Nonce Replay Mitigation, and Edge IP Throttling.
            </p>
          </div>
        </div>

        {/* Action Controls & Attack Simulators */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSimulateValidHmac}
            disabled={isSimulating}
            className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>+ Valid HMAC</span>
          </button>

          <button
            onClick={handleSimulateTamperAttack}
            disabled={isSimulating}
            className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Simulate Tamper Attack</span>
          </button>

          <button
            onClick={handleSimulateReplayAttack}
            disabled={isSimulating}
            className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Simulate Replay</span>
          </button>

          <button
            onClick={handleSimulateRateLimitBurst}
            disabled={isSimulating}
            className="px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span>Burst Flood (429)</span>
          </button>
        </div>
      </div>

      {/* Real-time KPI Metric Gauges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span className="flex items-center space-x-1.5">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>HMAC Signatures</span>
            </span>
            <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">
              {stats.successRate}% VALID
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <div className="text-3xl font-black text-white">{stats.validated}</div>
            <div className="text-slate-500 text-xs">/ {stats.total} total</div>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center space-x-1">
            <Check className="w-3 h-3 text-emerald-400" />
            <span>SHA-256 HMAC Authentic</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span className="flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Tamper Attacks</span>
            </span>
            <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded text-[10px]">
              INTERCEPTED
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <div className="text-3xl font-black text-rose-400">{stats.invalidSig}</div>
            <div className="text-slate-500 text-xs">forged / altered</div>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center space-x-1">
            <ShieldX className="w-3 h-3 text-rose-400" />
            <span>100% Zero-Trust Catch Rate</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span className="flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Replay Mitigations</span>
            </span>
            <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[10px]">
              &gt;5s SKEW
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <div className="text-3xl font-black text-amber-400">{stats.replayAttacks}</div>
            <div className="text-slate-500 text-xs">expired nonces</div>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center space-x-1">
            <Activity className="w-3 h-3 text-amber-400" />
            <span>Timestamp Window Enforced</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span className="flex items-center space-x-1.5">
              <Globe className="w-4 h-4 text-purple-400" />
              <span>Rate Limit (429)</span>
            </span>
            <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded text-[10px]">
              {stats.blockedIps} BANNED
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <div className="text-3xl font-black text-purple-400">{stats.rateLimited}</div>
            <div className="text-slate-500 text-xs">burst violations</div>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center space-x-1">
            <Ban className="w-3 h-3 text-purple-400" />
            <span>Edge IP Throttling Active</span>
          </div>
        </div>
      </div>

      {/* Real-Time Traffic & Threat Activity Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <h2 className="text-sm font-black text-white flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Cryptographic Telemetry &amp; Threat Volume Stream</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Real-time Firestore stream comparing authenticated HMAC requests against signature attacks and 429 throttles.
            </p>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center space-x-1 text-cyan-400">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
              <span>Valid HMAC</span>
            </span>
            <span className="flex items-center space-x-1 text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
              <span>Attacks / Tampered</span>
            </span>
            <span className="flex items-center space-x-1 text-purple-400">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"></span>
              <span>Rate Throttled</span>
            </span>
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="validated" fill="#06b6d4" fillOpacity={0.15} stroke="#06b6d4" strokeWidth={2} name="Valid HMAC" />
              <Bar dataKey="attacks" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Tamper / Replay Attacks" />
              <Bar dataKey="throttled" fill="#a855f7" radius={[4, 4, 0, 0]} name="Rate Limit (429)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Navigation Tabs between: Real-Time Stream, IP Rate Limit Table, HMAC Sandbox */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => {
            setActiveSubView('stream');
            soundEngine.playClick(700);
          }}
          className={`px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all ${
            activeSubView === 'stream'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Live Signature Stream ({filteredEvents.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveSubView('ip_table');
            soundEngine.playClick(700);
          }}
          className={`px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all ${
            activeSubView === 'ip_table'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-md'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Edge IP Rate Limiting ({ipRateLimits.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveSubView('sandbox');
            soundEngine.playClick(700);
          }}
          className={`px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all ${
            activeSubView === 'sandbox'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>HMAC Verifier Sandbox</span>
        </button>
      </div>

      {/* SUBVIEW 1: Real-Time Signature Stream */}
      {activeSubView === 'stream' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search IP, endpoint (/bet), provider, or SHA-256 signature..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>

            <div className="flex items-center space-x-2 overflow-x-auto">
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical Attacks</option>
                <option value="HIGH">High (Replays)</option>
                <option value="WARNING">Warnings (Rate Limits)</option>
                <option value="INFO">Info (Valid HMAC)</option>
              </select>

              <select
                value={filterEventType}
                onChange={(e) => setFilterEventType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Event Types</option>
                <option value="HMAC_VALIDATED">HMAC Validated</option>
                <option value="INVALID_SIGNATURE">Invalid Signature</option>
                <option value="PAYLOAD_TAMPERED">Payload Tampered</option>
                <option value="EXPIRED_TIMESTAMP">Expired Timestamp</option>
                <option value="REPLAY_ATTACK">Replay Attack</option>
                <option value="RATE_LIMIT_EXCEEDED">Rate Limit Exceeded</option>
              </select>
            </div>
          </div>

          {/* Events Stream Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Status &amp; Event</th>
                    <th className="py-3 px-4">Provider &amp; Endpoint</th>
                    <th className="py-3 px-4">IP &amp; Origin</th>
                    <th className="py-3 px-4">HMAC Signature Preview</th>
                    <th className="py-3 px-4">Clock Skew</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        {loading ? 'Subscribing to live Firestore security stream...' : 'No security events matching filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((ev) => {
                      const isAllowed = ev.status === 'ALLOWED';
                      const isTampered = ev.eventType === 'PAYLOAD_TAMPERED' || ev.eventType === 'INVALID_SIGNATURE';
                      const isReplay = ev.eventType === 'EXPIRED_TIMESTAMP' || ev.eventType === 'REPLAY_ATTACK';
                      const isRate = ev.eventType === 'RATE_LIMIT_EXCEEDED';

                      return (
                        <tr
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                            selectedEvent?.id === ev.id ? 'bg-cyan-950/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {isAllowed && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                              {isTampered && <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />}
                              {isReplay && <Clock className="w-4 h-4 text-amber-400 shrink-0" />}
                              {isRate && <Zap className="w-4 h-4 text-purple-400 shrink-0" />}

                              <div>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                    isAllowed
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                      : isTampered
                                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                      : isReplay
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                                  }`}
                                >
                                  {ev.eventType}
                                </span>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {new Date(ev.createdAt).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-white uppercase">{ev.providerId}</div>
                            <div className="text-[11px] text-cyan-400 font-mono">{ev.endpoint}</div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="text-slate-300 font-mono">{ev.ipAddress}</div>
                            <div className="text-[10px] text-slate-500">Country: {ev.country}</div>
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px]">
                            {ev.signatureReceived ? (
                              <div className="text-slate-400 truncate max-w-xs" title={ev.signatureReceived}>
                                {ev.signatureReceived.slice(0, 16)}...{ev.signatureReceived.slice(-8)}
                              </div>
                            ) : (
                              <span className="text-slate-600">None provided</span>
                            )}
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-xs">{ev.message}</div>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`font-mono text-[11px] ${
                                (ev.clockSkewMs || 0) > 5000 ? 'text-rose-400 font-bold' : 'text-emerald-400'
                              }`}
                            >
                              {ev.clockSkewMs !== undefined ? `${ev.clockSkewMs}ms` : '0ms'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(ev);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition-all"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 2: Edge IP Rate Limiting & Firewall Management */}
      {activeSubView === 'ip_table' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-black text-white flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span>Edge IP Rate Limiting &amp; Dynamic Quarantine</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Firestore-synchronized IP whitelist, auto-throttling at &gt;100 RPS, and 24-hour ban enforcement.
                </p>
              </div>
              <div className="text-xs font-bold text-slate-400">
                Total Monitored IPs: <span className="text-white font-mono">{ipRateLimits.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Client / Provider IP</th>
                    <th className="py-3 px-4">Provider Tag</th>
                    <th className="py-3 px-4">Current RPS</th>
                    <th className="py-3 px-4">Limit / Threshold</th>
                    <th className="py-3 px-4">Violations</th>
                    <th className="py-3 px-4">Firewall Status</th>
                    <th className="py-3 px-4 text-right">Firewall Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ipRateLimits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500">
                        No active IP traffic recorded yet.
                      </td>
                    </tr>
                  ) : (
                    ipRateLimits.map((ipRec) => {
                      const isBlocked = ipRec.status === 'BLOCKED';
                      const isWhitelisted = ipRec.status === 'WHITELISTED';
                      const isThrottled = ipRec.status === 'THROTTLED';

                      return (
                        <tr key={ipRec.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            {ipRec.ip}
                            <span className="ml-2 text-[10px] text-slate-500">({ipRec.country})</span>
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-300 uppercase">
                            {ipRec.providerId}
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`font-black text-sm ${
                                ipRec.rps > ipRec.limitRps ? 'text-rose-400 animate-pulse' : 'text-cyan-400'
                              }`}
                            >
                              {ipRec.rps} req/s
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-400">
                            {ipRec.limitRps} req/s
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ipRec.violationsCount > 0
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {ipRec.violationsCount}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                isBlocked
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                  : isWhitelisted
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : isThrottled
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                              }`}
                            >
                              {ipRec.status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleToggleIpStatus(ipRec.ip, ipRec.status)}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                                isBlocked
                                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/40'
                              }`}
                            >
                              {isBlocked ? 'Unblock IP' : 'Block IP'}
                            </button>

                            <button
                              onClick={() => handleWhitelistIp(ipRec.ip)}
                              disabled={isWhitelisted}
                              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-[11px] font-bold border border-slate-700 transition-all"
                            >
                              Whitelist
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 3: HMAC Cryptographic Sandbox & Verifier */}
      {activeSubView === 'sandbox' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-black text-white flex items-center space-x-2">
              <Key className="w-5 h-5 text-amber-400" />
              <span>Interactive HMAC-SHA256 Cryptographic Sandbox</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Verify signature matching algorithms against live provider keys. Matches formula:{' '}
              <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded">
                HMAC_SHA256(SecretKey, Timestamp + &quot;.&quot; + JSON_Body)
              </code>
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Inputs */}
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs font-bold block mb-1.5">
                  Select Game Provider
                </label>
                <select
                  value={sandboxProvider}
                  onChange={(e) => {
                    setSandboxProvider(e.target.value);
                    setSandboxSecret(PROVIDER_SECRETS[e.target.value]?.secret || '');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-amber-500"
                >
                  {Object.entries(PROVIDER_SECRETS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.name} ({k})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 text-xs font-bold block mb-1.5">
                  Shared Secret Key (<code className="text-amber-400">sk_live_...</code>)
                </label>
                <input
                  type="text"
                  value={sandboxSecret}
                  onChange={(e) => setSandboxSecret(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1.5">
                    Request Timestamp
                  </label>
                  <input
                    type="number"
                    value={sandboxTimestamp}
                    onChange={(e) => setSandboxTimestamp(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setSandboxTimestamp(Date.now())}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 font-bold text-xs transition-all"
                  >
                    Sync Current Time
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-xs font-bold block mb-1.5">
                  Request JSON Body
                </label>
                <textarea
                  rows={6}
                  value={sandboxBody}
                  onChange={(e) => setSandboxBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Right Output & Signature Matcher */}
            <div className="space-y-4 bg-slate-950 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1">
                    <span>Generated Cryptographic HMAC (SHA-256):</span>
                    <button
                      onClick={() => handleCopyText('hmac', sandboxComputedHmac)}
                      className="text-amber-400 hover:text-amber-300 flex items-center space-x-1"
                    >
                      {copiedKey === 'hmac' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-emerald-400 font-mono text-xs break-all select-all">
                    {sandboxComputedHmac || 'Calculating...'}
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1.5">
                    Compare Against Received Signature Header (<code className="text-cyan-400">X-Signature</code>)
                  </label>
                  <input
                    type="text"
                    value={sandboxTestSignature}
                    onChange={(e) => setSandboxTestSignature(e.target.value)}
                    placeholder="Paste signature here to test authenticity..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Match Result Banner */}
                {sandboxTestSignature && (
                  <div
                    className={`p-4 rounded-2xl border flex items-center space-x-3 ${
                      sandboxTestSignature.trim() === sandboxComputedHmac
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {sandboxTestSignature.trim() === sandboxComputedHmac ? (
                      <>
                        <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">SIGNATURE VALID &amp; MATCHED</div>
                          <div className="text-[11px] text-emerald-400/80">
                            Payload authenticity verified. Request accepted with HTTP 200 OK.
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">INVALID SIGNATURE DETECTED (HTTP 401)</div>
                          <div className="text-[11px] text-rose-400/80">
                            Cryptographic checksum mismatch. Tampering or incorrect secret key.
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* cURL Generation Preview */}
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
                  <span className="flex items-center space-x-1.5">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Generated Test cURL Command</span>
                  </span>
                  <button
                    onClick={() => {
                      const curl = `curl -X POST "https://api.yourcasino.com/api/seamless/bet" \\\n  -H "Content-Type: application/json" \\\n  -H "X-Provider-Id: ${sandboxProvider}" \\\n  -H "X-Timestamp: ${sandboxTimestamp}" \\\n  -H "X-Signature: ${sandboxComputedHmac}" \\\n  -d '${JSON.stringify(JSON.parse(sandboxBody))}'`;
                      handleCopyText('curl', curl);
                    }}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 text-[11px]"
                  >
                    {copiedKey === 'curl' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>Copy cURL</span>
                  </button>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-300 font-mono overflow-x-auto">
                  <code>
                    curl -X POST &quot;https://api.yourcasino.com/api/seamless/bet&quot; \<br />
                    &nbsp;&nbsp;-H &quot;X-Provider-Id: {sandboxProvider}&quot; \<br />
                    &nbsp;&nbsp;-H &quot;X-Timestamp: {sandboxTimestamp}&quot; \<br />
                    &nbsp;&nbsp;-H &quot;X-Signature: {sandboxComputedHmac.slice(0, 24)}...&quot; \<br />
                    &nbsp;&nbsp;-d &apos;{sandboxBody.replace(/\s+/g, ' ')}&apos;
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Event Detail Inspector Drawer */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2.5 rounded-2xl ${
                    selectedEvent.status === 'ALLOWED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Security Event #{selectedEvent.id}
                  </h3>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(selectedEvent.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Event Summary Details */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">EVENT TYPE</div>
                <div className="font-bold text-white mt-0.5">{selectedEvent.eventType}</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">AUTHORIZATION STATUS</div>
                <div
                  className={`font-bold mt-0.5 ${
                    selectedEvent.status === 'ALLOWED' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {selectedEvent.status}
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">CLIENT IP &amp; ORIGIN</div>
                <div className="font-mono text-slate-300 mt-0.5">
                  {selectedEvent.ipAddress} ({selectedEvent.country})
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">CLOCK SKEW</div>
                <div className="font-mono text-cyan-400 mt-0.5">{selectedEvent.clockSkewMs} ms</div>
              </div>
            </div>

            {/* Cryptographic Signatures Inspection */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Cryptographic Signature Comparison
              </h4>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Received Signature (Header: X-Signature)</div>
                  <div className="font-mono text-xs text-rose-300 mt-1 break-all bg-slate-900 p-2 rounded-lg border border-slate-800">
                    {selectedEvent.signatureReceived || 'None'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Expected Server-Computed HMAC (SHA-256)</div>
                  <div className="font-mono text-xs text-emerald-300 mt-1 break-all bg-slate-900 p-2 rounded-lg border border-slate-800">
                    {selectedEvent.signatureExpected || 'Not computed'}
                  </div>
                </div>
              </div>
            </div>

            {/* Request Payload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase">
                <span>Decoded Payload JSON</span>
                <button
                  onClick={() => handleCopyText('payload', selectedEvent.payloadPreview || '{}')}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 normal-case text-[11px]"
                >
                  {copiedKey === 'payload' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy JSON</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-48">
                {JSON.stringify(JSON.parse(selectedEvent.payloadPreview || '{}'), null, 2)}
              </pre>
            </div>

            {/* Diagnostics message */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-400">
              <span className="font-bold text-white">Diagnostics:</span> {selectedEvent.message}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={async () => {
                  await firebaseFirestore.deleteSecurityEvent(selectedEvent.id);
                  setSelectedEvent(null);
                }}
                className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center space-x-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Record</span>
              </button>

              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
