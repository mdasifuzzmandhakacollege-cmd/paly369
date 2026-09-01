/**
 * @file TopProvidersSection.tsx
 * @description Compact Horizontal Provider Strip with Premium Brand Badges for PLAY369.
 * Uses existing providers only from GameService / MockProvider catalog.
 */

import React from 'react';
import { ChevronRight, Award, Sparkles } from 'lucide-react';
import { MockProvider, MOCK_PROVIDERS } from '../../data/mockGamesData';
import { soundEngine } from '../../services/soundEngine';

export interface TopProvidersSectionProps {
  providers?: MockProvider[];
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  onViewAllProviders?: () => void;
}

export const TopProvidersSection: React.FC<TopProvidersSectionProps> = ({
  providers = MOCK_PROVIDERS,
  selectedProvider,
  onSelectProvider,
  onViewAllProviders
}) => {
  const displayProviders = providers.filter((p) => p.id !== 'all');

  return (
    <section id="play369-top-providers-section" className="space-y-2 sm:space-y-2.5" aria-label="Game Providers">
      {/* Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
            <Award className="w-3 h-3" />
          </div>
          <h3 className="text-xs sm:text-sm font-black text-white font-sans tracking-wide uppercase">
            Top Providers
          </h3>
        </div>

        {onViewAllProviders && (
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick(800);
              onViewAllProviders();
            }}
            className="min-h-[48px] px-2 text-xs font-mono text-amber-300 hover:text-amber-200 flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Horizontal Brand Badges with snap */}
      <div className="w-full overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-2 px-2 sm:mx-0 sm:px-0 py-1">
        <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-max pb-1">
          {/* All Providers Option */}
          <button
            type="button"
            id="play369-provider-chip-all"
            onClick={() => {
              soundEngine.playClick(800);
              onSelectProvider('all');
            }}
            className={`min-h-[44px] px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap cursor-pointer transition-all flex items-center space-x-1.5 snap-start active:scale-95 select-none ${
              selectedProvider === 'all'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md border border-amber-300'
                : 'bg-[#02180e] border border-emerald-800/70 hover:border-emerald-500 text-emerald-200 hover:text-white'
            }`}
          >
            <span>All Providers</span>
          </button>

          {/* Provider Chips */}
          {displayProviders.map((p) => {
            const isSelected = selectedProvider === p.id;

            return (
              <button
                key={p.id}
                type="button"
                id={`play369-provider-chip-${p.id}`}
                onClick={() => {
                  soundEngine.playClick(800);
                  onSelectProvider(p.id);
                }}
                className={`min-h-[44px] px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap cursor-pointer transition-all flex items-center space-x-1.5 snap-start active:scale-95 select-none ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md border border-amber-300'
                    : 'bg-[#02180e] border border-emerald-800/70 hover:border-emerald-500 text-emerald-200 hover:text-white'
                }`}
                aria-pressed={isSelected}
              >
                <span>{p.icon}</span>
                <span className="font-sans">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
