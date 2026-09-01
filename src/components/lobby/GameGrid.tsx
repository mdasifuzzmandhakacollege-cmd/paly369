/**
 * @file GameGrid.tsx
 * @description Responsive Game Grid with Empty and Loading skeleton states for PLAY369.
 */

import React from 'react';
import { Sparkles, RefreshCw, SearchX, FilterX } from 'lucide-react';
import { GameItem } from '../../services/providers/types';
import { GameCard } from './GameCard';
import { soundEngine } from '../../services/soundEngine';

export interface GameGridProps {
  games: GameItem[];
  isLoading?: boolean;
  onLaunchGame: (gameId: string) => void;
  onResetFilters?: () => void;
  favorites?: string[];
  onToggleFavorite?: (gameId: string) => void;
  title?: string;
  totalCount?: number;
}

export const GameGrid: React.FC<GameGridProps> = ({
  games,
  isLoading = false,
  onLaunchGame,
  onResetFilters,
  favorites = [],
  onToggleFavorite,
  title,
  totalCount
}) => {
  // Skeleton count for loading state
  const skeletonCards = Array.from({ length: 12 }, (_, i) => i);

  if (isLoading) {
    return (
      <div id="play369-gamegrid-loading" className="space-y-3" aria-busy="true" aria-live="polite">
        <div className="flex items-center justify-between text-xs font-mono text-emerald-300/70 px-1">
          <span>Loading Games Catalog...</span>
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
          {skeletonCards.map((n) => (
            <div
              key={n}
              className="bg-[#031c11]/60 border border-emerald-800/40 rounded-2xl overflow-hidden animate-pulse flex flex-col justify-between"
            >
              <div className="aspect-square w-full bg-emerald-950/60" />
              <div className="p-2.5 space-y-1.5">
                <div className="h-3 w-3/4 bg-emerald-900/60 rounded" />
                <div className="h-2.5 w-1/2 bg-emerald-950 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div
        id="play369-gamegrid-empty"
        className="my-8 py-12 px-4 rounded-3xl bg-[#02180e] border border-emerald-800/60 text-center space-y-4 max-w-lg mx-auto shadow-xl"
      >
        <div className="w-16 h-16 rounded-3xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400 mx-auto">
          <SearchX className="w-8 h-8 text-amber-400" />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-black text-white font-sans">
            No Games Found
          </h3>
          <p className="text-xs text-emerald-300/70 font-sans">
            No games match your current filter or search criteria.
          </p>
        </div>

        {onResetFilters && (
          <button
            onClick={() => {
              soundEngine.playClick(900);
              onResetFilters();
            }}
            className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs font-mono shadow-md active:scale-95 transition-all inline-flex items-center space-x-2 cursor-pointer"
          >
            <FilterX className="w-4 h-4" />
            <span>Reset All Filters</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div id="play369-gamegrid-container" className="space-y-3">
      {/* Title & Metadata Strip */}
      <div className="flex items-center justify-between text-xs font-mono text-emerald-300/70 px-1">
        <span className="font-sans font-bold text-white text-sm">
          {title || 'All Games'}{' '}
          <span className="text-xs font-mono text-emerald-400">
            ({games.length}{totalCount && totalCount !== games.length ? ` of ${totalCount}` : ''})
          </span>
        </span>
        <span className="text-[11px] hidden xs:inline">
          Provably Fair • Certified RNG 🔒
        </span>
      </div>

      {/* High Density Responsive Grid (2 columns on mobile) */}
      <div
        id="play369-game-grid"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3"
      >
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            onLaunch={onLaunchGame}
            isFavorite={favorites.includes(game.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
};
