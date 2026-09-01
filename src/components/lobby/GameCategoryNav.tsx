/**
 * @file GameCategoryNav.tsx
 * @description Luxury Emerald & Gold Game Category Navigation for PLAY369 Mobile Dashboard.
 * Presents premium square/pill icon buttons with centered icons, 48px+ touch targets,
 * gold active states, and zero text compression.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { MOCK_CATEGORIES, MockCategory } from '../../data/mockGamesData';
import { soundEngine } from '../../services/soundEngine';

export interface GameCategoryNavProps {
  activeCategory: string;
  onSelectCategory: (categoryId: string) => void;
  categories?: MockCategory[];
}

export const GameCategoryNav: React.FC<GameCategoryNavProps> = ({
  activeCategory,
  onSelectCategory,
  categories = MOCK_CATEGORIES
}) => {
  const handleCategoryClick = (catId: string) => {
    soundEngine.playClick(900);
    onSelectCategory(catId);
  };

  return (
    <nav
      id="play369-category-nav"
      className="w-full overflow-x-auto scrollbar-none snap-x snap-mandatory py-1 -mx-2 px-2 sm:mx-0 sm:px-0"
      aria-label="Game Categories"
    >
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-max pb-1">
        {categories.map((cat) => {
          const isSelected = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              id={`play369-cat-btn-${cat.id}`}
              onClick={() => handleCategoryClick(cat.id)}
              className={`group flex flex-col items-center justify-center min-w-[68px] sm:min-w-[76px] min-h-[56px] sm:min-h-[62px] px-3 py-2 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 select-none relative snap-start shrink-0 ${
                isSelected
                  ? 'bg-gradient-to-b from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-[0_4px_16px_rgba(245,158,11,0.35)] border border-amber-300 font-black'
                  : 'bg-[#02180e]/90 hover:bg-[#032415] border border-emerald-800/70 hover:border-emerald-600 text-emerald-200 hover:text-white shadow-sm'
              }`}
              aria-pressed={isSelected}
              aria-label={`${cat.label} category`}
            >
              {/* Centered Emoji / Icon */}
              <span className="text-xl sm:text-2xl leading-none transition-transform group-hover:scale-110 drop-shadow-sm">
                {cat.icon}
              </span>

              {/* Short Label */}
              <span className={`text-[11px] sm:text-xs font-sans whitespace-nowrap mt-1 leading-tight tracking-tight ${
                isSelected ? 'font-black text-slate-950' : 'font-semibold text-emerald-100/90'
              }`}>
                {cat.label}
              </span>

              {/* Active Golden Indicator */}
              {isSelected && (
                <motion.span
                  layoutId="categoryActiveIndicator"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
