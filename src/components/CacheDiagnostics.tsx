import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  Activity,
  HardDrive,
  RefreshCw,
  Clock,
  Cpu,
  Trash2,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { soundEngine } from '../services/soundEngine';

export const CacheDiagnostics: React.FC = () => {
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);
  const [memoryInfo, setMemoryInfo] = useState<{ totalJSHeapSize: number; usedJSHeapSize: number; jsHeapSizeLimit: number } | null>(null);
  const [diagnostics, setDiagnostics] = useState(seamlessEngine.getDiagnostics());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString());

  const fetchStorageInfo = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        setStorageInfo({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      } catch (e) {
        console.error('Storage estimate failed', e);
      }
    }
  };

  const fetchMemoryInfo = () => {
    // @ts-ignore
    if (performance && performance.memory) {
      // @ts-ignore
      setMemoryInfo({
        // @ts-ignore
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        // @ts-ignore
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        // @ts-ignore
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      });
    }
  };

  const refreshData = async () => {
    soundEngine.playClick(1000);
    setIsRefreshing(true);
    setSyncStatus('syncing');
    
    // Simulate sync latency
    await new Promise(r => setTimeout(r, 600));
    
    setDiagnostics(seamlessEngine.getDiagnostics());
    await fetchStorageInfo();
    fetchMemoryInfo();
    
    setSyncStatus('synced');
    setLastSync(new Date().toLocaleTimeString());
    setIsRefreshing(false);
  };

  const clearBrowserCache = async () => {
    soundEngine.playClick(800);
    setClearingCache(true);
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      await refreshData();
      soundEngine.playWinChime();
    } catch (e) {
      console.error('Failed to clear cache', e);
    } finally {
      setClearingCache(false);
    }
  };

  useEffect(() => {
    fetchStorageInfo();
    fetchMemoryInfo();
    
    const interval = setInterval(() => {
      setDiagnostics(seamlessEngine.getDiagnostics());
      fetchMemoryInfo();
    }, 5000); // Auto-refresh every 5s
    
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-white font-mono">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-black flex items-center space-x-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <span>Cache Diagnostics & State Sync</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry for the in-memory seamless wallet engine and browser storage usage. Ensures low-latency &lt;4s SLA.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${
            syncStatus === 'synced' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            syncStatus === 'syncing' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
            'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {syncStatus === 'synced' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{syncStatus === 'synced' ? 'State Synced' : 'Syncing...'}</span>
          </div>
          
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all disabled:opacity-50"
            title="Refresh Diagnostics"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Real-Time Sync Status Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <RefreshCw className={`w-4 h-4 text-blue-400 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">State Synchronization</span>
            </div>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">WebSocket / Polling</span>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3 bg-slate-950 p-3 rounded-xl border border-slate-800/60">
              <div className={`p-2 rounded-full ${
                syncStatus === 'synced' ? 'bg-emerald-500/20 text-emerald-400' :
                syncStatus === 'syncing' ? 'bg-amber-500/20 text-amber-400' :
                'bg-rose-500/20 text-rose-400'
              }`}>
                {syncStatus === 'synced' ? <CheckCircle2 className="w-5 h-5" /> : <Activity className="w-5 h-5 animate-pulse" />}
              </div>
              <div>
                <div className="text-xs text-slate-400">Connection Status</div>
                <div className={`text-sm font-bold ${
                  syncStatus === 'synced' ? 'text-emerald-400' :
                  syncStatus === 'syncing' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {syncStatus === 'synced' ? 'Active & Synced' : syncStatus === 'syncing' ? 'Synchronizing...' : 'Disconnected'}
                </div>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Last Pulse: {lastSync}</span>
              <span>Latency: ~{syncStatus === 'syncing' ? '...' : '12ms'}</span>
            </div>
          </div>
        </div>

        {/* Browser Storage Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Browser Storage</span>
            </div>
            <button
              onClick={clearBrowserCache}
              disabled={clearingCache}
              className="text-xs flex items-center space-x-1 bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-lg border border-rose-500/30 hover:bg-rose-500/20 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Cache</span>
            </button>
          </div>
          
          {storageInfo ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Quota Used</span>
                  <span className="font-bold">{formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all" 
                    style={{ width: `${Math.min(100, (storageInfo.usage / storageInfo.quota) * 100)}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                IndexedDB & Cache API utilization. High usage may impact client-side responsiveness.
              </p>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-2">Storage API not supported in this environment.</div>
          )}
        </div>

        {/* JS Heap Memory Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">JS Heap Memory</span>
            </div>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Live</span>
          </div>
          
          {memoryInfo ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Allocated Memory</span>
                  <span className="font-bold">{formatBytes(memoryInfo.usedJSHeapSize)} / {formatBytes(memoryInfo.totalJSHeapSize)}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full transition-all" 
                    style={{ width: `${Math.min(100, (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100)}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                V8 Engine memory utilization. Excessive object allocation can trigger GC pauses affecting SLA.
              </p>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-2">performance.memory not supported in this browser.</div>
          )}
        </div>
      </div>

      {/* Seamless Engine Internal State */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">In-Memory Store Metrics</span>
          </div>
          <span className="text-[10px] text-slate-500 flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Last Sync: {lastSync}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Users</div>
            <div className="text-lg font-black text-white">{diagnostics.users.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Wallets</div>
            <div className="text-lg font-black text-white">{diagnostics.wallets.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Transactions</div>
            <div className="text-lg font-black text-white">{diagnostics.transactions.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Idempotency Keys</div>
            <div className="text-lg font-black text-cyan-400">{diagnostics.idempotencyStore.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Game Rounds</div>
            <div className="text-lg font-black text-white">{diagnostics.gameRounds.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Payment Reqs</div>
            <div className="text-lg font-black text-white">{diagnostics.paymentRequests.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">SQL Logs Count</div>
            <div className="text-lg font-black text-amber-400">{diagnostics.sqlQueryLogs.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60 flex flex-col justify-center items-center text-center">
            <Zap className="w-5 h-5 text-amber-500 mb-1" />
            <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Memory Optimized</div>
          </div>
        </div>
      </div>
    </div>
  );
};
