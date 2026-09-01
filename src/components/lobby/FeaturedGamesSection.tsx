/**
 * @file FeaturedGamesSection.tsx
 * @description Luxury Emerald & Gold Featured Game Hero Showcase for PLAY369.
 * Utilizes Golden Ratio proportions and interactive promotional carousel slides.
 */

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Sparkles, Flame, ShieldCheck, Zap } from 'lucide-react';
import { MOCK_FEATURED_SLIDES, MockFeaturedHeroSlide } from '../../data/mockGamesData';
import { soundEngine } from '../../services/soundEngine';

export interface FeaturedGamesSectionProps {
  onLaunchGame: (gameId: string) => void;
  onOpenCashier?: () => void;
  slides?: MockFeaturedHeroSlide[];
}

export const FeaturedGamesSection: React.FC<FeaturedGamesSectionProps> = ({
  onLaunchGame,
  onOpenCashier,
  slides
}) => {
  const effectiveSlides = slides && slides.length > 0 ? slides : MOCK_FEATURED_SLIDES;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-cycle slides every 4.2 seconds unless hovered
  useEffect(() => {
    if (isPaused || effectiveSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % effectiveSlides.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [isPaused, effectiveSlides.length]);

  const activeSlide = effectiveSlides[currentIndex] || effectiveSlides[0];

  if (!activeSlide) return null;

  const handleSlideAction = (slide: MockFeaturedHeroSlide) => {
    soundEngine.playClick(1100);
    if (slide.targetGameId) {
      onLaunchGame(slide.targetGameId);
    } else if (slide.targetAction === 'cashier' && onOpenCashier) {
      onOpenCashier();
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playClick(700);
    setCurrentIndex((prev) => (prev - 1 + effectiveSlides.length) % effectiveSlides.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playClick(700);
    setCurrentIndex((prev) => (prev + 1) % effectiveSlides.length);
  };

  return (
    <section
      id="play369-featured-hero-section"
      className="relative w-full rounded-3xl overflow-hidden border border-emerald-700/80 shadow-[0_12px_40px_rgba(0,0,0,0.8)] bg-[#02180e]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Featured Games Showcase"
    >
      <div
        className={`relative min-h-[160px] sm:min-h-[220px] md:min-h-[260px] w-full bg-gradient-to-r ${activeSlide.bgGradient} border-2 ${activeSlide.borderColor} p-4 sm:p-7 md:p-8 flex items-center justify-between overflow-hidden transition-all duration-500`}
      >
        {/* Subtle Ambient Radial Glow */}
        <div
          className="absolute -top-12 right-1/4 w-80 h-44 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: activeSlide.accentColor }}
        />

        {/* Left Content Area */}
        <div className="relative z-10 max-w-[72%] sm:max-w-md md:max-w-lg space-y-2 sm:space-y-3">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-sm">
              <Sparkles className="w-3 h-3 text-slate-950" />
              <span>{activeSlide.tag}</span>
            </span>

            {activeSlide.multiplierText && (
              <span className="hidden xs:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                Max {activeSlide.multiplierText}
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-2xl md:text-3xl font-black text-white leading-tight drop-shadow-md font-sans">
            {activeSlide.title}
          </h2>

          <p className="text-xs sm:text-sm text-emerald-100/80 line-clamp-2 hidden xs:block font-sans">
            {activeSlide.subtitle}
          </p>

          <div className="pt-1 flex items-center space-x-3">
            <button
              id={`play369-hero-action-${activeSlide.id}`}
              onClick={() => handleSlideAction(activeSlide)}
              className="min-h-[48px] px-4 sm:px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm font-mono shadow-[0_4px_20px_rgba(245,158,11,0.4)] active:scale-95 transition-all cursor-pointer flex items-center space-x-2"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>{activeSlide.btnText}</span>
            </button>

            {activeSlide.rtpText && (
              <div className="hidden sm:flex flex-col text-[10px] font-mono text-emerald-300/80">
                <span>RTP Verified</span>
                <span className="font-bold text-amber-300">{activeSlide.rtpText}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Visual Graphic */}
        <div className="relative z-10 pr-2 sm:pr-6 shrink-0 flex items-center justify-center">
          <div className="w-20 h-20 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-3xl bg-emerald-950/60 border border-emerald-600/40 flex items-center justify-center text-4xl sm:text-6xl md:text-7xl shadow-2xl backdrop-blur-xs select-none transform hover:scale-105 transition-transform">
            {activeSlide.iconEmoji}
          </div>
        </div>
      </div>

      {/* Navigation Indicators & Manual Buttons */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-1.5 bg-[#02180e]/80 border border-emerald-800/80 px-3 py-1.5 rounded-full backdrop-blur-md">
        {effectiveSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              soundEngine.playClick(800);
              setCurrentIndex(i);
            }}
            className={`min-h-[24px] min-w-[24px] flex items-center justify-center cursor-pointer`}
            aria-label={`Show featured slide ${i + 1}`}
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                currentIndex === i
                  ? 'w-6 bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                  : 'w-2 bg-emerald-700 hover:bg-emerald-500'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Arrow Controls (Min 48px touch targets) */}
      <button
        onClick={handlePrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 min-h-[48px] min-w-[48px] rounded-2xl bg-[#02180e]/70 border border-emerald-700/60 text-emerald-200 flex items-center justify-center hover:bg-[#02180e] hover:text-white transition-colors hidden sm:flex cursor-pointer"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        onClick={handleNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 min-h-[48px] min-w-[48px] rounded-2xl bg-[#02180e]/70 border border-emerald-700/60 text-emerald-200 flex items-center justify-center hover:bg-[#02180e] hover:text-white transition-colors hidden sm:flex cursor-pointer"
        aria-label="Next slide"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </section>
  );
};
