import React, { useState, useEffect } from 'react';
import { useWalletGame, LiveActivityItem } from '../contexts/WalletGameContext';
import { soundEngine } from '../services/soundEngine';
import { 
  Trophy, 
  Flame, 
  Sparkles, 
  Zap, 
  Play, 
  ChevronRight, 
  TrendingUp, 
  Crown,
  Layers
} from 'lucide-react';

interface LiveActivityTickerProps {
  className?: string;
  onLaunchGame?: (gameId: string) => void;
}

export const LiveActivityTicker: React.FC<LiveActivityTickerProps> = ({ 
  className = '',
  onLaunchGame 
}) => {
  const { liveActivities, launchGame, currency } = useWalletGame();
  const [filterMode, setFilterMode] = useState<'ALL' | 'BIG_WINS' | 'HIGH_MULT'>('ALL');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<LiveActivityItem | null>(null);

  // Time formatter helper
  const formatTimeAgo = (timestamp: number) => {
    const elapsedSec = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
    if (elapsedSec < 10) return 'এখনই';
    if (elapsedSec < 60) return `${elapsedSec} সেক আগে`;
    const elapsedMin = Math.floor(elapsedSec / 60);
    return `${elapsedMin} মিনিট আগে`;
  };

  // Mask username for privacy & standard iGaming compliance
  const maskUsername = (name: string, isCurrent?: boolean) => {
    if (isCurrent) return 'আপনি (YOU)';
    if (name.length <= 4) return `${name.slice(0, 2)}***`;
    return `${name.slice(0, 3)}***${name.slice(-2)}`;
  };

  // Filter activities based on selected mode
  const filteredActivities = React.useMemo(() => {
    if (filterMode === 'BIG_WINS') {
      return liveActivities.filter((a) => a.amount >= 20000 || (a.multiplier && a.multiplier >= 50));
    }
    if (filterMode === 'HIGH_MULT') {
      return liveActivities.filter((a) => (a.multiplier && a.multiplier >= 20));
    }
    return liveActivities;
  }, [liveActivities, filterMode]);

  const handleItemClick = (activity: LiveActivityItem) => {
    soundEngine.playClick(900);
    setSelectedActivity(activity);
    if (onLaunchGame) {
      onLaunchGame(activity.gameId);
    } else {
      launchGame(activity.gameId);
    }
  };

  return (
    <div className={`space-y-2.5 font-sans ${className}`}>
      {/* Header Bar with Live Indicator & Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center space-x-2">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
          </div>
          <div className="flex items-center space-x-1.5 font-black text-xs tracking-wide text-white uppercase">
            <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>লাইভ বিজয়ী ও অ্যাক্টিভিটি</span>
            <span className="hidden sm:inline text-slate-500 font-mono text-[11px] font-normal">
              (Live Winners Feed)
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-1 bg-slate-950/90 border border-slate-800 p-1 rounded-xl font-mono text-[11px]">
          <button
            onClick={() => {
              soundEngine.playClick(800);
              setFilterMode('ALL');
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              filterMode === 'ALL'
                ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            সব লাইভ ({liveActivities.length})
          </button>

          <button
            onClick={() => {
              soundEngine.playClick(850);
              setFilterMode('BIG_WINS');
            }}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 transition-all ${
              filterMode === 'BIG_WINS'
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-sm font-black'
                : 'text-slate-400 hover:text-rose-400'
            }`}
          >
            <Trophy className="w-3 h-3 text-amber-300" />
            <span>বিগ উইন</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick(900);
              setFilterMode('HIGH_MULT');
            }}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 transition-all ${
              filterMode === 'HIGH_MULT'
                ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-sm font-black'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            <Zap className="w-3 h-3 text-cyan-300" />
            <span>মাল্টিপ্লায়ার</span>
          </button>
        </div>
      </div>

      {/* Horizontal Continuous Auto-Scrolling Ticker Strip */}
      <div 
        className="relative bg-[#080d1a] border border-amber-500/25 rounded-2xl p-2 sm:p-2.5 overflow-hidden shadow-xl group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Subtle Ambient Background Glow */}
        <div className="absolute -top-10 -left-10 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center space-x-3 overflow-x-auto scrollbar-none py-0.5">
          {filteredActivities.slice(0, 15).map((act, index) => {
            const isJackpot = act.type === 'JACKPOT' || (act.multiplier && act.multiplier >= 100);
            const isCurrentUser = act.isCurrentPlayer;

            return (
              <div
                key={`${act.id}_${index}`}
                onClick={() => handleItemClick(act)}
                className={`flex-shrink-0 min-w-[220px] sm:min-w-[245px] p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                  isCurrentUser
                    ? 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border-amber-400 shadow-md shadow-amber-500/20 animate-pulse'
                    : isJackpot
                    ? 'bg-gradient-to-br from-purple-950/60 via-slate-900 to-slate-950 border-purple-500/50 hover:border-purple-400'
                    : 'bg-slate-950/90 border-slate-800 hover:border-amber-500/40'
                }`}
              >
                {/* Top Row: User & Relative Time */}
                <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[9px] shrink-0 ${
                      isCurrentUser
                        ? 'bg-amber-400 text-slate-950'
                        : isJackpot
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-800 text-amber-300'
                    }`}>
                      {isCurrentUser ? '★' : act.username.charAt(0).toUpperCase()}
                    </div>
                    <span className={`font-bold truncate ${
                      isCurrentUser ? 'text-amber-300 font-black' : 'text-slate-300'
                    }`}>
                      {maskUsername(act.username, isCurrentUser)}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatTimeAgo(act.timestamp)}
                  </span>
                </div>

                {/* Middle Row: Game Title & Provider Pill */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                    {act.gameTitle}
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 shrink-0">
                    {act.provider}
                  </span>
                </div>

                {/* Bottom Row: Amount & Multiplier */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 font-mono">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-black text-amber-400">
                      {act.currency === 'BDT' ? `৳ ${act.amount.toLocaleString()}` : `$ ${act.amount.toFixed(2)}`}
                    </span>
                  </div>

                  {act.multiplier && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black flex items-center space-x-0.5 ${
                      act.multiplier >= 100
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-bounce'
                        : act.multiplier >= 20
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      <span>{act.multiplier}x</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
