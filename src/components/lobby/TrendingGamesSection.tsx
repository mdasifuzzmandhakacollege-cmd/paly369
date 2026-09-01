/**
 * @file TrendingGamesSection.tsx
 * @description Compact Premium Horizontal Rail for Trending Games on PLAY369 Mobile Dashboard.
 * Disciplined spacing, square tiles, vivid artwork, real catalog data only.
 */

import React, { useState } from 'react';
import { ChevronRight, Flame, Heart, Play } from 'lucide-react';
import { GameItem } from '../../services/providers/types';
import { soundEngine } from '../../services/soundEngine';

export interface TrendingGamesSectionProps {
  games: GameItem[];
  onLaunchGame: (gameId: string) => void;
  onViewAllTrending?: () => void;
  favorites?: string[];
  onToggleFavorite?: (gameId: string) => void;
}

export const TrendingGamesSection: React.FC<TrendingGamesSectionProps> = ({
  games,
  onLaunchGame,
  onViewAllTrending,
  favorites = [],
  onToggleFavorite
}) => {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Filter for hot / trending games from real catalog
  const trendingGames = games.filter((g) => g.isHot || g.isFeatured || g.category === 'crash' || g.category === 'slots').slice(0, 10);

  if (trendingGames.length === 0) return null;

  const handleImageError = (gameId: string) => {
    setImageErrors((prev) => ({ ...prev, [gameId]: true }));
  };

  return (
    <section id="play369-trending-games-section" className="space-y-2 sm:space-y-2.5" aria-label="Trending Games">
      {/* Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
            <Flame className="w-3 h-3 fill-amber-400" />
          </div>
          <h3 className="text-xs sm:text-sm font-black text-white font-sans tracking-wide uppercase">
            Trending Games
          </h3>
        </div>

        {onViewAllTrending && (
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick(800);
              onViewAllTrending();
            }}
            className="min-h-[48px] px-2 text-xs font-mono text-amber-300 hover:text-amber-200 flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Horizontal Rail with scroll snap */}
      <div className="w-full overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-2 px-2 sm:mx-0 sm:px-0 py-1">
        <div className="flex items-stretch space-x-2.5 sm:space-x-3 min-w-max pb-1">
          {trendingGames.map((game) => {
            const isFav = favorites.includes(game.id);
            const hasError = imageErrors[game.id];

            return (
              <div
                key={`trending-${game.id}`}
                onClick={() => {
                  soundEngine.playClick(1000);
                  onLaunchGame(game.id);
                }}
                className="group relative w-28 xs:w-32 sm:w-36 rounded-2xl overflow-hidden bg-[#02180e] border border-emerald-800/60 hover:border-amber-400/80 shadow-md snap-start transition-all cursor-pointer select-none active:scale-[0.98] flex flex-col justify-between shrink-0"
                role="button"
                tabIndex={0}
                aria-label={`Play ${game.name}`}
              >
                {/* Square Image Area */}
                <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-emerald-950 via-[#032314] to-[#01140b] flex items-center justify-center">
                  {!hasError ? (
                    <img
                      src={game.imageUrl}
                      alt={game.name}
                      loading="lazy"
                      onError={() => handleImageError(game.id)}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-[#032213]">
                      <span className="text-xl mb-0.5">🎰</span>
                      <span className="text-[9px] font-mono text-emerald-300/80 font-bold truncate max-w-full">
                        {game.provider}
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#02180e] via-transparent to-transparent opacity-65" />

                  {/* Favorite Button */}
                  {onToggleFavorite && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        soundEngine.playClick(1100);
                        onToggleFavorite(game.id);
                      }}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 hover:bg-black/80 text-slate-300 hover:text-rose-400 transition-colors backdrop-blur-xs min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
                      aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-300'}`}
                      />
                    </button>
                  )}

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 flex items-center justify-center shadow-md">
                      <Play className="w-3.5 h-3.5 fill-slate-950 ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Uniform Title & Provider Container */}
                <div className="p-1.5 sm:p-2 bg-[#02180e] border-t border-emerald-900/40 flex flex-col justify-center h-11">
                  <h4 className="font-bold text-[11px] sm:text-xs text-white group-hover:text-amber-300 transition-colors truncate leading-tight">
                    {game.name}
                  </h4>
                  <p className="text-[9px] font-mono text-emerald-300/70 truncate mt-0.5 font-sans">
                    {game.provider}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
