import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Crown, Sparkles, Gift, ArrowRight, Award, CheckCircle2, X } from 'lucide-react';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  rewardAmount?: number;
  currency?: string;
  type?: 'MEGA_WIN' | 'VIP_UPGRADE' | 'CHECKIN_STREAK' | 'COMMISSION';
  onClaim?: () => void;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  rewardAmount,
  currency = 'BDT',
  type = 'MEGA_WIN',
  onClaim
}) => {
  useEffect(() => {
    if (isOpen) {
      // Fire confetti bursts
      const duration = 2.5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: Math.random() * 0.4 + 0.3, y: Math.random() - 0.2 },
          colors: ['#f59e0b', '#06b6d4', '#ec4899', '#10b981', '#ffffff']
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#121622] via-[#090b12] to-[#040609] border border-amber-500/50 p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.3)] text-center space-y-5 animate-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Animated Icon Glow */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-600 animate-spin blur-md opacity-75" />
          <div className="relative w-18 h-18 rounded-full bg-[#090b12] border-2 border-amber-400 flex items-center justify-center shadow-inner">
            {type === 'VIP_UPGRADE' ? (
              <Crown className="w-10 h-10 text-amber-400 animate-bounce" />
            ) : type === 'CHECKIN_STREAK' ? (
              <Gift className="w-10 h-10 text-cyan-400 animate-bounce" />
            ) : (
              <Award className="w-10 h-10 text-amber-400 animate-bounce" />
            )}
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>GAMEPLAY365 REWARD</span>
          </div>
          <h2 className="text-2xl font-black text-white font-sans mt-2">{title}</h2>
          <p className="text-xs text-slate-400 font-mono">{subtitle}</p>
        </div>

        {/* Reward Pill */}
        {rewardAmount !== undefined && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-amber-500/15 border border-amber-500/40 font-mono">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">
              জয়ী পুরস্কার (Prize Amount)
            </div>
            <div className="text-3xl font-black bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-300 bg-clip-text text-transparent mt-1">
              {currency === 'BDT' ? '৳' : '$'}
              {rewardAmount.toLocaleString()}
            </div>
          </div>
        )}

        {/* Claim Action Button */}
        <button
          onClick={() => {
            if (onClaim) onClaim();
            onClose();
          }}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
        >
          <span>পুরস্কার ক্লেইম করুন (Claim Now)</span>
          <ArrowRight className="w-4 h-4 stroke-[3]" />
        </button>
      </div>
    </div>
  );
};
