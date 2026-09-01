import React from 'react';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero' | 'custom';
export type LogoVariant = 'badge' | 'full' | 'horizontal' | 'compact';

interface Play369BrandLogoProps {
  size?: LogoSize;
  variant?: LogoVariant;
  className?: string;
  glow?: boolean;
  withText?: boolean;
  onClick?: () => void;
  priority?: boolean;
}

const sizeMap: Record<LogoSize, { img: string; text: string; sub: string }> = {
  xs: { img: 'w-7 h-7', text: 'text-sm', sub: 'text-[9px]' },
  sm: { img: 'w-9 h-9 sm:w-10 sm:h-10', text: 'text-base sm:text-lg', sub: 'text-[10px]' },
  md: { img: 'w-12 h-12 sm:w-14 sm:h-14', text: 'text-xl sm:text-2xl', sub: 'text-xs' },
  lg: { img: 'w-20 h-20 sm:w-24 sm:h-24', text: 'text-2xl sm:text-3xl', sub: 'text-xs sm:text-sm' },
  xl: { img: 'w-28 h-28 sm:w-32 sm:h-32', text: 'text-3xl sm:text-4xl', sub: 'text-sm' },
  '2xl': { img: 'w-36 h-36 sm:w-44 sm:h-44', text: 'text-4xl sm:text-5xl', sub: 'text-base' },
  hero: { img: 'w-48 h-48 sm:w-60 sm:h-60', text: 'text-5xl sm:text-6xl', sub: 'text-lg' },
  custom: { img: '', text: '', sub: '' }
};

export const Play369BrandLogo: React.FC<Play369BrandLogoProps> = ({
  size = 'md',
  variant = 'badge',
  className = '',
  glow = true,
  withText = false,
  onClick
}) => {
  const sizeClasses = sizeMap[size];

  if (variant === 'badge' || variant === 'full') {
    return (
      <div
        onClick={onClick}
        className={`relative inline-flex flex-col items-center justify-center select-none ${
          onClick ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-300' : ''
        } ${className}`}
      >
        {/* Ambient Gold & Emerald Specular Glow */}
        {glow && (
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-tr from-amber-500/25 via-emerald-500/20 to-yellow-400/25 blur-xl -z-10 transform scale-110" />
        )}

        <div className={`relative ${sizeClasses.img} flex items-center justify-center`}>
          <img
            src="/play369-logo.svg"
            alt="PLAY369 Official Emblem"
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)] filter"
            loading="eager"
          />
        </div>

        {withText && (
          <div className="mt-2 text-center">
            <h1 className={`font-black tracking-tight text-white ${sizeClasses.text} uppercase font-sans`}>
              PLAY<span className="text-transparent bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text">369</span>
            </h1>
            <p className={`font-extrabold tracking-widest text-amber-300/90 uppercase ${sizeClasses.sub}`}>
              Next-Gen Seamless Gaming
            </p>
          </div>
        )}
      </div>
    );
  }

  // Horizontal Brand Layout (Logo mark + Typography)
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center space-x-3 select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      <div className={`relative ${sizeClasses.img} shrink-0`}>
        {glow && (
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-amber-500/30 blur-md -z-10" />
        )}
        <img
          src="/play369-logo.svg"
          alt="PLAY369 Logo"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
          loading="eager"
        />
      </div>

      <div className="flex flex-col text-left">
        <div className="flex items-center space-x-1.5">
          <span className={`font-black tracking-tight text-white ${sizeClasses.text} font-sans leading-none`}>
            PLAY<span className="text-transparent bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text">369</span>
          </span>
          <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase tracking-widest">
            CASINO
          </span>
        </div>
        <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-emerald-300/80 uppercase mt-0.5">
          Next-Gen Seamless Gaming
        </span>
      </div>
    </div>
  );
};
