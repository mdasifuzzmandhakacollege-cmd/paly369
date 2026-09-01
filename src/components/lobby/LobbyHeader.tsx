/**
 * @file LobbyHeader.tsx
 * @description Sleek Marquee Notice & Search Trigger Header for PLAY369.
 */

import React from 'react';
import { Volume2, Search } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';

export interface LobbyHeaderProps {
  onOpenSearch: () => void;
}

export const LobbyHeader: React.FC<LobbyHeaderProps> = ({ onOpenSearch }) => {
  return (
    <div id="play369-lobby-header-bar" className="flex items-center gap-2 w-full">
      {/* Live Announcement Marquee Strip */}
      <div
        id="play369-marquee-strip"
        className="flex-1 flex items-center space-x-2 bg-[#02180e]/90 border border-emerald-800/80 rounded-2xl px-3 py-2 text-xs overflow-hidden shadow-inner min-h-[44px]"
        aria-label="Live Casino Announcements"
      >
        <div className="flex items-center space-x-1 text-amber-400 font-bold shrink-0">
          <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="hidden xs:inline font-mono text-[10px] uppercase tracking-wider text-amber-400">
            Notice:
          </span>
        </div>
        <div className="overflow-hidden whitespace-nowrap w-full">
          <div className="inline-block animate-[marquee_30s_linear_infinite] text-emerald-200/90 font-mono text-[11px] sm:text-xs">
            📢 <strong className="text-amber-300">Welcome to PLAY369 Official Gaming Platform</strong> • 💎 Daily VIP Login Rewards active • ⚡ Instant 24/7 bKash, Nagad & Rocket settlement • 🛡️ Licensed Provably Fair & Certified RNG Gaming
          </div>
        </div>
      </div>

      {/* Quick Search Trigger (48px Touch Target) */}
      <button
        type="button"
        id="play369-quick-search-btn"
        onClick={() => {
          soundEngine.playClick(900);
          onOpenSearch();
        }}
        className="min-h-[44px] min-w-[44px] px-3 rounded-2xl bg-[#02180e] hover:bg-[#032415] border border-emerald-800/80 hover:border-amber-400/80 text-emerald-100 hover:text-amber-400 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
        title="Search Games"
        aria-label="Search Games"
      >
        <Search className="w-4 h-4 text-amber-400" />
        <span className="hidden sm:inline font-sans text-xs">Search</span>
      </button>
    </div>
  );
};
