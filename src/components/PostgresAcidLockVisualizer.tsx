/**
 * @file PostgresAcidLockVisualizer.tsx
 * @description High-Tech Interactive PostgreSQL ACID Transaction State & Row-Level Locking Visualizer.
 * Displays real-time pg_locks, pg_stat_activity, MVCC tuple snapshot isolation, 2PL contention,
 * lock wait queues, and live deadlock cycle resolution.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  Zap,
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  RefreshCw,
  Play,
  RotateCcw,
  Clock,
  Layers,
  ChevronRight,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  Terminal,
  FileCode,
  Sliders,
  Radio,
  ArrowRight,
  Copy,
  Check,
  HardDrive,
  Info
} from 'lucide-react';
import {
  acidLockTrackerService,
  PostgresBackendSession,
  PostgresRowLock,
  LockHistoryEntry,
  AcidLockMetrics,
  LockMode
} from '../services/acidLockTrackerService';
import { soundEngine } from '../services/soundEngine';

interface PostgresAcidLockVisualizerProps {
  onRefreshParent?: () => void;
}

type VisualizerTab = 'locks_matrix' | 'simulator' | 'sessions' | 'history' | 'architecture';

export const PostgresAcidLockVisualizer: React.FC<PostgresAcidLockVisualizerProps> = ({
  onRefreshParent
}) => {
  const [activeTab, setActiveTab] = useState<VisualizerTab>('locks_matrix');
  const [trackerState, setTrackerState] = useState<{
    backends: PostgresBackendSession[];
    locks: PostgresRowLock[];
    history: LockHistoryEntry[];
    metrics: AcidLockMetrics;
  }>(() => acidLockTrackerService.getSnapshot());

  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
  const [historyActionFilter, setHistoryActionFilter] = useState<string>('ALL');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Custom Ad-hoc Row Lock Form
  const [customRelation, setCustomRelation] = useState<'wallets' | 'users' | 'transactions' | 'game_rounds'>('wallets');
  const [customTupleKey, setCustomTupleKey] = useState<string>('wallet:user_alpha:USD');
  const [customLockMode, setCustomLockMode] = useState<LockMode>('RowExclusiveLock (FOR UPDATE)');
  const [customHoldDurationMs, setCustomHoldDurationMs] = useState<number>(1500);

  // Subscribe to real-time ACID lock updates
  useEffect(() => {
    const unsub = acidLockTrackerService.subscribe((state) => {
      setTrackerState(state);
    });
    return () => unsub();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    soundEngine.playClick(800);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Run Scenario 1: High Concurrency Contention
  const handleRunConcurrencyContention = async (workerCount: number = 5) => {
    if (isSimulating) return;
    setIsSimulating(true);
    soundEngine.playClick(600);
    setSimulationMessage(`Launching ${workerCount} concurrent transactions targeting single row mutex...`);

    try {
      await acidLockTrackerService.simulateConcurrentContention(customTupleKey, workerCount);
      soundEngine.playWalletCredit();
      setSimulationMessage(`Successfully completed ${workerCount} sequential ACID transactions with zero race conditions.`);
    } catch (err: any) {
      setSimulationMessage(`Error: ${err.message}`);
    } finally {
      setIsSimulating(false);
      if (onRefreshParent) onRefreshParent();
      setTimeout(() => setSimulationMessage(null), 4500);
    }
  };

  // Run Scenario 2: Two-Phase Commit Distributed Transfer
  const handleRunTwoPhaseTransfer = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    soundEngine.playClick(700);
    setSimulationMessage('Executing Two-Phase Locking (2PL) distributed transfer on Wallet A and Wallet B in sorted order...');

    try {
      await acidLockTrackerService.simulateTwoPhaseTransfer('wallet:user_alpha:USD', 'wallet:user_beta:USD', 250);
      soundEngine.playWinChime();
      setSimulationMessage('2PL Transfer Committed: Both row locks acquired and released atomically without deadlocks.');
    } catch (err: any) {
      setSimulationMessage(`Error: ${err.message}`);
    } finally {
      setIsSimulating(false);
      if (onRefreshParent) onRefreshParent();
      setTimeout(() => setSimulationMessage(null), 4500);
    }
  };

  // Run Scenario 3: Deadlock Cycle & Auto-Resolution (40P01)
  const handleRunDeadlockCycle = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    soundEngine.playClick(400);
    setSimulationMessage('Simulating opposing lock cycle (Tx1: A->B, Tx2: B->A). PostgreSQL Deadlock Detector activated...');

    try {
      await acidLockTrackerService.simulateDeadlockDetection('wallet:vault_01:USD', 'wallet:vault_02:USD');
      soundEngine.playClick(900);
      setSimulationMessage('PostgreSQL Deadlock Detector fired! Aborted victim transaction with SQLSTATE 40P01. Survivor committed.');
    } catch (err: any) {
      setSimulationMessage(`Error: ${err.message}`);
    } finally {
      setIsSimulating(false);
      if (onRefreshParent) onRefreshParent();
      setTimeout(() => setSimulationMessage(null), 5000);
    }
  };

  // Run Scenario 4: MVCC Non-blocking Snapshot Read
  const handleRunMvccSnapshot = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    soundEngine.playClick(800);
    setSimulationMessage('Demonstrating PostgreSQL MVCC: SELECT reader executes simultaneously with UPDATE writer...');

    try {
      await acidLockTrackerService.simulateMvccSnapshotRead('wallet:player_maria:USD');
      soundEngine.playWalletCredit();
      setSimulationMessage('MVCC Snapshot Verified: Reader read consistent snapshot without blocking or waiting on RowExclusiveLock.');
    } catch (err: any) {
      setSimulationMessage(`Error: ${err.message}`);
    } finally {
      setIsSimulating(false);
      if (onRefreshParent) onRefreshParent();
      setTimeout(() => setSimulationMessage(null), 4500);
    }
  };

  // Custom Ad-hoc Lock Hold
  const handleAcquireCustomLock = () => {
    if (!customTupleKey.trim()) return;
    soundEngine.playClick(650);

    const release = acidLockTrackerService.registerLiveRowLock(
      customRelation,
      customTupleKey,
      customLockMode,
      `-- Custom Ad-Hoc Session\nSELECT * FROM ${customRelation} WHERE id = '${customTupleKey}' FOR UPDATE;`
    );

    setSimulationMessage(`Acquired ${customLockMode} on [${customTupleKey}] for ${customHoldDurationMs}ms.`);
    setTimeout(() => {
      release();
      setSimulationMessage(`Released lock on [${customTupleKey}].`);
      setTimeout(() => setSimulationMessage(null), 3000);
    }, customHoldDurationMs);
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return trackerState.history.filter((entry) => {
      const matchesSearch =
        entry.tupleKey.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        entry.details.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        String(entry.pid).includes(historySearchTerm) ||
        String(entry.xid).includes(historySearchTerm);

      const matchesFilter =
        historyActionFilter === 'ALL' || entry.action === historyActionFilter;

      return matchesSearch && matchesFilter;
    });
  }, [trackerState.history, historySearchTerm, historyActionFilter]);

  const { metrics, backends, locks } = trackerState;

  return (
    <div className="space-y-6">
      {/* Top Banner: ACID Status & Core Metrics */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10 border-b border-slate-800/80 pb-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-mono tracking-tight flex items-center gap-2">
                  <span>PostgreSQL ACID &amp; Row-Level Lock State</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Real-time pg_locks
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Real-time visibility into tuple mutexes, 2PL (Two-Phase Locking), MVCC snapshots, and deadlock resolution.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                soundEngine.playClick(600);
                acidLockTrackerService.resetToDefault();
                setSimulationMessage('Reset lock tracker and active sessions to baseline.');
                setTimeout(() => setSimulationMessage(null), 3000);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
              title="Reset Simulated PostgreSQL State"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset State</span>
            </button>

            <button
              onClick={() => {
                const diag = JSON.stringify(acidLockTrackerService.getSnapshot(), null, 2);
                handleCopy(diag, 'diagnostics');
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
              title="Copy JSON Diagnostics"
            >
              {copiedText === 'diagnostics' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{copiedText === 'diagnostics' ? 'Copied!' : 'Copy pg_locks'}</span>
            </button>
          </div>
        </div>

        {/* Live Simulation Alert Banner */}
        {simulationMessage && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-mono text-amber-200 animate-fadeIn">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
              <span>{simulationMessage}</span>
            </div>
            <button
              onClick={() => setSimulationMessage(null)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* 6 Quick KPI Gauges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Active Backends</span>
              <Activity className="w-3 h-3 text-blue-400" />
            </div>
            <div className="text-base font-extrabold text-blue-400 font-mono mt-1">
              {metrics.activeBackendsCount} <span className="text-[10px] text-slate-500 font-normal">sessions</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">pg_stat_activity</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Locks Held</span>
              <Lock className="w-3 h-3 text-amber-400" />
            </div>
            <div className="text-base font-extrabold text-amber-400 font-mono mt-1">
              {metrics.totalLocksHeld} <span className="text-[10px] text-slate-500 font-normal">tuples</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">RowExclusiveLock</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Wait Queue</span>
              <Clock className="w-3 h-3 text-rose-400" />
            </div>
            <div className={`text-base font-extrabold font-mono mt-1 ${metrics.lockWaitQueueLength > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {metrics.lockWaitQueueLength} <span className="text-[10px] text-slate-500 font-normal">blocked</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">2PL Mutex Waiters</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Avg Hold Time</span>
              <Zap className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="text-base font-extrabold text-emerald-400 font-mono mt-1">
              {metrics.averageLockDurationMs} <span className="text-[10px] text-slate-500 font-normal">ms</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Ultra-low Latency</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Deadlocks Resolved</span>
              <AlertTriangle className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="text-base font-extrabold text-cyan-400 font-mono mt-1">
              {metrics.deadlocksResolvedCount} <span className="text-[10px] text-slate-500 font-normal">resolved</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Auto 40P01 Recovery</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Isolation Mode</span>
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="text-xs font-extrabold text-emerald-400 font-mono mt-1">
              REPEATABLE READ
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Strict MVCC Validated</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-slate-800 font-mono text-xs">
        {[
          { id: 'locks_matrix', label: 'Active Row Locks (pg_locks)', count: locks.length, icon: Lock },
          { id: 'simulator', label: 'ACID Stress Lab & Scenarios', icon: Zap },
          { id: 'sessions', label: 'Backend Sessions (pg_stat_activity)', count: backends.length, icon: Cpu },
          { id: 'history', label: 'Lock Audit Stream', count: trackerState.history.length, icon: Activity },
          { id: 'architecture', label: '2PL & MVCC Specs', icon: Layers }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as VisualizerTab)}
              className={`px-3.5 py-2 rounded-t-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-amber-300 border-t-2 border-amber-500 border-x border-slate-800 shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] ${
                    isActive ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ACTIVE ROW LOCKS MATRIX (pg_locks) */}
      {activeTab === 'locks_matrix' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3 font-mono text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Current PostgreSQL Relation Locks:</span>
              <span className="font-bold text-amber-300">{locks.length} active tuple mutexes</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-400">Granularity:</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 text-[10px] font-bold">
                TUPLE / ROW-LEVEL
              </span>
              <span className="text-[11px] text-slate-400">Concurrency Model:</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-400 text-[10px] font-bold">
                2PL (Strict Two-Phase Locking)
              </span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Relation Table</th>
                    <th className="py-3 px-4">Locked Tuple Key</th>
                    <th className="py-3 px-4">Lock Mode</th>
                    <th className="py-3 px-4">Holder PID / XID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Wait Queue (Blocked)</th>
                    <th className="py-3 px-4">Lock Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {locks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-sans text-xs">
                        No active row locks currently held. The database is in an idle state.
                      </td>
                    </tr>
                  ) : (
                    locks.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
                            {l.relation}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-bold">{l.tupleKey}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              l.lockMode.includes('Exclusive')
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            {l.lockMode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          PID <span className="font-bold text-amber-400">{l.holderPid}</span> / XID{' '}
                          <span className="text-cyan-300 font-bold">{l.holderXid}</span>
                        </td>
                        <td className="py-3 px-4">
                          {l.granted ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              GRANTED (HOLDING)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                              WAITING
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {l.waitQueue.length === 0 ? (
                            <span className="text-slate-500 text-[11px]">0 queued</span>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                                {l.waitQueue.length} blocked
                              </span>
                              <span className="text-[10px] text-slate-400">
                                (PIDs: {l.waitQueue.map((w) => w.pid).join(', ')})
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {l.durationMs}ms
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ad-Hoc Row Lock Testing Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl font-mono text-xs space-y-3">
            <div className="flex items-center space-x-2 text-white font-bold">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Interactive Ad-Hoc Row Lock Dispatcher</span>
            </div>
            <p className="text-slate-400 font-sans text-xs">
              Simulate manually holding a PostgreSQL row lock on any arbitrary entity to observe wait queues and real-time contention.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1">Target Relation</label>
                <select
                  value={customRelation}
                  onChange={(e: any) => setCustomRelation(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-amber-500"
                >
                  <option value="wallets">wallets (balance rows)</option>
                  <option value="users">users (player accounts)</option>
                  <option value="transactions">transactions (ledger)</option>
                  <option value="game_rounds">game_rounds (rounds)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1">Tuple Primary Key</label>
                <input
                  type="text"
                  value={customTupleKey}
                  onChange={(e) => setCustomTupleKey(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                  placeholder="wallet:user_alpha:USD"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1">Lock Mode</label>
                <select
                  value={customLockMode}
                  onChange={(e: any) => setCustomLockMode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-amber-500"
                >
                  <option value="RowExclusiveLock (FOR UPDATE)">RowExclusiveLock (FOR UPDATE)</option>
                  <option value="AccessShareLock (SELECT)">AccessShareLock (SELECT)</option>
                  <option value="ExclusiveLock (UPDATE/INSERT)">ExclusiveLock (UPDATE/INSERT)</option>
                  <option value="ShareLock">ShareLock</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-400 mb-1">Hold Duration (ms)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={customHoldDurationMs}
                    onChange={(e) => setCustomHoldDurationMs(Number(e.target.value))}
                    min={200}
                    max={10000}
                    step={100}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleAcquireCustomLock}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg whitespace-nowrap cursor-pointer transition-all active:scale-95 shadow-md"
                  >
                    Acquire
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACID STRESS LAB & SCENARIOS */}
      {activeTab === 'simulator' && (
        <div className="space-y-6 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scenario 1: High Concurrency Contention */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                    SCENARIO 1
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> FIFO Guaranteed
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mt-2">
                  High-Concurrency Row Lock Contention (5 Parallel Bets)
                </h3>
                <p className="text-slate-400 font-sans text-xs mt-1">
                  Launches 5 concurrent worker threads trying to mutate the exact same player wallet at the same millisecond.
                  Demonstrates how PostgreSQL Two-Phase Locking queues transactions sequentially with zero double-spend or race condition bugs.
                </p>
              </div>

              <div className="pt-2">
                <button
                  disabled={isSimulating}
                  onClick={() => handleRunConcurrencyContention(5)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  <span>Execute 5 Concurrent Bet Transactions</span>
                </button>
              </div>
            </div>

            {/* Scenario 2: Two-Phase Commit Transfer */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                    SCENARIO 2
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> 2PL Enforced
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mt-2">
                  Two-Phase Locking (2PL) Distributed Balance Transfer
                </h3>
                <p className="text-slate-400 font-sans text-xs mt-1">
                  Locks Wallet A and Wallet B in deterministic lexicographical order (<code className="text-amber-300">id_a &lt; id_b</code>)
                  to perform a distributed balance transfer between players with zero risk of circular deadlock.
                </p>
              </div>

              <div className="pt-2">
                <button
                  disabled={isSimulating}
                  onClick={handleRunTwoPhaseTransfer}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  <span>Execute 2PL Deterministic Transfer</span>
                </button>
              </div>
            </div>

            {/* Scenario 3: Deadlock Cycle & 40P01 Error */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                    SCENARIO 3
                  </span>
                  <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Error 40P01 Trigger
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mt-2">
                  Circular Deadlock Simulation &amp; Automatic Recovery
                </h3>
                <p className="text-slate-400 font-sans text-xs mt-1">
                  Forces Tx1 to lock Row A then demand Row B, while Tx2 locks Row B then demands Row A.
                  PostgreSQL Deadlock Detector automatically catches the circular dependency, aborts the younger transaction (SQLSTATE 40P01), and permits the survivor to commit.
                </p>
              </div>

              <div className="pt-2">
                <button
                  disabled={isSimulating}
                  onClick={handleRunDeadlockCycle}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  <span>Simulate Deadlock Cycle &amp; Auto-Resolution</span>
                </button>
              </div>
            </div>

            {/* Scenario 4: MVCC Non-blocking Snapshot */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                    SCENARIO 4
                  </span>
                  <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> Non-blocking Reads
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mt-2">
                  MVCC Non-Blocking Snapshot Read Isolation
                </h3>
                <p className="text-slate-400 font-sans text-xs mt-1">
                  Demonstrates PostgreSQL Multi-Version Concurrency Control (MVCC). A long-running financial reporting audit read runs concurrently with high-frequency UPDATE transactions without acquiring exclusive locks or blocking player bets.
                </p>
              </div>

              <div className="pt-2">
                <button
                  disabled={isSimulating}
                  onClick={handleRunMvccSnapshot}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  <span>Execute Concurrent MVCC Read &amp; Write</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BACKEND SESSIONS (pg_stat_activity) */}
      {activeTab === 'sessions' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-white">Active PostgreSQL Backend Connections ({backends.length})</span>
              <span className="text-slate-400 text-[11px]">Database: playall_casino_db</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">PID</th>
                    <th className="py-3 px-4">XID</th>
                    <th className="py-3 px-4">Application Name</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4">Isolation Level</th>
                    <th className="py-3 px-4">Locks Held</th>
                    <th className="py-3 px-4">Current SQL Query</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {backends.map((b) => (
                    <tr key={b.pid} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-amber-400 font-bold">{b.pid}</td>
                      <td className="py-3 px-4 text-cyan-300 font-bold">{b.xid}</td>
                      <td className="py-3 px-4 text-white">{b.applicationName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.state === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : b.state === 'waiting_on_lock'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                              : b.state === 'idle_in_transaction'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {b.state.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{b.isolationLevel}</td>
                      <td className="py-3 px-4">
                        {b.heldLocks.length === 0 ? (
                          <span className="text-slate-500 text-[10px]">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {b.heldLocks.map((hl) => (
                              <span
                                key={hl}
                                className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px]"
                              >
                                {hl}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                        <code className="text-[11px] text-amber-200/90">{b.query}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LOCK AUDIT STREAM */}
      {activeTab === 'history' && (
        <div className="space-y-4 font-mono text-xs">
          {/* Controls: Search & Filter */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search PID, XID, tuple key, event details..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full sm:w-64"
                />
              </div>

              <select
                value={historyActionFilter}
                onChange={(e) => setHistoryActionFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Lock Events</option>
                <option value="LOCK_GRANTED">LOCK_GRANTED</option>
                <option value="WAIT_ENQUEUED">WAIT_ENQUEUED</option>
                <option value="LOCK_RELEASED">LOCK_RELEASED</option>
                <option value="DEADLOCK_DETECTED">DEADLOCK_DETECTED</option>
                <option value="COMMITTED">COMMITTED</option>
                <option value="ROLLED_BACK">ROLLED_BACK</option>
              </select>
            </div>

            <div className="text-[11px] text-slate-400">
              Showing <span className="font-bold text-white">{filteredHistory.length}</span> events
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">PID / XID</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Relation / Tuple</th>
                    <th className="py-3 px-4">Lock Mode</th>
                    <th className="py-3 px-4">Hold / Wait Time</th>
                    <th className="py-3 px-4">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No matching lock events found.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">{h.timeLabel}</td>
                        <td className="py-3 px-4 text-slate-300">
                          PID <span className="font-bold text-amber-400">{h.pid}</span> / XID{' '}
                          <span className="text-cyan-300">{h.xid}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              h.action === 'LOCK_GRANTED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : h.action === 'WAIT_ENQUEUED'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : h.action === 'LOCK_RELEASED'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : h.action === 'DEADLOCK_DETECTED'
                                ? 'bg-rose-500 text-white font-black animate-pulse'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {h.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-bold">{h.tupleKey}</td>
                        <td className="py-3 px-4 text-slate-300 text-[11px]">{h.lockMode}</td>
                        <td className="py-3 px-4 text-slate-400">{h.durationMs}ms</td>
                        <td className="py-3 px-4 text-slate-300 max-w-sm truncate">{h.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ARCHITECTURE SPECIFICATIONS */}
      {activeTab === 'architecture' && (
        <div className="space-y-6 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <span>PostgreSQL Two-Phase Locking (2PL) Protocol</span>
              </div>
              <p className="text-slate-300 font-sans text-xs leading-relaxed">
                Under Strict 2PL, each seamless bet or win transaction acquires a <code className="text-amber-300">ROW EXCLUSIVE (FOR UPDATE)</code> lock
                on the specific player's wallet row before checking funds and computing ledger deltas.
              </p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
                <div>1. <span className="text-amber-300">Phase 1 (Growing):</span> Locks acquired (<code className="text-white">SELECT ... FOR UPDATE</code>).</div>
                <div>2. <span className="text-emerald-300">Phase 2 (Shrinking):</span> All locks held until final <code className="text-white">COMMIT</code> or <code className="text-white">ROLLBACK</code>.</div>
                <div>3. <span className="text-blue-300">Determinism:</span> Zero race conditions, 100% linear serializability.</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span>Multi-Version Concurrency Control (MVCC)</span>
              </div>
              <p className="text-slate-300 font-sans text-xs leading-relaxed">
                PostgreSQL creates snapshot tuple versions with <code className="text-cyan-300">xmin</code> and <code className="text-cyan-300">xmax</code> transaction identifiers.
                Readers do not block writers, and writers do not block readers.
              </p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
                <div>• <span className="text-cyan-300">xmin:</span> XID of creating transaction.</div>
                <div>• <span className="text-cyan-300">xmax:</span> XID of deleting/updating transaction (0 if live).</div>
                <div>• <span className="text-emerald-300">Benefit:</span> High-throughput financial ledger without read locks.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
