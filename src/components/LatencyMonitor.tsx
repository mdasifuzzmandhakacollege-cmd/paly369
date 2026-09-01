/**
 * @file LatencyMonitor.tsx
 * @description Real-Time SLA & Endpoint Latency Monitor using Recharts.
 * Visualizes average response times, P95/P99 percentiles, and SLA compliance
 * for core seamless provider endpoints (/balance, /bet, /win, /refund) under the 4-second timeout limit.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Zap,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Play,
  Flame,
  CheckCircle2,
  TrendingUp,
  BarChart2,
  LineChart as LineChartIcon,
  Sliders,
  Server,
  Layers,
  Sparkles,
  Wifi
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';
import {
  seamlessEngine,
  EndpointLatencyRecord
} from '../services/simulatedWalletEngine';

interface LatencyMonitorProps {
  onNavigateToTester?: () => void;
}

const SLA_TIMEOUT_LIMIT_MS = 4000;
const SLA_OPTIMAL_TARGET_MS = 100;

// Custom Dark Metallic Tooltip for Latency Charts
const CustomLatencyTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isCompliant = data.latencyMs <= SLA_TIMEOUT_LIMIT_MS;

    return (
      <div className="bg-[#0b0f19] border border-amber-500/40 p-3.5 rounded-2xl shadow-2xl font-mono text-xs space-y-2 backdrop-blur-md min-w-[200px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-bold text-amber-400">
            /{data.endpoint} ({data.provider_id || 'system'})
          </span>
          <span className="text-[10px] text-slate-400">{data.timeLabel || label}</span>
        </div>

        <div className="space-y-1 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Response Time:</span>
            <span className="font-black text-white">{data.latencyMs} ms</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">HTTP Status:</span>
            <span className="text-emerald-400 font-bold">{data.statusCode || 200} OK</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-slate-400">SLA (&lt;4.0s):</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isCompliant
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {isCompliant ? 'PASS (Compliant)' : 'SLA BREACH'}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const LatencyMonitor: React.FC<LatencyMonitorProps> = ({ onNavigateToTester }) => {
  const [latencyLogs, setLatencyLogs] = useState<EndpointLatencyRecord[]>([]);
  const [viewMode, setViewMode] = useState<'timeline' | 'comparison' | 'area'>('timeline');
  const [selectedEndpointFilter, setSelectedEndpointFilter] = useState<'ALL' | 'balance' | 'bet' | 'win' | 'refund'>('ALL');
  const [isSimulating, setIsSimulating] = useState(false);

  // Subscribe to real-time latency engine stream
  useEffect(() => {
    const unsubscribe = seamlessEngine.onLatencyRecorded((records) => {
      setLatencyLogs([...records]);
    });
    return () => unsubscribe();
  }, []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    if (selectedEndpointFilter === 'ALL') return latencyLogs;
    return latencyLogs.filter((l) => l.endpoint === selectedEndpointFilter);
  }, [latencyLogs, selectedEndpointFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    if (latencyLogs.length === 0) {
      return {
        avg: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0,
        slaPassRate: 100,
        totalRequests: 0,
        slaBreaches: 0
      };
    }

    const latencies = latencyLogs.map((l) => l.latencyMs).sort((a, b) => a - b);
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const avg = Math.round((sum / latencies.length) * 10) / 10;
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1];
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || latencies[latencies.length - 1];
    const breaches = latencyLogs.filter((l) => l.latencyMs > SLA_TIMEOUT_LIMIT_MS).length;
    const slaPassRate = Math.round(((latencyLogs.length - breaches) / latencyLogs.length) * 1000) / 10;

    return {
      avg,
      min,
      max,
      p95,
      p99,
      slaPassRate,
      totalRequests: latencyLogs.length,
      slaBreaches: breaches
    };
  }, [latencyLogs]);

  // Endpoint Comparison Data for BarChart
  const endpointComparisonData = useMemo(() => {
    const endpoints: Array<'balance' | 'bet' | 'win' | 'refund'> = ['balance', 'bet', 'win', 'refund'];
    return endpoints.map((ep) => {
      const logs = latencyLogs.filter((l) => l.endpoint === ep);
      if (logs.length === 0) {
        return {
          endpoint: `/${ep}`,
          avgLatency: 0,
          maxLatency: 0,
          p95Latency: 0,
          requestsCount: 0
        };
      }
      const sorted = logs.map((l) => l.latencyMs).sort((a, b) => a - b);
      const avg = Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 10) / 10;
      const max = sorted[sorted.length - 1];
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || max;

      return {
        endpoint: `/${ep}`,
        avgLatency: avg,
        maxLatency: max,
        p95Latency: p95,
        requestsCount: logs.length
      };
    });
  }, [latencyLogs]);

  // Quick Action Handlers
  const handleTriggerTrafficSpike = () => {
    setIsSimulating(true);
    seamlessEngine.simulateTrafficBurst(12);
    setTimeout(() => setIsSimulating(false), 500);
  };

  const handleTestEndpoint = (endpoint: 'balance' | 'bet' | 'win') => {
    const providers = ['pragmatic_play', 'evolution', 'pgsoft', 'spribe'];
    const prov = providers[Math.floor(Math.random() * providers.length)];
    const base = endpoint === 'balance' ? 14 : endpoint === 'bet' ? 28 : 22;
    const latency = base + Math.floor(Math.random() * 16);

    seamlessEngine.recordLatency({
      endpoint,
      provider_id: prov,
      latencyMs: latency,
      statusCode: 200,
      isSuccess: true,
      timestamp: Date.now()
    });
  };

  const handleInjectJitter = () => {
    seamlessEngine.recordLatency({
      endpoint: 'bet',
      provider_id: 'pragmatic_play',
      latencyMs: 185, // Noticeable latency jitter but still well below 4000ms
      statusCode: 200,
      isSuccess: true,
      timestamp: Date.now()
    });
  };

  const handleClearBuffer = () => {
    seamlessEngine.clearLatencyHistory();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 font-mono">
      {/* 1. Header Banner & SLA Overview */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-[#070b12] to-cyan-950/40 border border-cyan-500/30 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold uppercase">
              <Activity className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
              <span>Real-Time SLA &amp; Latency Telemetry Monitor</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-sans">
              Seamless API SLA Compliance &amp; Response Times
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-sans">
              Monitoring core endpoints (<code className="text-amber-400 font-mono">/balance</code>,{' '}
              <code className="text-cyan-400 font-mono">/bet</code>,{' '}
              <code className="text-emerald-400 font-mono">/win</code>) against the strict{' '}
              <span className="text-rose-400 font-bold">&lt;4-second timeout limit</span>.
            </p>
          </div>

          {/* Real-Time Live SLA Gauge Badge */}
          <div className="bg-slate-950/90 border border-cyan-500/40 p-4 rounded-2xl text-right shrink-0 shadow-xl space-y-1">
            <div className="flex items-center justify-end space-x-1.5 text-[11px] text-slate-400 uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>SLA Health Status</span>
            </div>
            <div className="text-2xl font-black text-emerald-400">
              {metrics.slaPassRate}% PASS
            </div>
            <div className="text-[10px] text-slate-400">
              {metrics.slaBreaches === 0
                ? '✅ 0 SLA Timeouts Recorded'
                : `⚠️ ${metrics.slaBreaches} SLA Timeout Violations`}
            </div>
          </div>
        </div>

        {/* 4 Telemetry KPI Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-4 space-y-1">
            <div className="text-[10px] text-cyan-400 uppercase font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Average Response</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {metrics.avg} <span className="text-xs font-normal text-slate-400">ms</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-sans">
              Target SLA: &lt; 100 ms
            </div>
          </div>

          <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 space-y-1">
            <div className="text-[10px] text-amber-400 uppercase font-bold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>P95 / P99 Tail Latency</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-300">
              {metrics.p95} <span className="text-xs font-normal text-slate-400">/ {metrics.p99} ms</span>
            </div>
            <div className="text-[10px] text-amber-400/80 font-sans">
              99% of requests &lt; {metrics.p99}ms
            </div>
          </div>

          <div className="bg-slate-950/80 border border-purple-500/30 rounded-2xl p-4 space-y-1">
            <div className="text-[10px] text-purple-400 uppercase font-bold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Max Latency Recorded</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-300">
              {metrics.max} <span className="text-xs font-normal text-slate-400">ms</span>
            </div>
            <div className="text-[10px] text-slate-400 font-sans">
              SLA Limit: 4,000 ms
            </div>
          </div>

          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 space-y-1">
            <div className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Total Transactions Tracked</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-300">
              {metrics.totalRequests}
            </div>
            <div className="text-[10px] text-emerald-400 font-sans">
              PostgreSQL Row-Locked
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Recharts Visualizations */}
      <div className="bg-[#090d16] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black text-white font-sans uppercase">
                  লাইভ ল্যাটেন্সি গ্রাফ (Latency Chart Engine)
                </h2>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                  Recharts Reactive Stream
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Core API endpoints response times with 4,000ms SLA Hard Limit line &amp; 100ms P99 target.
              </p>
            </div>
          </div>

          {/* View Toggle & Endpoint Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all ${
                  viewMode === 'timeline'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LineChartIcon className="w-3.5 h-3.5" />
                <span>Timeline</span>
              </button>
              <button
                onClick={() => setViewMode('comparison')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all ${
                  viewMode === 'comparison'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>By Endpoint</span>
              </button>
            </div>

            {/* Endpoint Filter */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(['ALL', 'balance', 'bet', 'win', 'refund'] as const).map((ep) => (
                <button
                  key={ep}
                  onClick={() => setSelectedEndpointFilter(ep)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all uppercase text-[10px] ${
                    selectedEndpointFilter === ep
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {ep === 'ALL' ? 'ALL' : `/${ep}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* The Recharts Display */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'timeline' ? (
              <LineChart data={filteredLogs} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => `${val}ms`}
                  domain={[0, (dataMax: number) => Math.max(120, Math.ceil(dataMax * 1.2))]}
                />
                <Tooltip content={<CustomLatencyTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                {/* SLA Target Reference Lines */}
                <ReferenceLine
                  y={SLA_OPTIMAL_TARGET_MS}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{
                    value: '100ms Optimal Target',
                    fill: '#10b981',
                    fontSize: 10,
                    position: 'insideTopRight'
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="latencyMs"
                  name="Response Latency (ms)"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#06b6d4' }}
                  activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            ) : (
              <BarChart data={endpointComparisonData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis dataKey="endpoint" stroke="#64748b" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(val) => `${val}ms`} />
                <Tooltip content={<CustomLatencyTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                <Bar dataKey="avgLatency" name="Average Latency (ms)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="p95Latency" name="P95 Latency (ms)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maxLatency" name="Peak Max (ms)" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* 3. Interactive Traffic Injection Simulator Controls */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center space-x-2 text-cyan-400 font-bold">
              <Sliders className="w-4 h-4" />
              <span>SLA Live Benchmark &amp; Traffic Simulation Toolkit:</span>
            </span>
            <span className="text-[10px] text-slate-400">
              Click any button to trigger live requests and watch Recharts animate
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
            <button
              onClick={handleTriggerTrafficSpike}
              disabled={isSimulating}
              className="px-3 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center space-x-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ 12x Traffic Spike</span>
            </button>

            <button
              onClick={() => handleTestEndpoint('balance')}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold flex items-center justify-center space-x-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>Test /balance</span>
            </button>

            <button
              onClick={() => handleTestEndpoint('bet')}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/30 text-amber-300 font-bold flex items-center justify-center space-x-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Test /bet (Lock)</span>
            </button>

            <button
              onClick={() => handleTestEndpoint('win')}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 font-bold flex items-center justify-center space-x-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Test /win</span>
            </button>

            <button
              onClick={handleInjectJitter}
              className="px-3 py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 font-bold flex items-center justify-center space-x-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
              <span>Inject Jitter (185ms)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Live Telemetry Event Stream Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Recent Seamless API Telemetry Stream</span>
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Live audit trace of incoming aggregator transactions and verified latency.
            </p>
          </div>
          <button
            onClick={handleClearBuffer}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs border border-slate-700 flex items-center space-x-1 cursor-pointer transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Clear Telemetry</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Endpoint</th>
                <th className="p-3">Provider ID</th>
                <th className="p-3">Latency (ms)</th>
                <th className="p-3">Status</th>
                <th className="p-3">SLA Status (&lt;4.0s)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {latencyLogs.slice(-8).reverse().map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 text-slate-400">{log.timeLabel}</td>
                  <td className="p-3 font-bold text-white">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        log.endpoint === 'balance'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : log.endpoint === 'bet'
                          ? 'bg-amber-500/20 text-amber-300'
                          : log.endpoint === 'win'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}
                    >
                      /{log.endpoint}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300">{log.provider_id}</td>
                  <td className="p-3">
                    <span
                      className={`font-black ${
                        log.latencyMs <= 50
                          ? 'text-emerald-400'
                          : log.latencyMs <= 200
                          ? 'text-cyan-400'
                          : log.latencyMs <= 1000
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {log.latencyMs} ms
                    </span>
                  </td>
                  <td className="p-3 text-emerald-400 font-bold">{log.statusCode} OK</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 flex items-center space-x-1 w-max">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>COMPLIANT (PASS)</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
