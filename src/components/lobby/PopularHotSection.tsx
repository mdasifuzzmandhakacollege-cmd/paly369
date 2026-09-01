/**
 * @file PopularHotSection.tsx
 * @description Luxury Emerald & Gold Hot & Trending Games spotlight section for PLAY369.
 */

import React from 'react';
import { Flame, Sparkles, ChevronRight, Zap } from 'lucide-react';
import { GameItem } from '../../services/providers/types';
import { GameCard } from './GameCard';
import { soundEngine } from '../../services/soundEngine';

export interface PopularHotSectionProps {
  games: GameItem[];
  onLaunchGame: (gameId: string) => void;
  onViewAllHot?: () => void;
  favorites?: string[];
  onToggleFavorite?: (gameId: string) => void;
}

export const PopularHotSection: React.FC<PopularHotSectionProps> = ({
  games,
  onLaunchGame,
  onViewAllHot,
  favorites = [],
  onToggleFavorite
}) => {
  // Filter for hot / featured games, take top 4-6
  const hotGames = games.filter((g) => g.isHot || g.isFeatured).slice(0, 6);

  if (hotGames.length === 0) return null;

  return (
    <section id="play369-popular-hot-section" className="space-y-3" aria-label="Hot Games">
      {/* Section Header with Golden-Ratio spacing */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-400">
            <Flame className="w-4 h-4 fill-amber-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white font-sans flex items-center gap-1.5">
              <span>Hot & Trending Games</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-mono font-bold">
                LIVE
              </span>
            </h3>
            <p className="text-[11px] text-emerald-300/70 font-sans">
              Most played by players right now
            </p>
          </div>
        </div>

        {onViewAllHot && (
          <button
            onClick={() => {
              soundEngine.playClick(800);
              onViewAllHot();
            }}
            className="min-h-[48px] px-3 rounded-xl text-xs font-mono text-amber-300 hover:text-amber-200 flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Grid of Hot Game Cards (3-col mobile / 6-col desktop) */}
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
        {hotGames.map((game) => (
          <GameCard
            key={`hot-${game.id}`}
            game={game}
            onLaunch={onLaunchGame}
            isFavorite={favorites.includes(game.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
};
