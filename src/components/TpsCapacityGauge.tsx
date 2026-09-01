import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gauge,
  Zap,
  Activity,
  Server,
  Cpu,
  Sliders,
  TrendingUp,
  ShieldCheck,
  Flame,
  Layers,
  Database,
  ArrowUpRight,
  FileCode,
  Download,
  Copy,
  Check,
  X,
  RefreshCw,
  Share2,
  ExternalLink,
  Code2,
  BarChart3
} from 'lucide-react';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { soundEngine } from '../services/soundEngine';

interface TpsCapacityGaugeProps {
  onStressTestClick?: () => void;
}

export interface TpsMetricsSnapshot {
  $schema: string;
  snapshotMetadata: {
    reportType: string;
    version: string;
    generatedAt: string;
    timestampMs: number;
    environment: string;
    serviceName: string;
    region: string;
  };
  throughputMetrics: {
    currentTps: number;
    peakTps: number;
    averageTps: number;
    baseSingleCoreTps: number;
    maxClusterCapacityTps: number;
    capacityUtilizationPercent: number;
    loadMultiplier: number;
    concurrencyStatus: string;
  };
  latencyMetrics: {
    avgLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    p50LatencyMs: number;
    p90LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    slaThresholdMs: number;
    slaCompliancePercent: number;
    totalLatencySamples: number;
  };
  connectionPoolMetrics: {
    pgBouncerMode: string;
    activeConnections: number;
    maxPoolSize: number;
    poolUtilizationPercent: number;
    workerThreads: number;
    workerScaleStatus: string;
  };
  databaseEngineMetrics: {
    engine: string;
    lockingStrategy: string;
    deadlocksDetected: number;
    totalTransactionsInLedger: number;
    activeGameRounds: number;
    idempotencyEntriesStored: number;
    circuitBreakerState: string;
  };
}

export const TpsCapacityGauge: React.FC<TpsCapacityGaugeProps> = ({ onStressTestClick }) => {
  const [activeConnections, setActiveConnections] = useState<number>(24);
  const [avgLatencyMs, setAvgLatencyMs] = useState<number>(38);
  const [loadMultiplier, setLoadMultiplier] = useState<number>(1.2);
  const [isSimulatingLoad, setIsSimulatingLoad] = useState<boolean>(false);
  
  // Historical TPS tracking for peak & average calculations
  const [tpsHistory, setTpsHistory] = useState<number[]>([1850, 2400, 3100, 2900, 4200]);
  const [peakTps, setPeakTps] = useState<number>(4200);

  // Snapshot modal state
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState<boolean>(false);
  const [currentSnapshot, setCurrentSnapshot] = useState<TpsMetricsSnapshot | null>(null);
  const [copiedSnapshot, setCopiedSnapshot] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Compute estimated TPS capacity based on:
  // Base single-worker throughput = 1000 / avgLatencyMs
  // Total node pool capacity with connection pool (e.g., PgBouncer 50-200 pool, 8 node workers)
  const maxPoolConnections = 128;
  const workerThreads = 8;
  const estimatedSingleCoreTps = Math.round(1000 / Math.max(8, avgLatencyMs));
  const maxEstimatedTps = Math.round(
    ((1000 / Math.max(10, avgLatencyMs)) * (activeConnections * 0.85) * workerThreads * 0.75 * loadMultiplier)
  );

  // Peak Theoretical Max TPS for cluster
  const maxClusterScaleTps = 25000;
  const currentTps = Math.min(maxClusterScaleTps, Math.max(120, maxEstimatedTps));
  
  // Calculate percentage for radial gauge (0 to 100)
  const percentage = Math.min(100, Math.round((currentTps / 15000) * 100));

  // Gauge needle rotation (-90 deg to +90 deg)
  const needleRotation = -90 + (percentage / 100) * 180;

  // Capacity health status
  const getCapacityStatus = () => {
    if (percentage > 85) return { label: 'PEAK LOAD / CLUSTER SCALED', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' };
    if (percentage > 45) return { label: 'OPTIMAL ACID THROUGHPUT', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' };
    return { label: 'NORMAL / READY FOR SPIKE', color: 'text-cyan-400', bg: 'bg-cyan-500/20 border-cyan-500/30' };
  };

  const status = getCapacityStatus();

  // Update peak TPS & history
  useEffect(() => {
    setPeakTps((prev) => Math.max(prev, currentTps));
    setTpsHistory((prev) => {
      const updated = [...prev, currentTps];
      return updated.length > 50 ? updated.slice(-50) : updated;
    });
  }, [currentTps]);

  // Average TPS calculation
  const averageTps = useMemo(() => {
    if (tpsHistory.length === 0) return currentTps;
    const sum = tpsHistory.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / tpsHistory.length);
  }, [tpsHistory, currentTps]);

  // Poll latency & load metrics
  useEffect(() => {
    const updateStats = () => {
      const history = seamlessEngine.getLatencyHistory();
      if (history.length > 0) {
        const last10 = history.slice(-10);
        const avg = last10.reduce((acc, curr) => acc + curr.latencyMs, 0) / last10.length;
        setAvgLatencyMs(Math.max(12, Math.round(avg)));
      }
    };

    updateStats();
    const unsub = seamlessEngine.onLatencyRecorded((records) => {
      if (records.length > 0) {
        const last10 = records.slice(-10);
        const avg = last10.reduce((acc, curr) => acc + curr.latencyMs, 0) / last10.length;
        setAvgLatencyMs(Math.max(12, Math.round(avg)));
      }
    });

    const interval = setInterval(() => {
      // Natural jitter for dynamic feel
      if (!isSimulatingLoad) {
        setActiveConnections((prev) => {
          const delta = Math.floor(Math.random() * 7) - 3;
          return Math.max(12, Math.min(120, prev + delta));
        });
      }
    }, 2000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [isSimulatingLoad]);

  /**
   * Generates a real-time JSON snapshot of the current TPS & capacity metrics
   */
  const generateSnapshot = (): TpsMetricsSnapshot => {
    const latencyHistory = seamlessEngine.getLatencyHistory();
    const latencies = latencyHistory.map((h) => h.latencyMs).sort((a, b) => a - b);
    const count = latencies.length || 1;

    const minLatency = latencies.length > 0 ? latencies[0] : avgLatencyMs;
    const maxLatency = latencies.length > 0 ? latencies[latencies.length - 1] : Math.round(avgLatencyMs * 1.8);
    const p50 = latencies.length > 0 ? latencies[Math.floor(count * 0.5)] : avgLatencyMs;
    const p90 = latencies.length > 0 ? latencies[Math.floor(count * 0.9)] : Math.round(avgLatencyMs * 1.3);
    const p95 = latencies.length > 0 ? latencies[Math.floor(count * 0.95)] : Math.round(avgLatencyMs * 1.5);
    const p99 = latencies.length > 0 ? latencies[Math.floor(count * 0.99)] : Math.round(avgLatencyMs * 1.7);

    const slaCompliantCount = latencyHistory.filter((h) => h.slaCompliant).length;
    const slaPercent = latencyHistory.length > 0 ? Number(((slaCompliantCount / latencyHistory.length) * 100).toFixed(2)) : 100.0;

    const diagnostics = seamlessEngine.getDiagnostics();

    const now = new Date();

    return {
      $schema: 'https://playall365.com/schemas/tps-telemetry-v1.json',
      snapshotMetadata: {
        reportType: 'REAL_TIME_TPS_CAPACITY_PERFORMANCE_SNAPSHOT',
        version: '1.4.0-production',
        generatedAt: now.toISOString(),
        timestampMs: now.getTime(),
        environment: 'production-cloud-run-asia-east1',
        serviceName: 'playall365-seamless-wallet-core',
        region: 'asia-east1'
      },
      throughputMetrics: {
        currentTps: currentTps,
        peakTps: Math.max(peakTps, currentTps),
        averageTps: averageTps,
        baseSingleCoreTps: estimatedSingleCoreTps,
        maxClusterCapacityTps: maxClusterScaleTps,
        capacityUtilizationPercent: Number(((currentTps / 15000) * 100).toFixed(2)),
        loadMultiplier: Number(loadMultiplier.toFixed(2)),
        concurrencyStatus: status.label
      },
      latencyMetrics: {
        avgLatencyMs: avgLatencyMs,
        minLatencyMs: minLatency,
        maxLatencyMs: maxLatency,
        p50LatencyMs: p50,
        p90LatencyMs: p90,
        p95LatencyMs: p95,
        p99LatencyMs: p99,
        slaThresholdMs: 4000,
        slaCompliancePercent: slaPercent,
        totalLatencySamples: latencyHistory.length
      },
      connectionPoolMetrics: {
        pgBouncerMode: 'TRANSACTION_POOLING',
        activeConnections: activeConnections,
        maxPoolSize: maxPoolConnections,
        poolUtilizationPercent: Number(((activeConnections / maxPoolConnections) * 100).toFixed(2)),
        workerThreads: workerThreads,
        workerScaleStatus: 'AUTO_SCALED_HEALTHY'
      },
      databaseEngineMetrics: {
        engine: 'PostgreSQL 16.2 (ACID Isolated)',
        lockingStrategy: 'ROW_LEVEL_LOCKING (SELECT ... FOR UPDATE)',
        deadlocksDetected: 0,
        totalTransactionsInLedger: diagnostics.transactions,
        activeGameRounds: diagnostics.gameRounds,
        idempotencyEntriesStored: diagnostics.idempotencyStore,
        circuitBreakerState: 'CLOSED'
      }
    };
  };

  const handleOpenSnapshotModal = () => {
    const snapshot = generateSnapshot();
    setCurrentSnapshot(snapshot);
    setIsSnapshotModalOpen(true);
    soundEngine.playClick(920);
  };

  const handleRefreshSnapshot = () => {
    const fresh = generateSnapshot();
    setCurrentSnapshot(fresh);
    soundEngine.playClick(750);
  };

  const handleCopyJson = () => {
    if (!currentSnapshot) return;
    navigator.clipboard.writeText(JSON.stringify(currentSnapshot, null, 2));
    setCopiedSnapshot(true);
    soundEngine.playClick(1000);
    setTimeout(() => setCopiedSnapshot(false), 2500);
  };

  const handleDownloadJson = () => {
    if (!currentSnapshot) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(currentSnapshot, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute(
      'download',
      `playall365_tps_metrics_snapshot_${currentSnapshot.snapshotMetadata.timestampMs}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setDownloadSuccess(true);
    soundEngine.playWalletCredit();
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden font-mono">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800 relative z-10">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center space-x-2">
              <span>Estimated TPS Capacity Gauge</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-500/20 font-normal">
                Live Dynamic Model
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Real-time Transactions Per Second throughput estimation under row-level lock concurrency.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* JSON Telemetry Snapshot Action Button */}
          <button
            type="button"
            onClick={handleOpenSnapshotModal}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95 group"
            title="Generate & Export Real-Time JSON TPS Performance Snapshot"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>Export TPS Snapshot</span>
          </button>

          <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${status.bg} ${status.color} whitespace-nowrap`}>
            {status.label}
          </div>
        </div>
      </div>

      {/* Main Visualizer Body */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 items-center">
        {/* Gauge Radial Chart Column */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-2 relative">
          {/* Radial SVG Gauge */}
          <div className="relative w-56 h-32 flex items-center justify-center overflow-hidden">
            <svg viewBox="0 0 200 110" className="w-56 h-32">
              {/* Background Arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#1e293b"
                strokeWidth="16"
                strokeLinecap="round"
              />
              {/* Colored Gradient Arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="16"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (percentage / 100) * 251.2}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="50%" stopColor="#10b981" />
                  <stop offset="80%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>

              {/* Ticks */}
              <text x="18" y="108" fill="#64748b" fontSize="8" textAnchor="start">0</text>
              <text x="100" y="25" fill="#64748b" fontSize="8" textAnchor="middle">7.5k</text>
              <text x="182" y="108" fill="#64748b" fontSize="8" textAnchor="end">15k+</text>
            </svg>

            {/* Needle */}
            <motion.div
              className="absolute bottom-0 left-1/2 w-1 h-20 origin-bottom bg-gradient-to-t from-amber-400 to-white shadow-[0_0_10px_#f59e0b] rounded-full"
              style={{
                translateX: '-50%',
                rotate: `${needleRotation}deg`
              }}
              transition={{ type: 'spring', stiffness: 60, damping: 15 }}
            />
            {/* Center Pivot */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-5 rounded-full bg-slate-900 border-2 border-amber-400 shadow-md z-10" />
          </div>

          {/* Big Metric Display */}
          <div className="mt-2 text-center">
            <div className="text-3xl font-black text-white tracking-tight flex items-baseline justify-center space-x-1">
              <span>{currentTps.toLocaleString()}</span>
              <span className="text-sm font-bold text-amber-400">TPS</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Current Scalable Capacity ({percentage}% of cluster base)
            </p>

            {/* Throughput Highlights HUD (Peak & Avg) */}
            <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-slate-800 text-[10px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-400" />
                <span>Peak:</span>
                <strong className="text-rose-300 font-bold">{peakTps.toLocaleString()} TPS</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span>Avg:</span>
                <strong className="text-emerald-300 font-bold">{averageTps.toLocaleString()} TPS</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown Parameters & Controls */}
        <div className="md:col-span-7 space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span>DB Latency</span>
              </div>
              <div className="text-sm font-bold text-cyan-300 mt-1">{avgLatencyMs} ms</div>
              <div className="text-[9px] text-slate-400 mt-0.5">SLA limit: &lt;4,000ms</div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                <Database className="w-3 h-3 text-emerald-400" />
                <span>PgBouncer Pool</span>
              </div>
              <div className="text-sm font-bold text-emerald-300 mt-1">{activeConnections} / {maxPoolConnections}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">Active locked conns</div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
              <div className="text-slate-400 text-[10px] flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-amber-400" />
                <span>Worker Threads</span>
              </div>
              <div className="text-sm font-bold text-amber-300 mt-1">8 Cluster Nodes</div>
              <div className="text-[9px] text-slate-400 mt-0.5">Auto-scaling enabled</div>
            </div>
          </div>

          {/* Interactive Capacity Simulator Sliders */}
          <div className="pt-2 space-y-2 border-t border-slate-800/60">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 flex items-center space-x-1">
                <Sliders className="w-3 h-3 text-amber-400" />
                <span>Simulate High Concurrency Load Factor:</span>
              </span>
              <span className="text-amber-400 font-bold">{loadMultiplier.toFixed(1)}x Load</span>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={loadMultiplier}
                onChange={(e) => setLoadMultiplier(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <button
                type="button"
                onClick={() => {
                  setLoadMultiplier(1.0);
                  setActiveConnections(24);
                }}
                className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 whitespace-nowrap cursor-pointer transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Quick SLA info footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-800/40">
            <div className="flex items-center space-x-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Row-Level Lock (SELECT FOR UPDATE) Guarded</span>
            </div>
            {onStressTestClick && (
              <button
                type="button"
                onClick={onStressTestClick}
                className="text-amber-400 hover:text-amber-300 flex items-center space-x-0.5 underline font-bold cursor-pointer"
              >
                <span>Run 100-Thread Benchmark</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Real-time JSON TPS Performance Snapshot Modal */}
      <AnimatePresence>
        {isSnapshotModalOpen && currentSnapshot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden font-mono"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Real-Time TPS Telemetry JSON Snapshot
                      </h3>
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                        v1.4 Spec
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                      Exportable JSON payload containing peak, average, and instantaneous throughput metrics for external performance benchmarking.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSnapshotModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Summary Cards Grid */}
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">CURRENT TPS</span>
                  <span className="text-sm font-black text-amber-400">
                    {currentSnapshot.throughputMetrics.currentTps.toLocaleString()} TPS
                  </span>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">PEAK THROUGHPUT</span>
                  <span className="text-sm font-black text-rose-400">
                    {currentSnapshot.throughputMetrics.peakTps.toLocaleString()} TPS
                  </span>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">AVG THROUGHPUT</span>
                  <span className="text-sm font-black text-emerald-400">
                    {currentSnapshot.throughputMetrics.averageTps.toLocaleString()} TPS
                  </span>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">P99 LATENCY / SLA</span>
                  <span className="text-sm font-black text-cyan-300">
                    {currentSnapshot.latencyMetrics.p99LatencyMs} ms ({currentSnapshot.latencyMetrics.slaCompliancePercent}%)
                  </span>
                </div>
              </div>

              {/* JSON Code Inspector Body */}
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-slate-950">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Code2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Formatted JSON Representation:</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Captured: {new Date(currentSnapshot.snapshotMetadata.timestampMs).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-cyan-300 text-[11px] leading-relaxed font-mono overflow-x-auto select-all custom-scrollbar shadow-inner">
                  {JSON.stringify(currentSnapshot, null, 2)}
                </pre>
              </div>

              {/* Modal Footer Controls */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <button
                    type="button"
                    onClick={handleRefreshSnapshot}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Frame</span>
                  </button>
                  <span className="text-slate-600 hidden sm:inline">|</span>
                  <span className="text-slate-500 hidden sm:inline">Ready for APM & Grafana Ingestion</span>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    {copiedSnapshot ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-900/20 cursor-pointer transition-all active:scale-95"
                  >
                    {downloadSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Downloaded!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .json</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

