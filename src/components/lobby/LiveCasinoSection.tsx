/**
 * @file LiveCasinoSection.tsx
 * @description Luxury Live Casino Horizontal Swipe Section for PLAY369 Mobile Dashboard.
 * Displays authoritative Live Casino tables (Evolution, Pragmatic Live, Ezugi) with horizontal swipe cards.
 */

import React, { useState } from 'react';
import { ChevronRight, Play } from 'lucide-react';
import { GameItem } from '../../services/providers/types';
import { soundEngine } from '../../services/soundEngine';

export interface LiveCasinoSectionProps {
  games: GameItem[];
  onLaunchGame: (gameId: string) => void;
  onViewAllCasino?: () => void;
}

export const LiveCasinoSection: React.FC<LiveCasinoSectionProps> = ({
  games,
  onLaunchGame,
  onViewAllCasino
}) => {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Filter for casino games from real catalog
  const liveCasinoGames = games.filter((g) => g.category === 'casino' || g.category === 'table').slice(0, 8);

  if (liveCasinoGames.length === 0) return null;

  const handleImageError = (gameId: string) => {
    setImageErrors((prev) => ({ ...prev, [gameId]: true }));
  };

  return (
    <section id="play369-live-casino-section" className="space-y-2 sm:space-y-2.5" aria-label="Live Casino Games">
      {/* Section Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <h3 className="text-xs sm:text-sm font-black text-white font-sans tracking-wide uppercase">
            Live Casino
          </h3>
        </div>

        {onViewAllCasino && (
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick(800);
              onViewAllCasino();
            }}
            className="min-h-[48px] px-2 text-xs font-mono text-amber-300 hover:text-amber-200 flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Horizontal Swipe Rail with scroll snap */}
      <div className="w-full overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-2 px-2 sm:mx-0 sm:px-0 py-1">
        <div className="flex items-stretch space-x-2.5 sm:space-x-3.5 min-w-max pb-1">
          {liveCasinoGames.map((game) => {
            const hasError = imageErrors[game.id];

            return (
              <div
                key={`live-${game.id}`}
                onClick={() => {
                  soundEngine.playClick(1000);
                  onLaunchGame(game.id);
                }}
                className="group relative w-36 xs:w-40 sm:w-44 rounded-2xl overflow-hidden bg-[#02180e] border border-emerald-800/70 hover:border-amber-400/80 shadow-md snap-start transition-all cursor-pointer select-none active:scale-[0.98] flex flex-col justify-between"
                role="button"
                tabIndex={0}
                aria-label={`Play ${game.name}`}
              >
                {/* Image Area with 4:3 Aspect Ratio */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-emerald-950 via-[#032314] to-[#01140b] flex items-center justify-center">
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
                      <span className="text-2xl mb-1">♠️</span>
                      <span className="text-[10px] font-mono text-emerald-300/80 font-bold truncate max-w-full">
                        {game.provider}
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#02180e] via-transparent to-transparent opacity-60" />

                  {/* Play Button Overlay on Hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Title & Provider */}
                <div className="p-2 sm:p-2.5 bg-[#02180e] border-t border-emerald-900/60 flex flex-col justify-center min-h-[44px]">
                  <h4 className="font-bold text-xs text-white group-hover:text-amber-300 transition-colors truncate leading-tight">
                    {game.name}
                  </h4>
                  <p className="text-[10px] font-mono text-emerald-300/70 truncate mt-0.5">
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
