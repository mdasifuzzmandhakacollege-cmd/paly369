/**
 * @file WageringRequirements.tsx
 * @description Enterprise Wagering Requirement & Rollover Turnover Progress component for Playall 365.
 * Features Framer Motion animated progress bars, live bet volume calculation,
 * dynamic turnover ratio pulled from the user wallet object, and 1-tap bonus-to-real cash conversion.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  TrendingUp,
  Coins,
  ShieldCheck,
  Zap,
  Gift,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertCircle,
  Percent,
  Layers,
  ChevronRight,
  Flame,
  Award
} from 'lucide-react';
import { UserEntity, WalletEntity, WageringProgressDTO, WageringRequirementEntity } from '../server/types/seamless';
import { seamlessEngine } from '../services/simulatedWalletEngine';

interface WageringRequirementsProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency?: 'BDT' | 'USD';
  onConversionSuccess?: () => void;
  compactMode?: boolean;
}

export const WageringRequirements: React.FC<WageringRequirementsProps> = ({
  currentUser,
  currentWallet,
  currency = 'BDT',
  onConversionSuccess,
  compactMode = false
}) => {
  // Extract dynamic turnover ratio from the user's wallet object (default fallback: 10x)
  const walletTurnoverRatio = currentWallet?.turnover_ratio || 10;

  const [wageringData, setWageringData] = useState<WageringProgressDTO>(
    seamlessEngine.checkBonusConversionEligibility(currentUser.id, walletTurnoverRatio)
  );
  const [requirementsList, setRequirementsList] = useState<WageringRequirementEntity[]>(
    seamlessEngine.getWageringRequirements(currentUser.id)
  );
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const refreshWagering = () => {
    const updated = seamlessEngine.checkBonusConversionEligibility(currentUser.id, walletTurnoverRatio);
    const reqs = seamlessEngine.getWageringRequirements(currentUser.id);
    setWageringData(updated);
    setRequirementsList(reqs);
  };

  useEffect(() => {
    refreshWagering();
  }, [currentUser.id, currentWallet?.real_balance, currentWallet?.bonus_balance, walletTurnoverRatio]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Convert Bonus to Real Cash
  const handleConvertBonus = async () => {
    if (!wageringData.is_eligible && (currentWallet?.bonus_balance || 0) <= 0) return;
    setIsConverting(true);

    try {
      const result = await seamlessEngine.convertBonusToRealCash(
        currentUser.id,
        currentWallet?.currency || currentUser.currency || 'BDT',
        walletTurnoverRatio
      );

      // Trigger Confetti Celebration
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#ffffff']
      });

      showToast(result.message, 'success');
      refreshWagering();
      if (onConversionSuccess) onConversionSuccess();
    } catch (err: any) {
      showToast(err.message || 'Bonus conversion failed', 'error');
    } finally {
      setIsConverting(false);
    }
  };

  // Simulate placing a bet/spin to advance turnover
  const handleSimulateBetTurnover = (amount: number) => {
    seamlessEngine.incrementWageringProgress(currentUser.id, amount);
    refreshWagering();

    // Check if new rollover is unlocked
    const check = seamlessEngine.checkBonusConversionEligibility(currentUser.id, walletTurnoverRatio);
    if (check.is_eligible && !wageringData.is_eligible) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#f59e0b', '#06b6d4']
      });
      showToast('🎉 অভিনন্দন! আপনি টার্নওভার পূরণ করেছেন। বোনাস রিয়াল ক্যাশে রূপান্তরযোগ্য!', 'success');
    } else {
      showToast(`টার্নওভার অগ্রগতি: +${currency === 'BDT' ? '৳' : '$'}${amount.toLocaleString()} যুক্ত হয়েছে`, 'info');
    }
  };

  const currencySymbol = (currentWallet?.currency || currentUser.currency || currency) === 'BDT' ? '৳' : '$';
  const effectiveBonus = currentWallet?.bonus_balance ?? wageringData.total_bonus_balance;

  // Render Compact Card mode for embedding inside Sidebars or Navbar drawers
  if (compactMode) {
    return (
      <div className="bg-slate-900/95 border border-amber-500/30 rounded-2xl p-4 shadow-xl space-y-3 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white uppercase">Wagering Progress</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
            {walletTurnoverRatio}x Rollover
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Completed Turnover:</span>
            <span className="text-amber-400 font-bold">
              {currencySymbol}{wageringData.completed_turnover.toLocaleString()} / {currencySymbol}{wageringData.active_target_turnover.toLocaleString()}
            </span>
          </div>

          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-800 relative">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-cyan-400"
              initial={{ width: 0 }}
              animate={{ width: `${wageringData.progress_percent}%` }}
              transition={{ type: 'spring', damping: 20, stiffness: 90 }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
            <span>Remaining: <strong className="text-slate-200">{currencySymbol}{wageringData.remaining_turnover.toLocaleString()}</strong></span>
            <span className="text-cyan-400 font-bold">{wageringData.progress_percent}%</span>
          </div>
        </div>

        <button
          onClick={handleConvertBonus}
          disabled={!wageringData.is_eligible || isConverting || effectiveBonus <= 0}
          className={`w-full py-2 px-3 rounded-xl text-[11px] font-bold uppercase transition-all flex items-center justify-center space-x-1.5 ${
            wageringData.is_eligible && effectiveBonus > 0
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:scale-[1.02] shadow-lg shadow-emerald-500/20'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{wageringData.is_eligible ? 'Convert to Real Cash' : `${wageringData.progress_percent}% Rollover`}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 font-mono text-xs border ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                : notification.type === 'error'
                ? 'bg-rose-950/90 border-rose-500 text-rose-300'
                : 'bg-slate-900/90 border-amber-500/50 text-amber-300'
            }`}
          >
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Wagering Requirement Hero Container */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0a0f1d] via-slate-900 to-[#141208] border border-amber-500/30 p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Glow ambient effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold uppercase">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>B2B Seamless Wagering Requirement Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              বোনাস টার্নওভার ও ক্যাশ কনভার্সন
              <span className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono font-normal border border-cyan-500/30">
                Ratio: {walletTurnoverRatio}x
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-mono">
              গেমসে বেট প্লেস করে টার্নওভার লক্ষ্য পূরণ করুন। ১০০% পূর্ণ হলে বোনাস ব্যালেন্স সরাসরি রিয়াল উইথড্রয়েবল ব্যালেন্সে যুক্ত হবে।
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center space-x-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 shrink-0 font-mono">
            <div className="text-right">
              <div className="text-slate-400 text-[10px] uppercase font-bold">লকড বোনাস ব্যালেন্স</div>
              <div className="text-amber-400 font-black text-lg sm:text-xl">
                {currencySymbol}{effectiveBonus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Coins className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 4-Stat Metric Breakdown Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
          {/* Metric 1: Completed Turnover */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>সম্পন্ন টার্নওভার</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-base sm:text-lg font-black text-white">
              {currencySymbol}{wageringData.completed_turnover.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-emerald-400 font-bold">
              {wageringData.progress_percent}% লক্ষ্য অর্জিত
            </div>
          </div>

          {/* Metric 2: Target Turnover */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>টার্গেট টার্নওভার ({walletTurnoverRatio}x)</span>
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-base sm:text-lg font-black text-cyan-300">
              {currencySymbol}{wageringData.active_target_turnover.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400">
              বোনাস × {walletTurnoverRatio} রেশিও
            </div>
          </div>

          {/* Metric 3: Remaining Turnover */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>বাকি টার্নওভার ভলিউম</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-base sm:text-lg font-black text-amber-300">
              {currencySymbol}{wageringData.remaining_turnover.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400">
              {wageringData.remaining_turnover <= 0 ? 'টার্নওভার সম্পূর্ণ!' : 'বেট ভলিউম প্রয়োজন'}
            </div>
          </div>

          {/* Metric 4: Conversion Status */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>কনভার্সন স্ট্যাটাস</span>
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className={`text-sm sm:text-base font-black ${wageringData.is_eligible ? 'text-emerald-400' : 'text-amber-400'}`}>
              {wageringData.is_eligible ? 'ELIGIBLE' : 'IN_PROGRESS'}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {wageringData.is_eligible ? 'উইথড্রয়েবল রূপান্তর প্রস্তুত' : 'টার্নওভার পূরণ চলছে'}
            </div>
          </div>
        </div>

        {/* Dynamic Framer Motion Animated Progress Bar */}
        <div className="space-y-3 bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 font-mono">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-slate-300 font-bold">লাইভ টার্নওভার প্রগ্রেস (Live Bet Volume Tracker):</span>
              <span className="text-amber-400 font-black">
                {currencySymbol}{wageringData.completed_turnover.toLocaleString()} / {currencySymbol}{wageringData.active_target_turnover.toLocaleString()}
              </span>
            </div>
            <motion.span
              key={wageringData.progress_percent}
              initial={{ scale: 1.2, color: '#f59e0b' }}
              animate={{ scale: 1, color: '#06b6d4' }}
              className="text-base font-black"
            >
              {wageringData.progress_percent}%
            </motion.span>
          </div>

          {/* Framer Motion Animated Bar with Gradient Shimmer */}
          <div className="w-full bg-slate-900 h-5 rounded-full overflow-hidden p-1 border border-slate-800 relative">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-cyan-400 relative overflow-hidden shadow-[0_0_15px_rgba(245,158,11,0.6)]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, wageringData.progress_percent)}%` }}
              transition={{ type: 'spring', damping: 20, stiffness: 90 }}
            >
              {/* Shimmer light sweep */}
              <motion.div
                className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
              />
            </motion.div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 pt-1 gap-1">
            <span>
              অনলক করতে আর প্রয়োজন: <strong className="text-white">{currencySymbol}{wageringData.remaining_turnover.toLocaleString()}</strong> বেট টার্নওভার
            </span>
            <span className="text-slate-400">
              ওয়ালেট রেশিও কনফিগ: <strong className="text-amber-400">{walletTurnoverRatio}x Turnover Multiplier</strong>
            </span>
          </div>
        </div>

        {/* 1-Tap Convert Action Button */}
        <div className="pt-2">
          <motion.button
            whileHover={{ scale: wageringData.is_eligible && effectiveBonus > 0 ? 1.01 : 1 }}
            whileTap={{ scale: wageringData.is_eligible && effectiveBonus > 0 ? 0.98 : 1 }}
            onClick={handleConvertBonus}
            disabled={!wageringData.is_eligible || isConverting || effectiveBonus <= 0}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-2xl transition-all font-sans ${
              wageringData.is_eligible && effectiveBonus > 0
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 shadow-emerald-500/30 cursor-pointer animate-pulse'
                : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
            }`}
          >
            <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            <span>
              {isConverting
                ? 'রিয়াল ক্যাশে কনভার্ট হচ্ছে...'
                : wageringData.is_eligible && effectiveBonus > 0
                ? `বোনাস রিয়াল ক্যাশে কনভার্ট করুন (${currencySymbol}${effectiveBonus.toLocaleString()})`
                : effectiveBonus <= 0
                ? 'কোনো বোনাস ব্যালেন্স পেন্ডিং নেই'
                : `টার্নওভার বাকি: ${currencySymbol}${wageringData.remaining_turnover.toLocaleString()} (${wageringData.progress_percent}% সম্পন্ন)`}
            </span>
            {wageringData.is_eligible && effectiveBonus > 0 && <ArrowRight className="w-5 h-5 stroke-[3]" />}
          </motion.button>
        </div>

        {/* Interactive Fast Simulation Controls (Tester / User Playground) */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 font-mono space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>টার্নওভার সিমুলেশন টেস্ট কন্ট্রোলস (Instant Turnover Incrementor):</span>
            </div>
            <span className="text-[10px] text-slate-500">Live Framer Motion Preview</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: `+${currencySymbol}1,000`, amount: (currency === 'BDT' ? 1000 : 10) },
              { label: `+${currencySymbol}5,000`, amount: (currency === 'BDT' ? 5000 : 50) },
              { label: `+${currencySymbol}20,000`, amount: (currency === 'BDT' ? 20000 : 200) },
              { label: `+${currencySymbol}50,000 (Complete)`, amount: (currency === 'BDT' ? 50000 : 500) }
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleSimulateBetTurnover(chip.amount)}
                className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold active:scale-95 transition-all flex items-center justify-center space-x-1 hover:border-cyan-400"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Individual Active Wagering Requirements Breakdown */}
        {requirementsList.length > 0 && (
          <div className="space-y-3 font-mono pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-white uppercase flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-amber-400" />
                অ্যাক্টিভ বোনাস ক্যাম্পেইন তালিকা ({requirementsList.length})
              </span>
              <span className="text-[11px]">Dynamic Multipliers</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {requirementsList.map((req) => {
                const reqPercent = req.target_turnover_amount > 0
                  ? Math.min(100, Math.round((req.completed_turnover_amount / req.target_turnover_amount) * 100))
                  : 100;
                const isComplete = req.status === 'COMPLETED' || reqPercent >= 100;

                return (
                  <div
                    key={req.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isComplete
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-xs text-white truncate max-w-[200px]">
                        {req.promo_name}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isComplete
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {req.required_multiplier}x Multiplier
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                      <span>বোনাস: {currencySymbol}{req.bonus_amount_granted.toLocaleString()}</span>
                      <span className="font-bold text-amber-400">
                        {currencySymbol}{req.completed_turnover_amount.toLocaleString()} / {currencySymbol}{req.target_turnover_amount.toLocaleString()}
                      </span>
                    </div>

                    {/* Mini Progress bar */}
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                      <motion.div
                        className={`h-full rounded-full ${
                          isComplete ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${reqPercent}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                      <span>ID: {req.id}</span>
                      <span className={isComplete ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                        {isComplete ? '✓ টার্নওভার সম্পন্ন' : `${reqPercent}% সম্পন্ন`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
