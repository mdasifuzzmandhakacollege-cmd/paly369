/**
 * @file VipProgressionView.tsx
 * @description Master VIP Club, Tier Progression & Exclusive High-Roller Offers for Playall 365.
 * Structured with harmonious visual proportion, balanced hierarchy, responsive mobile layout,
 * V1 to V10 Tier Ladder, Level-up Instant Cash Claims, Dual Threshold Trackers,
 * and VIP Privileges.
 */

import React, { useState } from 'react';
import {
  Crown,
  Sparkles,
  Shield,
  Award,
  Zap,
  CheckCircle2,
  Lock,
  Gift,
  ArrowRight,
  TrendingUp,
  Percent,
  Clock,
  Headphones,
  Coins,
  ShieldCheck,
  Check,
  Star,
  ChevronRight,
  Flame,
  UserCheck,
  Sparkle
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { VIP_TIER_CONFIG } from '../shared/gameplayConfig';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { notificationService } from '../services/notificationService';
import { soundEngine } from '../services/soundEngine';
import { useWalletGame } from '../contexts/WalletGameContext';
import { motion, AnimatePresence } from 'framer-motion';

interface VipProgressionViewProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onBonusClaimed: () => void;
}

interface VipSpecialOffer {
  id: string;
  title: string;
  subtitle: string;
  rewardValue: string;
  badge: string;
  badgeColor: string;
  requiredTier: string;
  description: string;
  code: string;
}

const VIP_SPECIAL_OFFERS: VipSpecialOffer[] = [
  {
    id: 'vip-weekend-reload',
    title: '৫০% উইকেন্ড ভিআইপি রিলোড বুস্টার',
    subtitle: 'প্রতি শুক্র ও শনিবার সর্বোচ্চ ক্যাশ ডিপোজিট বোনাস',
    rewardValue: '৳ ৫০,০০০ পর্যন্ত',
    badge: 'WEEKEND SPECIAL',
    badgeColor: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950',
    requiredTier: 'V3+',
    description: 'উইকেন্ডে যেকোনো ডিপোজিটে পান তাৎক্ষণিক ৫০% অতিরিক্ত ক্যাশ ব্যালেন্স মাত্র ৮x টার্নওভারে।',
    code: 'VIPWEEKEND50'
  },
  {
    id: 'vip-weekly-lossback',
    title: '২০% সাপ্তাহিক নো-ওয়েজারিং লস-ব্যাক',
    subtitle: 'সরাসরি রিয়াল উইথড্রয়েবল ক্যাশে রিফান্ড',
    rewardValue: '৳ ১,৫০,০০০ সর্বোচ্চ',
    badge: 'ZERO WAGER',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    requiredTier: 'V4+',
    description: 'সপ্তাহের মোট নেট লসের ওপর ২০% সরাসরি রিয়াল ব্যালেন্সে ফেরত প্রদান করা হয় প্রতি সোমবার।',
    code: 'VIPCASH20'
  },
  {
    id: 'vip-birthday-luxury',
    title: 'বার্থডে লাক্সারি গোল্ড ক্যাশ বক্স',
    subtitle: 'জন্মদিনের এক্সক্লুসিভ গিফট সরাসরি অ্যাকাউন্টে',
    rewardValue: '৳ ১০,০০০ ক্যাশ',
    badge: 'BIRTHDAY GIFT',
    badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
    requiredTier: 'V2+',
    description: 'আপনার জন্মদিন উপলক্ষে ভিআইপি ম্যানেজমেন্ট থেকে সরাসরি উপহার ক্যাশ ও ফ্রি স্পিন গিফট।',
    code: 'VIPBDAY'
  },
  {
    id: 'vip-personal-concierge',
    title: '২৪/৭ পার্সোনাল হোয়াটসঅ্যাপ ভিআইপি ম্যানেজার',
    subtitle: 'ইনস্ট্যান্ট ডিপোজিট, ক্যাশ-আউট ও কাস্টম অডস সেবা',
    rewardValue: 'ডেডিকেটেড লাইন',
    badge: 'VIP CONCIERGE',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
    requiredTier: 'V5+',
    description: 'আপনার জন্য নির্দিষ্ট ভিআইপি অ্যাকাউন্ট ম্যানেজার যিনি সার্বক্ষণিক অগ্রাধিকারমূলক সাপোর্ট দেবেন।',
    code: 'VIPCARE'
  }
];

export const VipProgressionView: React.FC<VipProgressionViewProps> = ({
  currentUser,
  currentWallet,
  currency,
  onBonusClaimed
}) => {
  const { showToast, refreshState } = useWalletGame();

  const [claimedLevels, setClaimedLevels] = useState<number[]>([]);
  const [claimingLevel, setClaimingLevel] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'TIERS' | 'OFFERS' | 'PRIVILEGES'>('TIERS');

  // Real user transaction metrics
  const userTxs = seamlessEngine.getTransactions().filter((tx) => tx.user_id === currentUser.id);
  const cumulativeDeposit = userTxs
    .filter((tx) => tx.type === 'DEPOSIT' && tx.status === 'COMPLETED')
    .reduce((s, tx) => s + tx.amount, 0);
  const cumulativeBet = userTxs
    .filter((tx) => tx.type === 'BET' && tx.status === 'COMPLETED')
    .reduce((s, tx) => s + tx.amount, 0);

  // Compute tier strictly from real activity
  const matchedTiers = VIP_TIER_CONFIG.filter(
    (t) => cumulativeDeposit >= t.minDeposit && cumulativeBet >= t.minBet
  );
  const currentTier = matchedTiers.length > 0 ? matchedTiers[matchedTiers.length - 1] : VIP_TIER_CONFIG[0];
  const currentLevel = currentTier.level;
  const nextTier = VIP_TIER_CONFIG.find((t) => t.level === currentLevel + 1) || currentTier;
  const symbol = currency === 'BDT' ? '৳' : '$';

  const depositProgress = nextTier.minDeposit > 0 ? Math.min(100, Math.round((cumulativeDeposit / nextTier.minDeposit) * 100)) : 100;
  const betProgress = nextTier.minBet > 0 ? Math.min(100, Math.round((cumulativeBet / nextTier.minBet) * 100)) : 100;

  const handleClaimBonus = (tier: typeof VIP_TIER_CONFIG[0]) => {
    if (claimedLevels.includes(tier.level)) return;
    setClaimingLevel(tier.level);
    soundEngine.playClick(900);

    setTimeout(() => {
      seamlessEngine.topUpWallet(currentUser.id, currentUser.currency, tier.bonus);
      setClaimedLevels((prev) => [...prev, tier.level]);
      setClaimingLevel(null);

      notificationService.pushNotification(currentUser.id, {
        userId: currentUser.id,
        title: `👑 ${tier.name} বোনাস ক্লেইম সফল!`,
        message: `৳${tier.bonus.toLocaleString()} ইনস্ট্যান্ট ভিআইপি লেভেল বোনাস ওয়ালেটে যোগ হয়েছে।`,
        type: 'VIP_UPGRADE',
        amount: tier.bonus,
        currency: (currentUser.currency || 'BDT') as 'BDT' | 'USD',
        isRead: false
      });

      soundEngine.playWinChime();
      showToast(`${tier.name} বোনাস ক্লেইম সফল! ৳${tier.bonus.toLocaleString()} ওয়ালেটে যুক্ত হয়েছে`);
      if (onBonusClaimed) onBonusClaimed();
    }, 600);
  };

  const handleClaimOffer = (offer: VipSpecialOffer) => {
    soundEngine.playWinChime();
    showToast(`অভিনন্দন! '${offer.title}' অফার সফলভাবে সক্রিয় করা হয়েছে। কোড: ${offer.code}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-28 font-sans text-slate-100 selection:bg-amber-400 selection:text-slate-950"
    >
      {/* 1. MASTER VIP BANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left Column: Current Tier, Avatar & Dual Threshold Bars */}
        <div className="lg:col-span-7 rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-950 to-emerald-900 border-2 border-amber-400/50 p-5 sm:p-7 relative overflow-hidden flex flex-col justify-between shadow-xl">
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-amber-400/20 to-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-4 relative z-10">
            {/* Top Row: Tier Crown & Status */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3.5">
                <div className="relative">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 p-[2px] shadow-lg shadow-emerald-950/60">
                    <div className="w-full h-full bg-emerald-950 rounded-[14px] flex items-center justify-center border border-amber-400/40">
                      <Crown className="w-7 h-7 text-amber-400 animate-pulse" />
                    </div>
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-emerald-950 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  </span>
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono font-bold tracking-widest text-amber-400 uppercase">
                      GAMEPLAY365 VIP CLUB
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold">
                      ACTIVE TIER
                    </span>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                    {currentTier.name} (লেভেল {currentLevel})
                  </h1>

                  <div className="text-xs text-emerald-200/90 font-mono mt-0.5">
                    দৈনিক ক্যাশব্যাক: <strong className="text-amber-400">{(currentTier.cashback * 100).toFixed(1)}%</strong> • দৈনিক পে-আউট: <strong className="text-white">৳{currentTier.payoutLimit.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Next Milestone Card */}
              <div className="bg-emerald-950/90 p-3 rounded-2xl border border-amber-400/40 text-right font-mono text-xs hidden sm:block">
                <div className="text-[10px] text-emerald-300">পরবর্তী স্তর: <strong className="text-white">{nextTier.name}</strong></div>
                <div className="text-sm font-black text-amber-300 mt-0.5">
                  +{symbol}{nextTier.bonus.toLocaleString()} ক্যাশ বোনাস
                </div>
                <div className="text-[10px] text-emerald-300 mt-0.5">{(nextTier.cashback * 100).toFixed(1)}% লাইফটাইম রিবেট</div>
              </div>
            </div>

            {/* Dual Progression Meters (Deposit Threshold & Bet Turnover) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono text-xs">
              {/* Meter 1: Deposit */}
              <div className="bg-emerald-950/80 p-3.5 rounded-2xl border border-emerald-700/60 space-y-2">
                <div className="flex justify-between text-[11px] text-emerald-200">
                  <span className="flex items-center space-x-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>ডিপোজিট থ্রেশহোল্ড</span>
                  </span>
                  <span className="text-amber-300 font-bold">{depositProgress}%</span>
                </div>
                <div className="w-full bg-emerald-900/60 h-2 rounded-full overflow-hidden border border-emerald-800">
                  <div
                    className="bg-gradient-to-r from-amber-400 to-yellow-400 h-full rounded-full transition-all duration-500 shadow-md shadow-amber-500/30"
                    style={{ width: `${depositProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-emerald-300/80">
                  <span>৳{cumulativeDeposit.toLocaleString()}</span>
                  <span>লক্ষ্য: ৳{nextTier.minDeposit.toLocaleString()}</span>
                </div>
              </div>

              {/* Meter 2: Turnover */}
              <div className="bg-emerald-950/80 p-3.5 rounded-2xl border border-emerald-700/60 space-y-2">
                <div className="flex justify-between text-[11px] text-emerald-200">
                  <span className="flex items-center space-x-1">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    <span>বেটিং টার্নওভার</span>
                  </span>
                  <span className="text-amber-300 font-bold">{betProgress}%</span>
                </div>
                <div className="w-full bg-emerald-900/60 h-2 rounded-full overflow-hidden border border-emerald-800">
                  <div
                    className="bg-gradient-to-r from-yellow-300 to-amber-400 h-full rounded-full transition-all duration-500 shadow-md"
                    style={{ width: `${betProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-emerald-300/80">
                  <span>৳{cumulativeBet.toLocaleString()}</span>
                  <span>লক্ষ্য: ৳{nextTier.minBet.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick VIP Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-3 border-t border-emerald-800/80 font-mono text-xs relative z-10">
            <span className="text-emerald-300 text-xs flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>ভিআইপি লেভেল আজীবন সক্রিয় ও স্থায়ী</span>
            </span>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  soundEngine.playClick(850);
                  setActiveTab('OFFERS');
                }}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-md"
              >
                <span>বিশেষ অফার দেখুন</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: 4-Card VIP Privileges */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3 sm:gap-4">
          
          {/* Privilege 1: Daily Cashback */}
          <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-4 flex flex-col justify-between font-mono shadow-md">
            <div className="text-[11px] text-emerald-300 uppercase flex items-center justify-between font-bold">
              <span>দৈনিক ক্যাশব্যাক</span>
              <Percent className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-300 mt-2 truncate">
              {(currentTier.cashback * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-emerald-300 mt-1 font-semibold">প্রতিদিন স্বয়ংক্রিয় ক্রেডিট</div>
          </div>

          {/* Privilege 2: Fast Withdrawals */}
          <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-4 flex flex-col justify-between font-mono shadow-md">
            <div className="text-[11px] text-emerald-300 uppercase flex items-center justify-between font-bold">
              <span>প্রায়োরিটি স্পিড</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-2">০ - ৪ সেকেন্ড</div>
            <div className="text-[10px] text-emerald-300 mt-1">ফাস্ট-লেন ভিআইপি পে-আউট</div>
          </div>

          {/* Privilege 3: Daily Limit */}
          <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-4 flex flex-col justify-between font-mono shadow-md">
            <div className="text-[11px] text-emerald-300 uppercase flex items-center justify-between font-bold">
              <span>দৈনিক লিমিট</span>
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-base sm:text-xl font-black text-amber-300 mt-2 truncate">
              ৳ {currentTier.payoutLimit.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-300 mt-1">আনলিমিটেড ট্রান্সফার</div>
          </div>

          {/* Privilege 4: Account Manager */}
          <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-4 flex flex-col justify-between font-mono shadow-md">
            <div className="text-[11px] text-emerald-300 uppercase flex items-center justify-between font-bold">
              <span>ভিআইপি ম্যানেজার</span>
              <Headphones className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-200 mt-2">২৪/৭ সরাসরি লাইন</div>
            <div className="text-[10px] text-emerald-300 mt-1">ডেডিকেটেড হোয়াটসঅ্যাপ</div>
          </div>

        </div>

      </div>

      {/* 2. NAVIGATION TABS */}
      <div className="flex items-center space-x-2 bg-emerald-950/80 p-1.5 rounded-2xl border border-emerald-700/60 font-mono text-xs overflow-x-auto scrollbar-none">
        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('TIERS');
          }}
          className={`flex-1 min-h-[42px] px-4 py-2 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'TIERS'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md'
              : 'text-emerald-200 hover:text-white'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>V1 হতে V10 ভিআইপি লেডার ও ক্যাশ রিওয়ার্ডস</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('OFFERS');
          }}
          className={`flex-1 min-h-[42px] px-4 py-2 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'OFFERS'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md'
              : 'text-emerald-200 hover:text-white'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>এক্সক্লুসিভ ভিআইপি অফার্স ও বোনাসেস ({VIP_SPECIAL_OFFERS.length})</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('PRIVILEGES');
          }}
          className={`min-h-[42px] px-5 py-2 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'PRIVILEGES'
              ? 'bg-amber-400 text-slate-950 font-black shadow-md'
              : 'text-emerald-200 hover:text-white'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>সুবিধা ও শর্তাবলী তুলনা</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. TIER LADDER VIEW (V1 TO V10 GRID) */}
      {/* ========================================================================= */}
      {activeTab === 'TIERS' && (
        <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-7 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center space-x-2 font-sans">
                <Award className="w-5 h-5 text-amber-400" />
                <span>ভিআইপি লেডার ও তাৎক্ষণিক ক্যাশ বোনাস</span>
              </h2>
              <p className="text-xs text-emerald-200 font-mono mt-0.5">
                প্রতিটি লেভেল আপগ্রেডে নিশ্চিত ক্যাশ বোনাস এবং আজীবন ক্যাশব্যাক সুবিধা।
              </p>
            </div>
            <div className="text-xs font-mono text-amber-300 font-bold bg-emerald-950 px-3 py-1.5 rounded-xl border border-amber-400/40 shrink-0">
              বর্তমান আনলক লেভেল: V{currentLevel}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 font-mono text-xs">
            {VIP_TIER_CONFIG.map((tier) => {
              const isCurrent = tier.level === currentLevel;
              const isUnlocked = tier.level <= currentLevel;
              const isClaimed = claimedLevels.includes(tier.level);

              return (
                <div
                  key={tier.level}
                  className={`p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between space-y-3 ${
                    isCurrent
                      ? 'bg-gradient-to-b from-emerald-900/80 via-emerald-950 to-emerald-900 border-amber-400 shadow-xl shadow-emerald-950 scale-[1.02]'
                      : isUnlocked
                      ? 'bg-emerald-950/80 border-emerald-700 hover:border-amber-400/60'
                      : 'bg-emerald-950/40 border-emerald-900/60 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white text-sm">{tier.name}</span>
                      {isUnlocked ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Lock className="w-4 h-4 text-emerald-700" />
                      )}
                    </div>
                    <div className="text-[11px] text-amber-300 font-bold">
                      লেভেল বোনাস: +৳{tier.bonus.toLocaleString()}
                    </div>
                  </div>

                  <div className="space-y-1 text-[10px] text-emerald-300 border-t border-emerald-800/80 pt-2 font-mono">
                    <div className="flex justify-between">
                      <span>ডিপোজিট:</span>
                      <span className="text-white font-semibold">৳{tier.minDeposit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>টার্নওভার:</span>
                      <span className="text-white font-semibold">৳{tier.minBet.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-amber-300 font-bold">
                      <span>ক্যাশব্যাক:</span>
                      <span>{(tier.cashback * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  {isUnlocked ? (
                    isClaimed ? (
                      <button
                        disabled
                        className="w-full min-h-[34px] py-1.5 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-bold cursor-not-allowed flex items-center justify-center space-x-1"
                      >
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>ক্লেইমড (Claimed)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleClaimBonus(tier)}
                        disabled={claimingLevel === tier.level}
                        className="w-full min-h-[34px] py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 text-[10px] font-black shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{claimingLevel === tier.level ? 'ক্লেইম হচ্ছে...' : 'বোনাস ক্লেইম করুন'}</span>
                      </button>
                    )
                  ) : (
                    <div className="w-full min-h-[34px] py-1.5 rounded-xl bg-emerald-950 border border-emerald-900 text-emerald-600 text-[10px] font-bold text-center flex items-center justify-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>লকড (Locked)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. EXCLUSIVE VIP OFFERS GRID */}
      {/* ========================================================================= */}
      {activeTab === 'OFFERS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {VIP_SPECIAL_OFFERS.map((offer) => (
            <div
              key={offer.id}
              className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:border-amber-400 hover:shadow-xl hover:shadow-emerald-950 group shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${offer.badgeColor}`}>
                    {offer.badge}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded-lg border border-emerald-700">
                    যোগ্যতা: <strong className="text-amber-300">{offer.requiredTier}</strong>
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors leading-snug">
                    {offer.title}
                  </h3>
                  <p className="text-xs text-emerald-200/90 font-sans mt-1 leading-relaxed">
                    {offer.subtitle}
                  </p>
                </div>

                <div className="p-3 bg-emerald-950/90 rounded-xl border border-emerald-700/80 font-mono flex items-center justify-between">
                  <span className="text-emerald-300 text-xs">অফার রিওয়ার্ড:</span>
                  <span className="text-sm font-black text-transparent bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400 bg-clip-text">
                    {offer.rewardValue}
                  </span>
                </div>

                <p className="text-xs text-emerald-200 font-sans leading-relaxed">
                  {offer.description}
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-emerald-800/80 font-mono text-xs flex items-center justify-between">
                <span className="text-emerald-400 text-[10px]">কোড: {offer.code}</span>
                <button
                  onClick={() => handleClaimOffer(offer)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black shadow-md active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>অফার সক্রিয় করুন</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PRIVILEGES COMPARISON TABLE */}
      {/* ========================================================================= */}
      {activeTab === 'PRIVILEGES' && (
        <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-7 space-y-4 shadow-xl">
          <div className="border-b border-emerald-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center space-x-2 font-sans">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>ভিআইপি টায়ার সুবিধা ও লিমিট তুলনা তালিকা</span>
            </h2>
            <p className="text-xs text-emerald-300 font-mono mt-0.5">
              সকল স্তরের প্রয়োজনীয় ডিপোজিট, টার্নওভার, ক্যাশব্যাক ও দৈনিক পে-আউট লিমিট।
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-emerald-950 text-emerald-300 uppercase text-[10px]">
                <tr>
                  <th className="p-3">লেভেল ও টায়ার</th>
                  <th className="p-3">ন্যূনতম ডিপোজিট</th>
                  <th className="p-3">টার্নওভার লক্ষ্য</th>
                  <th className="p-3">লেভেল বোনাস</th>
                  <th className="p-3">দৈনিক ক্যাশব্যাক</th>
                  <th className="p-3">দৈনিক পে-আউট লিমিট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-800/80">
                {VIP_TIER_CONFIG.map((t) => (
                  <tr
                    key={t.level}
                    className={`hover:bg-emerald-900/40 transition-colors ${
                      t.level === currentLevel ? 'bg-amber-500/15 font-bold text-amber-300' : 'text-emerald-200'
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-950 border border-emerald-700 flex items-center justify-center font-bold text-amber-400 text-[10px]">
                          V{t.level}
                        </span>
                        <span className="font-bold text-white">{t.name}</span>
                        {t.level === currentLevel && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">৳{t.minDeposit.toLocaleString()}</td>
                    <td className="p-3">৳{t.minBet.toLocaleString()}</td>
                    <td className="p-3 font-bold text-amber-300">+৳{t.bonus.toLocaleString()}</td>
                    <td className="p-3 text-emerald-300 font-bold">{(t.cashback * 100).toFixed(1)}%</td>
                    <td className="p-3 text-white">৳{t.payoutLimit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </motion.div>
  );
};
