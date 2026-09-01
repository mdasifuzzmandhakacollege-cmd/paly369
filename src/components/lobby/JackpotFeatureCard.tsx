/**
 * @file JackpotFeatureCard.tsx
 * @description Luxury Highlighted Event & Featured Summary Card for PLAY369.
 * Uses existing authoritative promotional and game catalog data without fabricating fake numbers.
 */

import React from 'react';
import { Sparkles, Play, ArrowRight, Zap, Trophy, ShieldCheck } from 'lucide-react';
import { MockFeaturedHeroSlide } from '../../data/mockGamesData';
import { soundEngine } from '../../services/soundEngine';

export interface JackpotFeatureCardProps {
  slide?: MockFeaturedHeroSlide;
  onLaunchGame: (gameId: string) => void;
  onOpenCashier: () => void;
}

export const JackpotFeatureCard: React.FC<JackpotFeatureCardProps> = ({
  slide,
  onLaunchGame,
  onOpenCashier
}) => {
  const currentSlide = slide || {
    id: 'hero-olympus',
    tag: 'FEATURED SPOTLIGHT',
    title: 'Gates of Olympus 1000',
    titleBn: 'গেটস অফ অলিম্পাস ১০০০',
    subtitle: 'Pragmatic Play tumbling slot with chain-reaction scatter wins.',
    btnText: 'Play Now',
    targetGameId: 'vs20olympgate',
    bgGradient: 'from-amber-950/60 via-[#032415] to-[#01140b]',
    borderColor: 'border-amber-500/40',
    accentColor: '#f59e0b',
    iconEmoji: '⚡'
  };

  const handleAction = () => {
    soundEngine.playClick(1100);
    if (currentSlide.targetGameId) {
      onLaunchGame(currentSlide.targetGameId);
    } else {
      onOpenCashier();
    }
  };

  return (
    <section
      id="play369-jackpot-feature-card"
      className="relative w-full rounded-3xl overflow-hidden border border-amber-500/25 bg-gradient-to-r from-[#032314] via-[#02180e] to-[#042818] p-4 sm:p-5 shadow-xl transition-all"
      aria-label="Featured Spotlight Game"
    >
      {/* Soft Controlled Glow */}
      <div className="absolute -top-12 -right-8 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-6">
        {/* Left: Highlight details */}
        <div className="space-y-1.5 max-w-[72%] sm:max-w-md">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-sm">
              <Sparkles className="w-3 h-3 text-slate-950" />
              <span>{currentSlide.tag || 'FEATURED'}</span>
            </span>
          </div>

          <h3 className="text-base sm:text-xl font-black text-white font-sans drop-shadow-sm leading-tight">
            {currentSlide.title}
          </h3>

          <p className="text-xs text-emerald-200/80 line-clamp-1 font-sans hidden xs:block">
            {currentSlide.subtitle}
          </p>

          <div className="pt-1">
            <button
              type="button"
              id="play369-jackpot-feature-cta"
              onClick={handleAction}
              className="min-h-[48px] px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs font-sans uppercase tracking-wider shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950 shrink-0" />
              <span>{currentSlide.btnText || 'Play Now'}</span>
            </button>
          </div>
        </div>

        {/* Right: Graphic / Badge */}
        <div className="relative shrink-0 pr-1 sm:pr-4 flex items-center justify-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-3xl sm:text-4xl shadow-xl backdrop-blur-xs select-none">
            {currentSlide.iconEmoji || '⚡'}
          </div>
        </div>
      </div>
    </section>
  );
};
