import React, { useState } from 'react';
import {
  Layers,
  ShieldCheck,
  Zap,
  Clock,
  Lock,
  ArrowRight,
  Database,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  GitCommit
} from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  const [activeDiagram, setActiveDiagram] = useState<'bet_win' | 'refund' | 'concurrency'>('bet_win');

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-900/40 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 mb-3">
          <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Layers className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              B2B iGaming Seamless Wallet Architecture Blueprint
            </h2>
            <p className="text-xs text-purple-300 font-mono">
              High-Frequency Financial Ledger Design for Casino, Slots &amp; Live Dealer Platforms
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          In modern online gaming platforms, the <strong>Seamless Wallet</strong> model ensures that players do not need to manually transfer chips into individual game vendor sub-wallets. The game provider calls the platform operator directly on every bet, spin, win, and round settlement. Every call executes an atomic ACID transaction backed by PostgreSQL row locks and HMAC verification.
        </p>
      </div>

      {/* Core Architectural Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pillar 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
          <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 w-max">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">PostgreSQL Row-Level Locking</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Executing <code className="text-amber-400 font-mono">SELECT ... FOR UPDATE OF wallets</code> locks the player&apos;s specific balance row for the transaction duration. Concurrent bets from multiple browser tabs or lightning-fast crash games queue sequentially, completely preventing double-spend and negative overdrafts.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-max">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">HMAC-SHA256 &amp; Anti-Replay</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Incoming provider webhooks pass a cryptographic digest generated via <code className="text-emerald-400 font-mono">HMAC-SHA256(timestamp + &quot;.&quot; + rawBody, secret)</code>. Timing-safe comparison prevents side-channel analysis, while a strict 300s window defeats replay attacks.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 w-max">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Idempotency &amp; Strict &lt;4s SLA</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            If network hiccups occur, providers retry with the same <code className="text-blue-400 font-mono">transaction_id</code>. An in-memory cache and unique database constraint guarantee that retried requests return the identical original balance response without double deductions.
          </p>
        </div>
      </div>

      {/* Interactive Sequence Diagram Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Interactive Sequence Flow Diagrams
            </h3>
            <p className="text-xs text-slate-400">
              Select a protocol flow below to observe the step-by-step transaction exchange.
            </p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveDiagram('bet_win')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeDiagram === 'bet_win'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Standard Bet → Win
            </button>
            <button
              onClick={() => setActiveDiagram('refund')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeDiagram === 'refund'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Timeout → Refund Rollback
            </button>
            <button
              onClick={() => setActiveDiagram('concurrency')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeDiagram === 'concurrency'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Row-Level Lock Race Resolution
            </button>
          </div>
        </div>

        {/* Diagram 1: Bet -> Win Flow */}
        {activeDiagram === 'bet_win' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-300">
              The lifecycle of a single game round in a slot spin or roulette bet:
            </div>
            <div className="space-y-3 font-mono text-xs">
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex items-start gap-3">
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold mt-0.5">
                  STEP 1
                </span>
                <div className="flex-1">
                  <div className="text-white font-bold">Game Provider calls POST /balance</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Game client initializes and verifies player session, currency (USD), and active status.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex items-start gap-3">
                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[10px] font-bold mt-0.5">
                  STEP 2
                </span>
                <div className="flex-1">
                  <div className="text-white font-bold">Player spins → Provider sends POST /bet ($20)</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    1. HMAC signature verified → 2. Row locked via <code className="text-amber-400 font-mono">SELECT ... FOR UPDATE</code> → 3. Real balance deducted ($100 → $80) → 4. Ledger record inserted → 5. Transaction committed and returned in &lt;45ms.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex items-start gap-3">
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold mt-0.5">
                  STEP 3
                </span>
                <div className="flex-1">
                  <div className="text-white font-bold">Spin settles → Provider sends POST /win ($55)</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    1. Links to original bet transaction ID → 2. Balance credited ($80 → $135) → 3. Game round marked SETTLED with net profit (+$35) → 4. Response returned to provider.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Diagram 2: Refund Flow */}
        {activeDiagram === 'refund' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-300">
              Graceful error recovery when a provider socket drops or game round aborts:
            </div>
            <div className="space-y-3 font-mono text-xs">
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex items-start gap-3">
                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[10px] font-bold mt-0.5">
                  STEP 1
                </span>
                <div className="flex-1">
                  <div className="text-white font-bold">Bet is deducted on platform ($50 debit)</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Player placed a bet on live roulette, balance reduced from $500 to $450.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex items-start gap-3">
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold mt-0.5">
                  STEP 2
                </span>
                <div className="flex-1">
                  <div className="text-white font-bold">Provider Live Stream crashes / Spin Cancelled</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Provider cancels the round due to hardware malfunction or timeout.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex items-start gap-3">
                <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-[10px] font-bold mt-0.5">
                  STEP 3
                </span>
                <div className="flex-1">
                  <div className="text-white font-bold">Provider calls POST /refund with reference_transaction_id</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    1. Operator locates original BET transaction → 2. Verifies not already refunded → 3. Restores $50 back to balance ($450 → $500) → 4. Inserts REFUND audit log.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Diagram 3: Concurrency Flow */}
        {activeDiagram === 'concurrency' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-300">
              How PostgreSQL row locks serialize simultaneous requests to prevent overdrafts:
            </div>
            <div className="space-y-3 font-mono text-xs">
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <div className="text-amber-400 font-bold mb-1">State: Player Balance = $50.00</div>
                <div className="text-slate-400 text-[11px]">
                  Two concurrent requests arrive at the exact same millisecond: Thread A ($30 bet) and Thread B ($30 bet).
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-emerald-950/30 border border-emerald-800/60 p-3 rounded-lg">
                  <div className="text-emerald-400 font-bold">Thread A (Acquires Lock First)</div>
                  <div className="text-slate-400 text-[11px] mt-1 space-y-0.5">
                    <div>1. Executes <code className="text-emerald-300 font-mono">FOR UPDATE</code> on wallet row</div>
                    <div>2. Checks: $50 &gt;= $30 (PASS)</div>
                    <div>3. Updates balance: $50 → $20</div>
                    <div>4. COMMITS &amp; Releases lock</div>
                    <div className="text-emerald-300 font-bold mt-1">Result: 200 OK ($20 balance)</div>
                  </div>
                </div>

                <div className="bg-rose-950/30 border border-rose-800/60 p-3 rounded-lg">
                  <div className="text-rose-400 font-bold">Thread B (Waits on Row Lock)</div>
                  <div className="text-slate-400 text-[11px] mt-1 space-y-0.5">
                    <div>1. Blocked until Thread A commits</div>
                    <div>2. Thread A finishes, Lock acquired</div>
                    <div>3. Reads fresh balance: $20 &lt; $30 (FAIL)</div>
                    <div>4. ROLLS BACK transaction</div>
                    <div className="text-rose-300 font-bold mt-1">Result: 400 INSUFFICIENT_FUNDS</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center text-emerald-400 font-bold">
                ✓ Balance stays strictly at $20.00 with ZERO negative overdraft!
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Latency Budget & Production Tuning Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          Strict 4-Second Provider SLA Latency Budget
        </h3>
        <p className="text-xs text-slate-300">
          Most major tier-1 game providers (Evolution, Pragmatic, Playtech) enforce a <strong>4000ms socket timeout</strong>. If the operator takes &gt;4s to respond to a bet, the provider drops the socket and logs a critical incident.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-500 text-[10px] uppercase">1. Network Transit</div>
            <div className="text-emerald-400 font-bold text-sm mt-0.5">~15 - 30ms</div>
            <div className="text-[10px] text-slate-500 mt-1">Regional edge proxies</div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-500 text-[10px] uppercase">2. HMAC Verification</div>
            <div className="text-emerald-400 font-bold text-sm mt-0.5">&lt; 1ms</div>
            <div className="text-[10px] text-slate-500 mt-1">Node crypto buffer</div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-500 text-[10px] uppercase">3. PG Row Lock + Tx</div>
            <div className="text-emerald-400 font-bold text-sm mt-0.5">~5 - 15ms</div>
            <div className="text-[10px] text-slate-500 mt-1">Indexed B-Tree lookup</div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-500 text-[10px] uppercase">Total Roundtrip</div>
            <div className="text-amber-400 font-bold text-sm mt-0.5">~35 - 60ms</div>
            <div className="text-[10px] text-emerald-400 mt-1">98.5% safety margin under 4s</div>
          </div>
        </div>
      </div>
    </div>
  );
};
