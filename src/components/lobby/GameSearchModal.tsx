/**
 * @file GameSearchModal.tsx
 * @description Luxury Emerald & Gold Game Search and Discovery Modal for PLAY369.
 * Fast client-side searching across title, provider, and category tags.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Flame, Sparkles, ArrowRight, Play } from 'lucide-react';
import { GameItem } from '../../services/providers/types';
import { soundEngine } from '../../services/soundEngine';

export interface GameSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: GameItem[];
  onLaunchGame: (gameId: string) => void;
}

export const GameSearchModal: React.FC<GameSearchModalProps> = ({
  isOpen,
  onClose,
  games,
  onLaunchGame
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const searchResults = games.filter((game) => {
    if (!normalizedQuery) return false;
    const matchName = game.name.toLowerCase().includes(normalizedQuery);
    const matchNameBn = game.nameBn?.toLowerCase().includes(normalizedQuery);
    const matchProvider = game.provider.toLowerCase().includes(normalizedQuery);
    const matchCategory = game.category.toLowerCase().includes(normalizedQuery);
    const matchTag = game.tags?.some((t) => t.toLowerCase().includes(normalizedQuery));
    return matchName || matchNameBn || matchProvider || matchCategory || matchTag;
  });

  const popularTags = ['Aviator', 'Olympus', 'Super Ace', 'Mahjong', 'Baccarat', 'Cricket', 'Mines', 'Evolution'];

  return (
    <div
      id="play369-search-modal-backdrop"
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 pt-16 sm:pt-24 bg-black/85 backdrop-blur-md transition-opacity"
      onClick={onClose}
    >
      <div
        id="play369-search-modal-container"
        className="bg-[#02180e] border-2 border-emerald-700/80 rounded-3xl w-full max-w-xl p-4 sm:p-6 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header and Close */}
        <div className="flex items-center justify-between border-b border-emerald-800/60 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white font-sans">
                Search Games & Providers
              </h3>
              <p className="text-[11px] text-emerald-300/70 font-sans">
                Type game name, provider or game style
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundEngine.playClick(600);
              onClose();
            }}
            className="min-h-[48px] min-w-[48px] p-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Field with min 48px touch target */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
          <input
            ref={inputRef}
            id="play369-search-input"
            type="text"
            placeholder="Search by game name, provider (e.g. Spribe, JILI, PG Soft)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[48px] bg-[#010f09] border border-emerald-700/80 focus:border-amber-400 rounded-2xl pl-11 pr-10 py-3 text-sm text-white placeholder-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              aria-label="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Tag Recommendations */}
        {!searchQuery && (
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-mono text-emerald-300/70 uppercase tracking-wider flex items-center space-x-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Trending Searches</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {popularTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    soundEngine.playClick(800);
                    setSearchQuery(tag);
                  }}
                  className="min-h-[40px] px-3 py-1 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-xs text-emerald-200 hover:text-amber-300 transition-colors cursor-pointer font-sans"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results List */}
        <div className="max-h-72 overflow-y-auto space-y-2 divide-y divide-emerald-900/40 pr-1 scrollbar-none">
          {searchQuery && searchResults.length === 0 && (
            <div className="py-8 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-emerald-600/60 mx-auto" />
              <p className="text-sm font-bold text-white">No games found for "{searchQuery}"</p>
              <p className="text-xs text-emerald-300/70">
                Try searching for popular providers like "Pragmatic", "Spribe", or "JILI"
              </p>
            </div>
          )}

          {searchResults.map((game) => (
            <div
              key={game.id}
              onClick={() => {
                soundEngine.playClick(1000);
                onClose();
                onLaunchGame(game.id);
              }}
              className="pt-2 flex items-center justify-between p-2 rounded-2xl hover:bg-emerald-900/50 cursor-pointer transition-colors group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <img
                  src={game.imageUrl}
                  alt={game.name}
                  className="w-12 h-12 rounded-xl object-cover border border-emerald-800/80 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                    {game.name}
                  </div>
                  <div className="text-[11px] text-emerald-300/70 font-sans truncate">
                    {game.provider} • <span className="font-mono text-amber-400">{game.maxMultiplier}</span>
                  </div>
                </div>
              </div>

              <button
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs font-mono shadow-sm flex items-center space-x-1 shrink-0 ml-2"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>Play</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
