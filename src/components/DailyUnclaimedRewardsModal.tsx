/**
 * @file DailyUnclaimedRewardsModal.tsx
 * @description Clean Asian-market Emerald & Gold Unclaimed Rewards Modal for GamePlay365.
 * Lists all pending, unclaimed user rewards (VIP Weekly Salary, Desktop Shortcut Bonus,
 * Daily Login Streak, Loss Rebate Cashback, Referral Commission) with countdown timers,
 * reward amounts, individual "Claim" buttons, and a global "Claim All" action.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Gift,
  Clock,
  CheckCircle2,
  Sparkles,
  Zap,
  Crown,
  Download,
  Coins,
  ShieldCheck,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { soundEngine } from '../services/soundEngine';
import { useWalletGame } from '../contexts/WalletGameContext';

interface DailyUnclaimedRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: 'BDT' | 'USD';
}

interface PendingReward {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  icon: string;
  category: 'VIP' | 'APP' | 'DAILY' | 'CASHBACK' | 'AFFILIATE';
  countdownSeconds: number; // Seconds until expiration
  isClaimed: boolean;
}

const INITIAL_REWARDS: PendingReward[] = [];

export const DailyUnclaimedRewardsModal: React.FC<DailyUnclaimedRewardsModalProps> = ({
  isOpen,
  onClose,
  currency
}) => {
  const { topUpWallet, showToast, refreshState } = useWalletGame();
  const [rewards, setRewards] = useState<PendingReward[]>(INITIAL_REWARDS);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [isClaimingAll, setIsClaimingAll] = useState<boolean>(false);

  // Live Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setRewards((prev) =>
        prev.map((r) => ({
          ...r,
          countdownSeconds: Math.max(0, r.countdownSeconds - 1)
        }))
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const rateMultiplier = currency === 'BDT' ? 1 : 1 / 120;

  const formatCountdown = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const unclaimedList = rewards.filter((r) => !r.isClaimed);
  const totalUnclaimedAmount = unclaimedList.reduce(
    (sum, r) => sum + Math.round(r.amount * rateMultiplier),
    0
  );

  const handleClaimReward = (reward: PendingReward) => {
    if (reward.isClaimed || claimingId) return;

    setClaimingId(reward.id);
    soundEngine.playClick(1100);

    const creditedAmount = Math.round(reward.amount * rateMultiplier);

    setTimeout(() => {
      setRewards((prev) =>
        prev.map((r) => (r.id === reward.id ? { ...r, isClaimed: true } : r))
      );
      setClaimingId(null);

      // Sound & Wallet TopUp
      soundEngine.playWalletCredit();
      topUpWallet(creditedAmount);
      refreshState();
      showToast(`🎉 ${reward.title} থেকে ${currency === 'BDT' ? '৳' : '$'}${creditedAmount.toLocaleString()} ক্লেইম করা হয়েছে!`);
    }, 500);
  };

  const handleClaimAll = () => {
    if (unclaimedList.length === 0 || isClaimingAll) return;

    setIsClaimingAll(true);
    soundEngine.playBigWinCelebration();

    setTimeout(() => {
      setRewards((prev) => prev.map((r) => ({ ...r, isClaimed: true })));
      setIsClaimingAll(false);

      topUpWallet(totalUnclaimedAmount);
      refreshState();
      showToast(`🎉 সফলভাবে এক ক্লিকে ${currency === 'BDT' ? '৳' : '$'}${totalUnclaimedAmount.toLocaleString()} ক্লেইম করা হয়েছে!`);
    }, 800);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-xl rounded-2xl bg-gradient-to-b from-emerald-900 via-emerald-950 to-[#021a10] border-2 border-amber-400/50 shadow-[0_0_50px_rgba(16,185,129,0.25)] overflow-hidden text-white font-sans flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="relative px-6 py-4 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 border-b border-amber-400/30 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <div className="w-full h-full bg-emerald-950 rounded-[10px] flex items-center justify-center">
                  <Gift className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-black tracking-tight text-white">
                    অদাবিকৃত রিওয়ার্ড ভল্ট
                  </h3>
                  {unclaimedList.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] font-mono">
                      {unclaimedList.length}টি পেন্ডিং
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-200/80">
                  মেয়াদ শেষ হওয়ার আগে আপনার জমা হওয়া বোনাস ও স্যালারি ক্লেইম করুন
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                soundEngine.playClick(800);
                onClose();
              }}
              className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 hover:text-white hover:border-amber-400 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Pending Rewards Total Banner */}
          {unclaimedList.length > 0 && (
            <div className="mx-6 mt-4 p-3.5 rounded-xl bg-emerald-950/80 border border-amber-400/40 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-5 h-5 text-amber-400 animate-spin-slow" />
                <div>
                  <div className="text-[11px] text-emerald-300 font-medium">মোট ক্লেইমযোগ্য ব্যালেন্স</div>
                  <div className="text-lg font-black text-amber-300 font-mono">
                    {currency === 'BDT' ? '৳' : '$'}{totalUnclaimedAmount.toLocaleString()}
                  </div>
                </div>
              </div>

              <button
                onClick={handleClaimAll}
                disabled={isClaimingAll}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center space-x-1"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{isClaimingAll ? 'ক্লেইম হচ্ছে...' : 'সব ক্লেইম করুন (Claim All)'}</span>
              </button>
            </div>
          )}

          {/* Rewards List (Scrollable) */}
          <div className="p-6 overflow-y-auto space-y-3 flex-1 scrollbar-thin scrollbar-thumb-emerald-700">
            {rewards.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-950/80 border border-emerald-700/50 flex items-center justify-center text-emerald-400">
                  <Gift className="w-7 h-7 text-amber-400" />
                </div>
                <h4 className="text-sm font-bold text-white">বর্তমানে কোনো অদাবিকৃত রিওয়ার্ড নেই</h4>
                <p className="text-xs text-emerald-200/60 max-w-md mx-auto leading-relaxed">
                  নিয়মিত ডিপোজিট, টার্নওভার, ভিআইপি লেভেল-আপ এবং রেফারেল মেম্বারদের গেমপ্লে সম্পন্ন হলে নতুন রিওয়ার্ড স্বয়ংক্রিয়ভাবে এখানে যোগ হবে।
                </p>
              </div>
            ) : (
              rewards.map((reward) => {
              const amountFormatted = Math.round(reward.amount * rateMultiplier);
              return (
                <div
                  key={reward.id}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3 ${
                    reward.isClaimed
                      ? 'bg-emerald-950/30 border-emerald-900/40 opacity-60'
                      : 'bg-emerald-900/50 hover:bg-emerald-800/60 border-emerald-600/40 hover:border-amber-400/60 shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-2xl shrink-0">
                      {reward.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <div className="text-xs sm:text-sm font-bold text-white truncate">
                          {reward.title}
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-950 text-amber-300 border border-amber-400/30 shrink-0">
                          {reward.category}
                        </span>
                      </div>

                      <p className="text-[11px] text-emerald-200/80 truncate mt-0.5">
                        {reward.subtitle}
                      </p>

                      <div className="flex items-center space-x-3 text-[10px] font-mono text-emerald-300/80 mt-1">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>মেয়াদ: {formatCountdown(reward.countdownSeconds)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Amount & Claim Button */}
                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-emerald-300 font-medium">পুরস্কার</div>
                      <div className="text-sm sm:text-base font-black text-amber-300 font-mono">
                        +{currency === 'BDT' ? '৳' : '$'}{amountFormatted.toLocaleString()}
                      </div>
                    </div>

                    {reward.isClaimed ? (
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 text-xs font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ক্লেইমড</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleClaimReward(reward)}
                        disabled={claimingId === reward.id}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                      >
                        {claimingId === reward.id ? 'ক্লেইম...' : 'ক্লেইম (Claim)'}
                      </button>
                    )}
                  </div>
                </div>
              );
            }))}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-emerald-950/90 border-t border-emerald-800/80 flex items-center justify-between shrink-0 text-xs">
            <div className="text-emerald-300/80 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>১০০% ইনস্ট্যান্ট ক্যাশিয়ার ওয়ালেট ব্যালেন্স ক্রেডিট</span>
            </div>

            <button
              onClick={() => {
                soundEngine.playClick(900);
                onClose();
              }}
              className="px-4 py-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 border border-emerald-700 text-white text-xs font-bold transition-all cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
