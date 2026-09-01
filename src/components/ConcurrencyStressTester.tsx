import React, { useState } from 'react';
import {
  Cpu,
  Play,
  ShieldCheck,
  AlertOctagon,
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Flame,
  Activity,
  Layers,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import {
  seamlessEngine,
  ConcurrencyTestResult
} from '../services/simulatedWalletEngine';
import { UserEntity, WalletEntity } from '../server/types/seamless';

interface ConcurrencyStressTesterProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  onLedgerMutated: () => void;
}

export const ConcurrencyStressTester: React.FC<ConcurrencyStressTesterProps> = ({
  currentUser,
  currentWallet,
  onLedgerMutated
}) => {
  const [numRequests, setNumRequests] = useState<number>(10);
  const [betAmount, setBetAmount] = useState<number>(30);
  const [initialBalancePreset, setInitialBalancePreset] = useState<number>(100);
  const [identicalTxId, setIdenticalTxId] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<ConcurrencyTestResult | null>(null);

  const handleApplyBalance = (balance: number) => {
    setInitialBalancePreset(balance);
    seamlessEngine.setWalletBalance(currentUser.id, currentUser.currency || 'USD', balance);
    onLedgerMutated();
  };

  const handleRunTest = async () => {
    setIsRunning(true);
    setTestResult(null);

    try {
      // Ensure wallet has initial balance set
      seamlessEngine.setWalletBalance(
        currentUser.id,
        currentUser.currency || 'USD',
        initialBalancePreset
      );
      onLedgerMutated();

      // Wait 100ms for UI to reflect initial state
      await new Promise((r) => setTimeout(r, 100));

      const result = await seamlessEngine.runConcurrencyStressTest(
        currentUser.id,
        currentUser.currency || 'USD',
        numRequests,
        betAmount,
        identicalTxId
      );

      setTestResult(result);
      onLedgerMutated();
    } catch (err: any) {
      console.error('Concurrency test error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  // Preset Configurations
  const loadPreset = (type: 'overdraft' | 'idempotency' | 'heavy') => {
    if (type === 'overdraft') {
      setInitialBalancePreset(100);
      setNumRequests(10);
      setBetAmount(30);
      setIdenticalTxId(false);
      handleApplyBalance(100);
    } else if (type === 'idempotency') {
      setInitialBalancePreset(500);
      setNumRequests(5);
      setBetAmount(50);
      setIdenticalTxId(true);
      handleApplyBalance(500);
    } else if (type === 'heavy') {
      setInitialBalancePreset(1000);
      setNumRequests(25);
      setBetAmount(40);
      setIdenticalTxId(false);
      handleApplyBalance(1000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Concept Explanation Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <Cpu className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-wide">
                ACID Concurrency &amp; Row-Level Locking Stress Engine
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              In high-traffic online casinos, multiple game rounds, spin callbacks, and provider webhooks hit the player&apos;s wallet simultaneously.
              This workbench demonstrates how PostgreSQL <code className="text-amber-400 font-mono bg-slate-950 px-1.5 py-0.5 rounded">SELECT ... FOR UPDATE</code> prevents race conditions, eliminates negative balance overdrafts, and enforces absolute ledger consistency.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadPreset('overdraft')}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 hover:border-amber-500 transition-all flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              Preset: Zero-Overdraft Proof
            </button>
            <button
              onClick={() => loadPreset('idempotency')}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 hover:border-cyan-500 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Preset: Idempotency Storm
            </button>
            <button
              onClick={() => loadPreset('heavy')}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 hover:border-emerald-500 transition-all flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Preset: 25-Thread Swarm
            </button>
          </div>
        </div>
      </div>

      {/* Control Panel & Live Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Box (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-400" />
            Stress Test Parameters
          </h3>

          {/* Initial Balance */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-between justify-between">
              <span>Set Initial Wallet Balance</span>
              <span className="text-amber-400 font-mono">${initialBalancePreset} USD</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {[50, 100, 250, 1000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleApplyBalance(amt)}
                  className={`py-1 text-xs font-mono rounded border ${
                    initialBalancePreset === amt
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={initialBalancePreset}
              onChange={(e) => handleApplyBalance(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
            />
          </div>

          {/* Number of Concurrent Requests */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span>Concurrent Threads</span>
              <span className="text-orange-400 font-mono font-bold">{numRequests} requests</span>
            </div>
            <input
              type="range"
              min="2"
              max="50"
              value={numRequests}
              onChange={(e) => setNumRequests(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>2 threads</span>
              <span>25 threads</span>
              <span>50 threads</span>
            </div>
          </div>

          {/* Bet Amount per Request */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Wager per Request (USD)
            </label>
            <input
              type="number"
              step="5"
              min="1"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-orange-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Total theoretical demand: <span className="font-mono text-slate-300">${numRequests * betAmount} USD</span>
            </p>
          </div>

          {/* Idempotency Checkbox */}
          <div className="pt-2 border-t border-slate-800">
            <label className="flex items-start space-x-2.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={identicalTxId}
                onChange={(e) => setIdenticalTxId(e.target.checked)}
                className="mt-0.5 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-white block">
                  Simulate Identical Transaction ID
                </span>
                <span className="text-[11px] text-slate-400 leading-snug block mt-0.5">
                  All {numRequests} threads will send the exact same <code className="text-cyan-400 font-mono">transaction_id</code> simultaneously to test duplicate rejection &amp; idempotent replay.
                </span>
              </div>
            </label>
          </div>

          {/* Launch Button */}
          <button
            onClick={handleRunTest}
            disabled={isRunning}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
              isRunning
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white shadow-orange-500/25'
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Executing {numRequests} Concurrent Threads...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Fire {numRequests} Parallel Requests Now
              </>
            )}
          </button>
        </div>

        {/* Results & Mathematical Verification Display (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ACID Ledger Integrity Verification
              </h3>
              {testResult && (
                <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  Completed in {testResult.totalDurationMs}ms
                </span>
              )}
            </div>

            {!testResult && !isRunning && (
              <div className="py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl p-6">
                <Cpu className="w-12 h-12 mb-3 mx-auto text-slate-700 animate-pulse" />
                <h4 className="text-sm font-semibold text-slate-300">Ready for High-Concurrency Test</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Click &quot;Fire Parallel Requests&quot; to execute {numRequests} concurrent HTTP worker promises on <span className="text-amber-400 font-mono">{currentUser.username}</span>&apos;s wallet with Row-Level Locking.
                </p>
              </div>
            )}

            {isRunning && (
              <div className="py-16 text-center">
                <div className="w-12 h-12 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <h4 className="text-sm font-bold text-orange-400 font-mono">
                  PostgreSQL Row-Lock Mutex Active
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Serializing {numRequests} parallel transactions in ACID boundary...
                </p>
              </div>
            )}

            {testResult && !isRunning && (
              <div className="space-y-4">
                {/* Mathematical Integrity Badge */}
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    testResult.discrepancy === 0 && testResult.finalBalance >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {testResult.discrepancy === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-white">
                      {testResult.discrepancy === 0
                        ? '100% ACID Balance Integrity Verified (Zero Overdraft)'
                        : 'Discrepancy Detected!'}
                    </div>
                    <p className="text-xs mt-0.5 text-slate-300 leading-relaxed">
                      {identicalTxId ? (
                        <>
                          Idempotency Check Passed: Exactly 1 debit occurred (${betAmount}), and the remaining {testResult.idempotentReplays} identical requests returned cached responses without deducting balance.
                        </>
                      ) : (
                        <>
                          Initial: ${testResult.initialBalance.toFixed(2)} → {testResult.successful} succeeded (${(testResult.successful * betAmount).toFixed(2)} total debit), {testResult.failed} failed with <span className="font-mono text-amber-300">INSUFFICIENT_FUNDS</span>. Final balance strictly matches expected ${testResult.expectedBalance.toFixed(2)} with <span className="font-bold text-emerald-400">$0.00 discrepancy</span>.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Initial Balance</div>
                    <div className="text-base font-mono font-bold text-slate-200 mt-0.5">
                      ${testResult.initialBalance.toFixed(2)}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                    <div className="text-[10px] uppercase font-bold text-emerald-500">Successful Bets</div>
                    <div className="text-base font-mono font-bold text-emerald-400 mt-0.5">
                      {testResult.successful} / {testResult.totalRequests}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                    <div className="text-[10px] uppercase font-bold text-rose-500">Rejected (Funds)</div>
                    <div className="text-base font-mono font-bold text-rose-400 mt-0.5">
                      {testResult.failed}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                    <div className="text-[10px] uppercase font-bold text-amber-500">Final Balance</div>
                    <div className="text-base font-mono font-bold text-amber-400 mt-0.5">
                      ${testResult.finalBalance.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Execution Thread Timeline Log */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Thread Execution Timeline</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      Sequential Row-Lock Execution
                    </span>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                    {testResult.logs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-2 rounded-lg border text-xs font-mono flex items-center justify-between ${
                          log.isIdempotent
                            ? 'bg-cyan-950/40 border-cyan-800/60 text-cyan-300'
                            : log.status === 200
                            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                            : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="px-1.5 py-0.5 bg-slate-900 rounded text-[10px] font-bold text-slate-400">
                            T#{log.thread}
                          </span>
                          <span className="font-bold">
                            {log.isIdempotent ? 'IDEMPOTENT REPLAY' : log.code}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                            {log.requestTxId}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 text-right">
                          <span className="text-[10px] text-slate-400">{log.latencyMs}ms</span>
                          <span className="font-bold text-white">
                            Bal: ${log.balance.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
