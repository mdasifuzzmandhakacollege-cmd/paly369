/**
 * @file GameCard.tsx
 * @description Reusable luxury Emerald & Gold Game Card component for PLAY369.
 * Architected with clean props so that a future real Provider Adapter can feed 
 * game payloads directly without modifying the UI layer.
 */

import React, { useState } from 'react';
import { Play, Flame, Heart, Zap, Sparkles } from 'lucide-react';
import { GameItem } from '../../services/providers/types';
import { soundEngine } from '../../services/soundEngine';

export interface GameCardProps {
  game: GameItem;
  onLaunch: (gameId: string) => void;
  onToggleFavorite?: (gameId: string) => void;
  isFavorite?: boolean;
  className?: string;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  onLaunch,
  onToggleFavorite,
  isFavorite = false,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleCardClick = () => {
    soundEngine.playClick(1000);
    onLaunch(game.id);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playClick(1200);
    if (onToggleFavorite) {
      onToggleFavorite(game.id);
    }
  };

  // Badge color scheme based on game badge type
  const getBadgeStyle = (badgeText?: string) => {
    if (!badgeText) return null;
    const upper = badgeText.toUpperCase();
    if (upper.includes('HOT') || upper.includes('#1')) {
      return 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    }
    return 'bg-[#02180e] border border-amber-400/60 text-amber-300 font-bold';
  };

  const getCategoryFallbackIcon = (category?: string) => {
    switch (category) {
      case 'casino':
      case 'table':
        return '♠️';
      case 'crash':
        return '🚀';
      case 'sports':
        return '⚽';
      case 'fishing':
        return '🎣';
      default:
        return '🎰';
    }
  };

  return (
    <div
      id={`play369-gamecard-${game.id}`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex flex-col justify-between bg-[#031c11]/90 hover:bg-[#062919] border border-emerald-800/60 hover:border-amber-400/80 rounded-2xl overflow-hidden shadow-md hover:shadow-[0_8px_25px_rgba(245,158,11,0.25)] transition-all duration-200 cursor-pointer select-none active:scale-[0.97] ${className}`}
      role="button"
      tabIndex={0}
      aria-label={`Play ${game.name} by ${game.provider}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* Top Image Container with square aspect ratio */}
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-emerald-950 via-[#032314] to-[#01140b] flex items-center justify-center">
        {/* Placeholder shimmer before image loads */}
        {!imageLoaded && !hasError && (
          <div className="absolute inset-0 bg-emerald-950/40 animate-pulse flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-600/40" />
          </div>
        )}

        {!hasError ? (
          <img
            src={game.imageUrl}
            alt={game.name}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setHasError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[#021e12]">
            <span className="text-3xl mb-1">{getCategoryFallbackIcon(game.category)}</span>
            <span className="text-[10px] font-mono text-emerald-300/80 font-bold truncate max-w-full">
              {game.provider}
            </span>
          </div>
        )}

        {/* Ambient bottom gradient shade */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#031c11] via-transparent to-transparent opacity-75 pointer-events-none" />

        {/* Top Badges (Hot / Featured) */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
          {game.badge ? (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono tracking-tight shadow uppercase ${getBadgeStyle(
                game.badge
              )}`}
            >
              {game.badge}
            </span>
          ) : (
            <span />
          )}

          {/* Favorite Toggle Button */}
          {onToggleFavorite && (
            <button
              onClick={handleFavoriteClick}
              className="pointer-events-auto p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-slate-300 hover:text-rose-400 transition-colors backdrop-blur-xs min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-300'
                }`}
              />
            </button>
          )}
        </div>

        {/* Hover / Focus Overlay with Instant Play CTA */}
        <div
          className={`absolute inset-0 bg-[#02180e]/85 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-center transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center shadow-[0_4px_15px_rgba(245,158,11,0.5)] transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
          </div>
          <span className="mt-2 text-[11px] font-black uppercase tracking-wider text-amber-300 font-sans">
            Play Now
          </span>
        </div>
      </div>

      {/* Bottom Information Container */}
      <div className="p-2 sm:p-2.5 bg-[#031c11] border-t border-emerald-900/50 flex flex-col justify-center h-12">
        <h4 className="font-bold text-xs text-white group-hover:text-amber-300 transition-colors truncate drop-shadow-xs leading-tight">
          {game.name}
        </h4>
        <p className="text-[10px] font-mono text-emerald-300/70 truncate mt-0.5 font-sans">
          {game.provider}
        </p>
      </div>
    </div>
  );
};
