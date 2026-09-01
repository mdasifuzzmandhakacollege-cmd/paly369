/**
 * @file FloatingActionHub.tsx
 * @description Sleek consolidated Floating Action Hub for PLAY369.
 * Repositions and consolidates Daily VIP Bonus, Lucky Spin Wheel, and Treasure Chest 
 * into a single non-intrusive floating trigger that never obstructs games, text, or bottom nav.
 */

import React, { useState } from 'react';
import { Sparkles, Gift, Disc3, X, ChevronUp } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';

export interface FloatingActionHubProps {
  onOpenVipRewards: () => void;
  onOpenShareWheel: () => void;
  onOpenTreasure: () => void;
}

export const FloatingActionHub: React.FC<FloatingActionHubProps> = ({
  onOpenVipRewards,
  onOpenShareWheel,
  onOpenTreasure
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleHub = () => {
    soundEngine.playClick(900);
    setIsExpanded((prev) => !prev);
  };

  return (
    <div
      id="play369-floating-hub"
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-2.5 sm:right-6 z-30 flex flex-col items-end space-y-2 pointer-events-auto select-none"
    >
      {/* Backdrop to easily collapse on outside tap */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[-1] bg-black/40 backdrop-blur-[1px]"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Expanded Menu Actions */}
      {isExpanded && (
        <div className="flex flex-col items-end space-y-2 mb-1 animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Daily VIP Bonus */}
          <button
            type="button"
            id="play369-float-vip-reward"
            onClick={() => {
              soundEngine.playClick(1000);
              onOpenVipRewards();
              setIsExpanded(false);
            }}
            className="flex items-center space-x-2 bg-[#02180e]/95 border border-amber-400/60 p-1.5 pr-3 rounded-full shadow-2xl backdrop-blur-xl hover:scale-105 active:scale-95 transition-all cursor-pointer min-h-[44px]"
            title="Daily VIP Bonus"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 flex items-center justify-center font-bold text-sm shadow">
              🎁
            </div>
            <div className="text-left font-sans">
              <div className="text-[9px] text-emerald-300 font-bold leading-none">VIP Bonus</div>
              <div className="text-[10px] font-black text-amber-400 font-mono leading-tight">Daily Gift</div>
            </div>
          </button>

          {/* Lucky Spin Wheel */}
          <button
            type="button"
            id="play369-float-wheel"
            onClick={() => {
              soundEngine.playClick(1000);
              onOpenShareWheel();
              setIsExpanded(false);
            }}
            className="flex items-center space-x-2 bg-[#02180e]/95 border border-amber-400/60 p-1.5 pr-3 rounded-full shadow-2xl backdrop-blur-xl hover:scale-105 active:scale-95 transition-all cursor-pointer min-h-[44px]"
            title="Lucky Spin Wheel"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 flex items-center justify-center font-bold text-sm shadow">
              🎡
            </div>
            <div className="text-left font-sans">
              <div className="text-[9px] text-emerald-300 font-bold leading-none">Lucky Spin</div>
              <div className="text-[10px] font-black text-amber-400 font-mono leading-tight">Spin &amp; Win</div>
            </div>
          </button>

          {/* Treasure Chest */}
          <button
            type="button"
            id="play369-float-treasure"
            onClick={() => {
              soundEngine.playClick(1000);
              onOpenTreasure();
              setIsExpanded(false);
            }}
            className="flex items-center space-x-2 bg-[#02180e]/95 border border-amber-400/60 p-1.5 pr-3 rounded-full shadow-2xl backdrop-blur-xl hover:scale-105 active:scale-95 transition-all cursor-pointer min-h-[44px]"
            title="Open Treasure Chest"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 flex items-center justify-center font-bold text-sm shadow">
              <Sparkles className="w-4 h-4 text-slate-950" />
            </div>
            <div className="text-left font-sans">
              <div className="text-[9px] text-emerald-300 font-bold leading-none">Treasure</div>
              <div className="text-[10px] font-black text-amber-400 font-mono leading-tight">Chest</div>
            </div>
          </button>
        </div>
      )}

      {/* Main Single Floating Trigger (Exact 48px footprint, non-obstructive) */}
      <button
        type="button"
        id="play369-float-hub-toggle"
        onClick={toggleHub}
        className={`w-12 h-12 min-h-[48px] min-w-[48px] max-w-[48px] max-h-[48px] rounded-2xl flex items-center justify-center shadow-xl transition-all cursor-pointer border ${
          isExpanded
            ? 'bg-rose-600 border-rose-400 text-white rotate-90 scale-95'
            : 'bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 border-amber-300 text-slate-950 hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(245,158,11,0.35)]'
        }`}
        aria-label={isExpanded ? 'Close rewards hub' : 'Open rewards hub'}
      >
        {isExpanded ? (
          <X className="w-5 h-5 stroke-[2.5]" />
        ) : (
          <div className="relative flex items-center justify-center">
            <Gift className="w-5 h-5 stroke-[2.5]" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-600 border border-amber-200" />
          </div>
        )}
      </button>
    </div>
  );
};
