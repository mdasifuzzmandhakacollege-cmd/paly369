/**
 * @file VipProgressionStrip.tsx
 * @description Compact Horizontal VIP Progression Strip for PLAY369 Mobile Dashboard.
 * Uses existing authoritative VIP metadata with gold progress bar and VIP Club navigation.
 */

import React from 'react';
import { Crown, ChevronRight, Sparkles, Award } from 'lucide-react';
import { UserEntity } from '../../server/types/seamless';
import { soundEngine } from '../../services/soundEngine';

export interface VipProgressionStripProps {
  currentUser?: UserEntity;
  onNavigateVip?: () => void;
}

export const VipProgressionStrip: React.FC<VipProgressionStripProps> = ({
  currentUser,
  onNavigateVip
}) => {
  const currentTier = currentUser?.vipTier || (currentUser?.role === 'VIP' ? 'Gold' : 'Bronze');
  const points = currentUser?.vipPoints || 0;
  
  // Calculate tier details based on real tier if provided
  const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Crown Elite'];
  const currentIndex = tiers.indexOf(currentTier) >= 0 ? tiers.indexOf(currentTier) : 0;
  const nextTier = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : 'Crown Elite';
  
  // Progress calculation only when points exist, otherwise show clean level indicator
  const progressPercent = Math.min(Math.max((points % 1000) / 10, 15), 100);

  const handleClick = () => {
    soundEngine.playClick(1000);
    if (onNavigateVip) {
      onNavigateVip();
    }
  };

  return (
    <div
      id="play369-vip-progression-strip"
      onClick={handleClick}
      className="group relative w-full rounded-2xl overflow-hidden border border-amber-500/25 bg-[#02180e]/90 hover:bg-[#032314] px-3.5 py-2.5 sm:py-3 shadow-md flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] select-none"
      role="button"
      tabIndex={0}
      aria-label="VIP Club Progression and Benefits"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Left Icon and Status */}
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-400 flex items-center justify-center text-slate-950 shrink-0 shadow-md">
          <Crown className="w-4 h-4 stroke-[2.5]" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black font-sans text-amber-300 group-hover:text-amber-200 transition-colors">
              VIP {currentTier}
            </span>
            <span className="text-[10px] font-mono text-emerald-300/70 truncate hidden xs:inline">
              • Next: {nextTier}
            </span>
          </div>

          {/* Thin Gold Progress Bar */}
          <div className="w-32 xs:w-44 sm:w-60 h-1.5 bg-emerald-950 rounded-full overflow-hidden mt-1 border border-emerald-800/40">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all duration-500 shadow-[0_0_6px_#f59e0b]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right Navigation Trigger (Min 48px touch target) */}
      <div className="flex items-center space-x-1 shrink-0 text-amber-400 group-hover:text-amber-300 text-xs font-bold font-sans">
        <span className="text-[11px] font-mono uppercase tracking-wider">VIP Club</span>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
};
