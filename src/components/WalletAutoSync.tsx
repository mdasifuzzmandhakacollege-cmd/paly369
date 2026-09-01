import React, { useState, useEffect } from 'react';
import { useWalletGame } from '../contexts/WalletGameContext';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { Wallet, RefreshCw, Zap, Server, Activity, CheckCircle2, History, Smartphone, Globe } from 'lucide-react';
import { soundEngine } from '../services/soundEngine';
import { motion, AnimatePresence } from 'framer-motion';

export const WalletAutoSync: React.FC = () => {
  const { currentUser } = useWalletGame();
  const [balance, setBalance] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [syncLogs, setSyncLogs] = useState<{ id: number, time: string, message: string, changed: boolean }[]>([]);
  const [isWebSocket, setIsWebSocket] = useState(true);
  const [logCounter, setLogCounter] = useState(0);

  // Initialize balance
  useEffect(() => {
    if (currentUser) {
      const wallet = seamlessEngine.getWallets().find(w => w.user_id === currentUser.id);
      if (wallet) setBalance(wallet.real_balance);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    let intervalId: NodeJS.Timeout;

    const performSync = async () => {
      setSyncStatus('syncing');
      
      // Simulating network latency 200-400ms
      await new Promise(r => setTimeout(r, 200 + Math.random() * 200));

      const wallet = seamlessEngine.getWallets().find(w => w.user_id === currentUser.id);
      
      if (wallet) {
        const changed = wallet.real_balance !== balance;
        if (changed) {
          setBalance(wallet.real_balance);
          soundEngine.playWinChime();
        }
        
        setLogCounter(c => {
          const newLog = { 
            id: c + 1,
            time: new Date().toLocaleTimeString(), 
            message: changed 
              ? `Ledger changed! UI updated to $${wallet.real_balance.toFixed(2)}.` 
              : `Sync OK. No ledger changes detected.`,
            changed
          };
          setSyncLogs(prev => [newLog, ...prev].slice(0, 6)); // keep last 6 logs
          return c + 1;
        });
      }
      
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 1000);
    };

    // Auto-sync every 5 seconds
    intervalId = setInterval(performSync, 5000);

    return () => clearInterval(intervalId);
  }, [currentUser, balance, isWebSocket]);

  const simulateExternalDeposit = () => {
    if (!currentUser) return;
    soundEngine.playClick(800);
    // Directly inject into the engine to bypass React state, simulating an external system
    seamlessEngine.topUpWallet(currentUser.id, currentUser.currency, 100);
    // Do not call setBalance here! Let the Auto-Sync catch it.
  };

  const simulateExternalBet = () => {
    if (!currentUser) return;
    soundEngine.playClick(600);
    // Directly inject into the engine to bypass React state
    seamlessEngine.executeRequest('bet', {
      provider_id: 'PP',
      user_id: currentUser.id,
      currency: currentUser.currency,
      amount: 10,
      transaction_id: `EXT-BET-${Date.now()}`,
      round_id: `ROUND-${Date.now()}`,
      game_id: 'auto-sync-game'
    }, { bypassHmac: true });
    // Do not call setBalance here! Let the Auto-Sync catch it.
  };

  if (!currentUser) {
    return (
      <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl p-6 text-center text-slate-400">
        Please log in to use the Wallet Auto-Sync Monitor.
      </div>
    );
  }

  return (
    <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-white font-mono">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-black flex items-center space-x-2">
            <RefreshCw className={`w-5 h-5 text-cyan-400 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            <span>Wallet Auto-Sync (5s Polling)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Maintains UI consistency by syncing the React frontend with the PostgreSQL ledger every 5 seconds.
          </p>
        </div>

        {/* Status Indicator */}
        <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
          syncStatus === 'synced' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          syncStatus === 'syncing' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
          'bg-slate-800 border-slate-700 text-slate-400'
        }`}>
          {syncStatus === 'synced' && <CheckCircle2 className="w-3.5 h-3.5" />}
          {syncStatus === 'syncing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          {syncStatus === 'idle' && <Activity className="w-3.5 h-3.5" />}
          <span>
            {syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Fetching Ledger...' : 'Waiting for next tick...'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Side: Client Wallet State */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col items-center justify-center min-h-[160px]">
            <div className="absolute top-3 left-3 flex items-center space-x-1.5 text-xs text-slate-500">
              <Globe className="w-4 h-4" />
              <span>Current React UI State</span>
            </div>
            
            <div className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2 mt-4">
              Synced Ledger Balance
            </div>
            <motion.div 
              key={balance}
              initial={{ scale: 1.2, color: '#10b981' }}
              animate={{ scale: 1, color: '#f8fafc' }}
              className="text-4xl sm:text-5xl font-black tabular-nums"
            >
              ${balance.toFixed(2)}
            </motion.div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-400" />
              Simulate External Device Actions
            </h3>
            <p className="text-[10px] text-slate-400 mb-4">
              Trigger actions that modify the database directly without telling the React UI. Wait up to 5 seconds to see the UI auto-correct itself!
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={simulateExternalDeposit}
                className="py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all"
              >
                +$100 External Deposit
              </button>
              <button
                onClick={simulateExternalBet}
                className="py-2.5 px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-all"
              >
                -$10 External Bet
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Network Transport Log */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              Transport Logs (WebSockets/Polling)
            </h3>
            
            <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button 
                onClick={() => setIsWebSocket(true)}
                className={`px-2 py-1 text-[10px] rounded uppercase font-bold transition-all ${isWebSocket ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                WebSocket
              </button>
              <button 
                onClick={() => setIsWebSocket(false)}
                className={`px-2 py-1 text-[10px] rounded uppercase font-bold transition-all ${!isWebSocket ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Long-Polling
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar max-h-[250px]">
            <AnimatePresence>
              {syncLogs.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-8">
                  Waiting for first sync tick...
                </div>
              ) : (
                syncLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`p-3 rounded-lg border text-xs flex justify-between items-center ${
                      log.changed 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                        : 'bg-slate-950 border-slate-800/60 text-slate-400'
                    }`}
                  >
                    <span className="flex-1">{log.message}</span>
                    <span className="text-[10px] opacity-70 ml-2 shrink-0">{log.time}</span>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
};
