/**
 * @file DailyMissions.tsx
 * @description Daily Missions & Task Completion Rewards engine for Playall 365.
 * Structured with harmonious visual proportion, balanced hierarchy, responsive mobile layout,
 * tracks tasks like 'Make 5 bets', 'Deposit 500 BDT', 'Win 1 round', 'Spin Lucky Wheel',
 * and awards instant bonus credits and master chests upon completion.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Target,
  CheckCircle2,
  Gift,
  Sparkles,
  Zap,
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Gamepad2,
  Trophy,
  RotateCcw,
  Coins,
  ChevronRight,
  Flame
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { notificationService } from '../services/notificationService';
import { soundEngine } from '../services/soundEngine';

export interface DailyMission {
  id: string;
  title: string;
  titleBn: string;
  description: string;
  descriptionBn: string;
  icon: 'game' | 'deposit' | 'win' | 'spin' | 'turnover';
  target: number;
  unit: string;
  rewardBdt: number;
  rewardUsd: number;
  completed: boolean;
  claimed: boolean;
}

interface DailyMissionsProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency?: 'BDT' | 'USD';
  onMissionClaimed: () => void;
}

export const DailyMissions: React.FC<DailyMissionsProps> = ({
  currentUser,
  currentWallet,
  currency = 'BDT',
  onMissionClaimed
}) => {
  const [missionClaimState, setMissionClaimState] = useState<Record<string, boolean>>({});
  const [claimedMasterChest, setClaimedMasterChest] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Compute live user stats from transactions for today
  const userTxs = seamlessEngine
    .getTransactions()
    .filter((tx) => tx.user_id === currentUser.id);

  const betsCount = userTxs.filter((tx) => tx.type === 'BET').length;
  const winsCount = userTxs.filter((tx) => (tx.type === 'WIN' || tx.type === 'JACKPOT') && tx.amount > 0).length;
  const totalDeposits = userTxs
    .filter((tx) => tx.type === 'PROMO')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const totalTurnover = userTxs
    .filter((tx) => tx.type === 'BET')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Define the 5 core daily missions
  const missionsConfig: (DailyMission & { current: number })[] = [
    {
      id: 'mission_make_5_bets',
      title: 'Place 5 Bets',
      titleBn: '৫টি বেট প্লেস করুন',
      description: 'Make 5 bets on any slot, crash, or live table game.',
      descriptionBn: 'স্লট, ক্র্যাশ বা লাইভ ক্যাসিনোতে যেকোনো ৫টি বেট সম্পন্ন করুন।',
      icon: 'game',
      target: 5,
      unit: 'Bets',
      current: betsCount,
      rewardBdt: 150,
      rewardUsd: 2.0,
      completed: betsCount >= 5,
      claimed: !!missionClaimState['mission_make_5_bets']
    },
    {
      id: 'mission_deposit_500',
      title: 'Deposit 500 BDT / $10',
      titleBn: '৫০০ টাকা ডিপোজিট করুন',
      description: 'Deposit 500 BDT (or $10 USD) using bKash, Nagad, or Crypto.',
      descriptionBn: 'বিকাশ, নগদ বা ক্রিপ্টোতে ন্যূনতম ৫০০ টাকা ডিপোজিট করুন।',
      icon: 'deposit',
      target: currency === 'BDT' ? 500 : 10,
      unit: currency === 'BDT' ? 'BDT' : 'USD',
      current: currency === 'BDT' ? totalDeposits : totalDeposits / 120,
      rewardBdt: 200,
      rewardUsd: 3.0,
      completed: totalDeposits >= (currency === 'BDT' ? 500 : 10),
      claimed: !!missionClaimState['mission_deposit_500']
    },
    {
      id: 'mission_win_1_round',
      title: 'Win 1 Game Round',
      titleBn: '১টি গেম রাউন্ডে জয়লাভ করুন',
      description: 'Score a winning payout in any crash multiplier or slot spin.',
      descriptionBn: 'স্লট বা ক্র্যাশ গেমে যেকোনো ১টি উইনিং পে-আউট অর্জন করুন।',
      icon: 'win',
      target: 1,
      unit: 'Win',
      current: winsCount,
      rewardBdt: 100,
      rewardUsd: 1.5,
      completed: winsCount >= 1,
      claimed: !!missionClaimState['mission_win_1_round']
    },
    {
      id: 'mission_lucky_wheel_spin',
      title: 'Spin Fortune Wheel',
      titleBn: 'লাকি ফরচুন হুইল স্পিন করুন',
      description: 'Take 1 spin on the Lucky Fortune Wheel today.',
      descriptionBn: 'আজকের অন্তত ১টি লাকি স্পিন সফলভাবে সম্পন্ন করুন।',
      icon: 'spin',
      target: 1,
      unit: 'Spin',
      current: 0,
      rewardBdt: 50,
      rewardUsd: 0.8,
      completed: false,
      claimed: !!missionClaimState['mission_lucky_wheel_spin']
    },
    {
      id: 'mission_reach_turnover',
      title: 'Generate 2,000 BDT Turnover',
      titleBn: '২,০০০ টাকা বেটিং টার্নওভার করুন',
      description: 'Accumulate 2,000 BDT worth of total gameplay volume.',
      descriptionBn: 'গেমে মোট ২,০০০ টাকা সমমূল্যের টার্নওভার সম্পন্ন করুন।',
      icon: 'turnover',
      target: currency === 'BDT' ? 2000 : 25,
      unit: currency === 'BDT' ? 'BDT' : 'USD',
      current: currency === 'BDT' ? totalTurnover : totalTurnover / 120,
      rewardBdt: 500,
      rewardUsd: 8.0,
      completed: totalTurnover >= (currency === 'BDT' ? 2000 : 25),
      claimed: !!missionClaimState['mission_reach_turnover']
    }
  ];

  const completedCount = missionsConfig.filter((m) => m.completed).length;
  const claimedCount = missionsConfig.filter((m) => m.claimed).length;
  const masterChestReward = currency === 'BDT' ? 1000 : 15;

  // Claim Mission Reward
  const handleClaimMission = (mission: (typeof missionsConfig)[0]) => {
    if (!mission.completed || mission.claimed) return;

    const rewardAmount = currency === 'BDT' ? mission.rewardBdt : mission.rewardUsd;
    const effectiveCurrency = currentUser.currency || currency;

    soundEngine.playClick(900);
    seamlessEngine.topUpWallet(currentUser.id, effectiveCurrency, rewardAmount);

    setMissionClaimState((prev) => ({ ...prev, [mission.id]: true }));

    notificationService.pushNotification(currentUser.id, {
      userId: currentUser.id,
      title: `🎁 ডেইলি মিশন বোনাস আনলক: ${mission.titleBn}`,
      message: `অভিনন্দন! "${mission.titleBn}" সম্পন্ন করায় ${currency === 'BDT' ? '৳' : '$'}${rewardAmount} বোনাস ক্রেডিট যোগ হয়েছে।`,
      type: 'BONUS_UNLOCKED',
      amount: rewardAmount,
      currency: effectiveCurrency as 'BDT' | 'USD',
      isRead: false,
      actionTab: 'promo'
    });

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#10b981', '#06b6d4', '#ec4899']
    });

    soundEngine.playWinChime();
    const symbol = currency === 'BDT' ? '৳' : '$';
    setToast(`🎉 মিশন রিওয়ার্ড ক্লেইম সফল! ${symbol}${rewardAmount} আপনার বোনাস ওয়ালেটে যোগ হয়েছে!`);
    onMissionClaimed();
    setTimeout(() => setToast(null), 4000);
  };

  // Claim Master Chest
  const handleClaimMasterChest = () => {
    if (completedCount < 5 || claimedMasterChest) return;

    const effectiveCurrency = currentUser.currency || currency;
    soundEngine.playClick(1000);
    seamlessEngine.topUpWallet(currentUser.id, effectiveCurrency, masterChestReward);

    setClaimedMasterChest(true);

    notificationService.pushNotification(currentUser.id, {
      userId: currentUser.id,
      title: '🏆 মেগা মিশন মাস্টার চেস্ট আনলক!',
      message: `অভিনন্দন! আজকের সব মিশন শেষ করায় গ্র্যান্ড বোনাস ${currency === 'BDT' ? '৳' : '$'}${masterChestReward} আনলক হয়েছে।`,
      type: 'BONUS_UNLOCKED',
      amount: masterChestReward,
      currency: effectiveCurrency as 'BDT' | 'USD',
      isRead: false,
      actionTab: 'promo'
    });

    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#f59e0b', '#ffd700', '#10b981', '#8b5cf6']
    });

    soundEngine.playWinChime();
    setToast(`🏆 মেগা চেস্ট গ্র্যান্ড বোনাস আনলক হয়েছে (+৳${masterChestReward})!`);
    onMissionClaimed();
    setTimeout(() => setToast(null), 4000);
  };

  const handleSimulateBet = async () => {
    try {
      soundEngine.playClick(750);
      await seamlessEngine.executeRequest(
        'bet',
        {
          provider_id: 'pgsoft',
          user_id: currentUser.id,
          game_id: 'PG_MAHJONG_WAYS',
          round_id: `rnd_${Date.now()}`,
          transaction_id: `SIM_BET_${Date.now()}`,
          amount: currency === 'BDT' ? 500 : 5,
          currency: currentUser.currency || currency
        },
        { bypassHmac: true }
      );
      onMissionClaimed();
      setToast('✅ সিমুলেটেড বেট সফল (+১ বেট)');
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      setToast(err.message || 'বেট ব্যর্থ হয়েছে');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleSimulateDeposit = () => {
    try {
      soundEngine.playClick(750);
      seamlessEngine.topUpWallet(currentUser.id, currentUser.currency || currency, currency === 'BDT' ? 500 : 10);
      onMissionClaimed();
      setToast('✅ সিমুলেটেড ডিপোজিট সফল (+৳৫০০)');
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      setToast(err.message || 'ডিপোজিট ব্যর্থ হয়েছে');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleSimulateWin = async () => {
    try {
      soundEngine.playClick(750);
      await seamlessEngine.executeRequest(
        'win',
        {
          provider_id: 'spribe',
          user_id: currentUser.id,
          game_id: 'SPRIBE_AVIATOR',
          round_id: `rnd_${Date.now()}`,
          transaction_id: `SIM_WIN_${Date.now()}`,
          amount: currency === 'BDT' ? 1200 : 12,
          currency: currentUser.currency || currency
        },
        { bypassHmac: true }
      );
      onMissionClaimed();
      setToast('✅ সিমুলেটেড উইন ক্রেডিট করা হয়েছে (+১ উইন)');
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      setToast(err.message || 'উইন ক্রেডিট ব্যর্থ হয়েছে');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const currencySymbol = currency === 'BDT' ? '৳' : '$';

  return (
    <div className="golden-ratio-card rounded-3xl p-5 sm:p-7 space-y-6 font-sans text-slate-100">
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 bg-slate-900 border border-amber-500/60 text-amber-300 px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 text-xs font-mono"
          >
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily Missions Header & Reset Timer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-[1.5px] shadow-lg shadow-amber-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-400">
              <Target className="w-6 h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-black text-white uppercase">
                ডেইলি মিশন ও টাস্ক সেন্টার
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/40">
                {completedCount}/5 Complete
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              প্রতিদিনের সহজ টাস্ক পূরণ করে ফ্রি বোনাস ক্রেডিট এবং মেগা চেস্ট আনলক করুন।
            </p>
          </div>
        </div>

        {/* 24-Hour Reset Countdown Badge */}
        <div className="flex items-center space-x-2 bg-slate-950/80 px-3.5 py-2 rounded-2xl border border-slate-800 text-xs font-mono text-slate-400 shrink-0">
          <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>রিসেট সময়: <strong className="text-white">আজ রাত 00:00 UTC</strong></span>
        </div>
      </div>

      {/* Master Completion Progress Bar & Mystery Chest Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-950 to-amber-950/40 border border-purple-500/30 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-purple-300 font-bold flex items-center gap-1.5 font-sans">
              <Trophy className="w-4 h-4 text-yellow-400" />
              মেগা অল-মিশন কমপ্লিশন চেস্ট (All 5 Missions Bonus)
            </span>
            <span className="text-amber-400 font-black">
              {completedCount}/5 সম্পন্ন ({Math.round((completedCount / 5) * 100)}%)
            </span>
          </div>

          <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400"
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / 5) * 100}%` }}
              transition={{ type: 'spring', damping: 20, stiffness: 90 }}
            />
          </div>

          <div className="text-[11px] text-slate-400 font-sans">
            {completedCount >= 5
              ? '🎉 সকল ৫টি মিশন সম্পন্ন হয়েছে! মেগা চেস্ট থেকে গ্র্যান্ড বোনাস ক্লেইম করুন।'
              : `আর মাত্র ${5 - completedCount}টি মিশন সম্পন্ন করলে ${currencySymbol}${masterChestReward} মেগা বোনাস আনলক হবে!`}
          </div>
        </div>

        {/* Master Chest Claim Button */}
        <button
          onClick={handleClaimMasterChest}
          disabled={completedCount < 5 || claimedMasterChest}
          className={`min-h-[44px] py-2.5 px-5 rounded-2xl font-black text-xs font-mono uppercase tracking-wider flex items-center justify-center space-x-2 shrink-0 transition-all cursor-pointer ${
            completedCount >= 5 && !claimedMasterChest
              ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 hover:scale-105 shadow-xl shadow-amber-500/30 animate-bounce'
              : claimedMasterChest
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
              : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>
            {claimedMasterChest
              ? '✓ মেগা চেস্ট ক্লেইমড'
              : completedCount >= 5
              ? `ক্লেইম মেগা চেস্ট (${currencySymbol}${masterChestReward})`
              : `লকড (${currencySymbol}${masterChestReward})`}
          </span>
        </button>
      </div>

      {/* 5 Missions Task Cards Grid */}
      <div className="space-y-3">
        {missionsConfig.map((mission, index) => {
          const progressPercent = Math.min(100, Math.round((mission.current / mission.target) * 100));
          const isDone = mission.completed;
          const isClaimed = mission.claimed;
          const rewardValue = currency === 'BDT' ? mission.rewardBdt : mission.rewardUsd;

          return (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isClaimed
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-300'
                  : isDone
                  ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-lg shadow-amber-500/10'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              {/* Left Details */}
              <div className="flex items-start space-x-3.5 flex-1">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                    isClaimed
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : isDone
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  {mission.icon === 'game' && <Gamepad2 className="w-5 h-5" />}
                  {mission.icon === 'deposit' && <CreditCard className="w-5 h-5" />}
                  {mission.icon === 'win' && <Trophy className="w-5 h-5" />}
                  {mission.icon === 'spin' && <RotateCcw className="w-5 h-5" />}
                  {mission.icon === 'turnover' && <Flame className="w-5 h-5" />}
                </div>

                <div className="space-y-1 flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-xs sm:text-sm text-white">{mission.titleBn}</h3>
                    <span className="text-[10px] text-slate-500 font-mono">({mission.title})</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">{mission.descriptionBn}</p>

                  {/* Progress Meter */}
                  <div className="pt-2 space-y-1 font-mono">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        অগ্রগতি:{' '}
                        <strong className="text-white">
                          {mission.current.toLocaleString()} / {mission.target.toLocaleString()} {mission.unit}
                        </strong>
                      </span>
                      <span className={isDone ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                        {progressPercent}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                      <motion.div
                        className={`h-full rounded-full ${
                          isClaimed
                            ? 'bg-emerald-400'
                            : isDone
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ type: 'spring', damping: 20, stiffness: 80 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Reward & Claim Button */}
              <div className="flex items-center justify-between md:justify-end space-x-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80 font-mono">
                <div className="text-left md:text-right">
                  <div className="text-[10px] text-slate-400 uppercase">মিশন রিওয়ার্ড</div>
                  <div className="text-sm sm:text-base font-black text-amber-400 flex items-center space-x-1">
                    <Coins className="w-4 h-4" />
                    <span>+{currencySymbol}{rewardValue.toLocaleString()} বোনাস</span>
                  </div>
                </div>

                <button
                  onClick={() => handleClaimMission(mission)}
                  disabled={!isDone || isClaimed}
                  className={`min-h-[38px] py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md cursor-pointer ${
                    isClaimed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : isDone
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 hover:scale-105 shadow-amber-500/25'
                      : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                  }`}
                >
                  {isClaimed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>ক্লেইমড</span>
                    </>
                  ) : isDone ? (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>ক্লেইম করুন</span>
                    </>
                  ) : (
                    <>
                      <span>{progressPercent}% পূরণ</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Fast Tester Simulation Toolbar */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2.5 font-mono">
        <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>মিশন প্রগ্রেস টেস্ট সিমুলেটর (Task Simulator Controls):</span>
          </div>
          <span className="text-[10px] text-slate-500">Live Mission Progress</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={handleSimulateBet}
            className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold active:scale-95 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>+১টি বেট প্লেস করুন ({currencySymbol}500)</span>
          </button>

          <button
            onClick={handleSimulateDeposit}
            className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 text-xs font-bold active:scale-95 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ডিপোজিট করুন ({currencySymbol}500)</span>
          </button>

          <button
            onClick={handleSimulateWin}
            className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-bold active:scale-95 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>+১টি রাউন্ড উইন করুন ({currencySymbol}1,200)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
