/**
 * @file ProviderFilter.tsx
 * @description Luxury Emerald & Gold Provider Filter Bar for PLAY369.
 * Provides easy horizontal scrolling with >= 48px touch targets for mobile.
 */

import React from 'react';
import { MOCK_PROVIDERS, MockProvider } from '../../data/mockGamesData';
import { soundEngine } from '../../services/soundEngine';

export interface ProviderFilterProps {
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  providers?: MockProvider[];
}

export const ProviderFilter: React.FC<ProviderFilterProps> = ({
  selectedProvider,
  onSelectProvider,
  providers = MOCK_PROVIDERS
}) => {
  const handleProviderClick = (providerId: string) => {
    soundEngine.playClick(800);
    onSelectProvider(providerId);
  };

  return (
    <div
      id="play369-provider-filter"
      className="flex items-center space-x-2 overflow-x-auto scrollbar-none py-1 px-0.5"
      role="radiogroup"
      aria-label="Filter by Game Provider"
    >
      <span className="text-[11px] font-mono text-emerald-300/70 shrink-0 uppercase tracking-wider hidden sm:inline">
        Provider:
      </span>

      {providers.map((p) => {
        const isSelected = selectedProvider === p.id;

        return (
          <button
            key={p.id}
            id={`play369-provider-btn-${p.id}`}
            onClick={() => handleProviderClick(p.id)}
            role="radio"
            aria-checked={isSelected}
            className={`min-h-[48px] px-3.5 sm:px-4 py-1.5 rounded-xl font-medium text-xs whitespace-nowrap cursor-pointer transition-all duration-150 flex items-center space-x-1.5 select-none active:scale-95 ${
              isSelected
                ? 'bg-amber-400 text-slate-950 font-black shadow-[0_2px_12px_rgba(245,158,11,0.3)] border border-amber-300'
                : 'bg-[#02180e] border border-emerald-800/70 hover:border-emerald-500 text-emerald-200/80 hover:text-white'
            }`}
          >
            <span role="img" aria-hidden="true" className="text-sm">
              {p.icon}
            </span>
            <span className="font-sans">{p.name}</span>
            {p.gameCount > 0 && (
              <span
                className={`text-[10px] font-mono px-1 rounded-md ml-0.5 ${
                  isSelected
                    ? 'bg-slate-950/20 text-slate-950 font-black'
                    : 'bg-emerald-950/80 text-emerald-400'
                }`}
              >
                {p.gameCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
