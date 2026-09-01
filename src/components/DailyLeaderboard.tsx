/**
 * @file DailyLeaderboard.tsx
 * @description Real-Time Daily Leaderboard for Playall 365 Game Lobby.
 * Displays the Top 10 players based on turnover volume with real-time 'Rising Star'
 * dynamic position shifts, glowing aura animations using Framer Motion, and prize pools.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Crown,
  Flame,
  Sparkles,
  TrendingUp,
  Award,
  Star,
  Zap,
  Clock,
  Coins,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
  Gift,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';

export interface LeaderboardPlayer {
  id: string;
  rank: number;
  prevRank: number;
  username: string;
  displayName: string;
  avatar: string;
  country: string;
  flag: string;
  vipTier: 'DIAMOND' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE';
  turnover: number;
  winAmount: number;
  favoriteGame: string;
  prizeReward: string;
  isRisingStar?: boolean;
  risingDelta?: number;
  recentBetTime?: string;
}

const INITIAL_PLAYERS: LeaderboardPlayer[] = [
  {
    id: 'user_lb_01',
    rank: 1,
    prevRank: 1,
    username: 'sakib_cricket_99',
    displayName: 'Sakib আল হাসান (VIP)',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    country: 'Bangladesh',
    flag: '🇧🇩',
    vipTier: 'DIAMOND',
    turnover: 1850400,
    winAmount: 342500,
    favoriteGame: 'Aviator Turbo Crash',
    prizeReward: '৳ 50,000 + 500 VIP Points',
    isRisingStar: false
  },
  {
    id: 'user_lb_02',
    rank: 2,
    prevRank: 2,
    username: 'tamim_highroller',
    displayName: 'Tamim ইকবাল',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
    country: 'Bangladesh',
    flag: '🇧🇩',
    vipTier: 'DIAMOND',
    turnover: 1420900,
    winAmount: 215000,
    favoriteGame: 'Sweet Bonanza 1000',
    prizeReward: '৳ 30,000 + 300 VIP Points',
    isRisingStar: false
  },
  {
    id: 'user_lb_03',
    rank: 3,
    prevRank: 4,
    username: 'rakib_dhaka_boss',
    displayName: 'Rakib Boss',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    country: 'Bangladesh',
    flag: '🇧🇩',
    vipTier: 'PLATINUM',
    turnover: 980500,
    winAmount: 184000,
    favoriteGame: 'Gates of Olympus 1000',
    prizeReward: '৳ 20,000 + 200 VIP Points',
    isRisingStar: true,
    risingDelta: 1
  },
  {
    id: 'user_lb_04',
    rank: 4,
    prevRank: 3,
    username: 'farhan_ctg_king',
    displayName: 'Farhan চট্টগ্রাম',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    country: 'Bangladesh',
    flag: '🇧🇩',
    vipTier: 'PLATINUM',
    turnover: 865200,
    winAmount: 112000,
    favoriteGame: 'Lightning Roulette Live',
    prizeReward: '৳ 12,000 + 100 VIP Points',
    isRisingStar: false
  },
  {
    id: 'user_lb_05',
    rank: 5,
    prevRank: 6,
    username: 'dubai_prince_khalid',
    displayName: 'Khalid Al-Maktoum',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80',
    country: 'UAE',
    flag: '🇦🇪',
    vipTier: 'GOLD',
    turnover: 694000,
    winAmount: 98500,
    favoriteGame: 'Crazy Time Live',
    prizeReward: '৳ 8,000 + 50 VIP Points',
    isRisingStar: true,
    risingDelta: 1
  },
  {
    id: 'user_lb_06',
    rank: 6,
    prevRank: 5,
    username: 'anika_sylhet_queen',
    displayName: 'Anika Queen',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    country: 'Bangladesh',
    flag: '🇧🇩',
    vipTier: 'GOLD',
    turnover: 532000,
    winAmount: 64200,
    favoriteGame: 'Aviator Turbo Crash',
    prizeReward: '৳ 5,000 + 50 VIP Points',
    isRisingStar: false
  },
  {
    id: 'user_lb_07',
    rank: 7,
    prevRank: 8,
    username: 'london_royals_alex',
    displayName: 'Alex Smith',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    country: 'UK',
    flag: '🇬🇧',
    vipTier: 'SILVER',
    turnover: 418000,
    winAmount: 51200,
    favoriteGame: 'Mega Moolah Jackpot',
    prizeReward: '৳ 3,000 + 30 VIP Points',
    isRisingStar: true,
    risingDelta: 1
  },
  {
    id: 'user_lb_08',
    rank: 8,
    prevRank: 7,
    username: 'shanto_rajshahi_tiger',
    displayName: 'Shanto Tiger',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80',
    country: 'Bangladesh',
    flag: '🇧🇩',
    vipTier: 'SILVER',
    turnover: 345000,
    winAmount: 39800,
    favoriteGame: 'Blackjack Classic VIP',
    prizeReward: '৳ 2,000 + 20 VIP Points',
    isRisingStar: false
  },
  {
    id: 'user_lb_09',
    rank: 9,
    prevRank: 10,
    username: 'nusrat_khulna_star',
    displayName: 'Nusrat Jahan',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    country: 'Bangladesh',
    flag: '🇧🇩',
    vipTier: 'BRONZE',
    turnover: 289000,
    winAmount: 28400,
    favoriteGame: 'Sugar Rush 1000',
    prizeReward: '৳ 1,500 + 15 VIP Points',
    isRisingStar: true,
    risingDelta: 1
  },
  {
    id: 'user_lb_10',
    rank: 10,
    prevRank: 9,
    username: 'miraz_barisal_bullet',
    displayName: 'Miraz Bullet',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80',
    country: 'Bangladesh',
    flag: '🇧🇩',
    vipTier: 'BRONZE',
    turnover: 215000,
    winAmount: 19500,
    favoriteGame: 'Aviator Turbo Crash',
    prizeReward: '৳ 1,000 + 10 VIP Points',
    isRisingStar: false
  }
];

interface DailyLeaderboardProps {
  currentUser?: UserEntity;
  currentWallet?: WalletEntity;
  currency?: 'BDT' | 'USD';
  onLaunchGame?: (gameId: string) => void;
}

export const DailyLeaderboard: React.FC<DailyLeaderboardProps> = ({
  currentUser,
  currentWallet,
  currency = 'BDT',
  onLaunchGame
}) => {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>(INITIAL_PLAYERS);
  const [timeRemaining, setTimeRemaining] = useState<string>('07h 42m 19s');
  const [activeCategory, setActiveCategory] = useState<'daily' | 'yesterday' | 'alltime'>('daily');
  const [lastRisingPlayerId, setLastRisingPlayerId] = useState<string | null>('user_lb_03');
  const [autoSimulate, setAutoSimulate] = useState<boolean>(true);

  // Countdown timer simulation for daily leaderboard reset
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const diff = endOfDay.getTime() - now.getTime();

      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeRemaining(
        `${hours.toString().padStart(2, '0')}h ${minutes
          .toString()
          .padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Real-time automatic Rising Star surge simulator
  useEffect(() => {
    if (!autoSimulate) return;

    const interval = setInterval(() => {
      triggerRandomRisingStar();
    }, 7000);

    return () => clearInterval(interval);
  }, [autoSimulate]);

  // Trigger real-time 'Rising Star' animation on a random player
  const triggerRandomRisingStar = () => {
    setPlayers((prev) => {
      const candidates = prev.slice(1); // Pick among ranks 2 to 10
      const randomIndex = Math.floor(Math.random() * candidates.length) + 1;
      const target = candidates[randomIndex - 1];

      // Add a turnover surge
      const surgeAmount = Math.floor(Math.random() * 85000) + 15000;
      const updatedList = prev.map((p) => {
        if (p.id === target.id) {
          return {
            ...p,
            turnover: p.turnover + surgeAmount,
            winAmount: p.winAmount + Math.floor(surgeAmount * 0.28),
            isRisingStar: true,
            risingDelta: 1,
            recentBetTime: 'Just now'
          };
        }
        return {
          ...p,
          isRisingStar: false
        };
      });

      // Sort by turnover descending
      updatedList.sort((a, b) => b.turnover - a.turnover);

      // Re-assign ranks and track position deltas
      const reRanked = updatedList.slice(0, 10).map((player, idx) => {
        const newRank = idx + 1;
        const delta = player.rank - newRank;
        return {
          ...player,
          prevRank: player.rank,
          rank: newRank,
          isRisingStar: player.id === target.id,
          risingDelta: delta > 0 ? delta : delta < 0 ? delta : 1
        };
      });

      setLastRisingPlayerId(target.id);
      return reRanked;
    });
  };

  // Convert Currency
  const formatAmount = (bdt: number) => {
    if (currency === 'BDT') {
      return `৳ ${bdt.toLocaleString('en-US')}`;
    }
    const usd = Math.round(bdt / 120);
    return `$ ${usd.toLocaleString('en-US')}`;
  };

  const getTierBadge = (tier: LeaderboardPlayer['vipTier']) => {
    switch (tier) {
      case 'DIAMOND':
        return 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black border-cyan-300';
      case 'PLATINUM':
        return 'bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black border-slate-300';
      case 'GOLD':
        return 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black border-amber-300';
      case 'SILVER':
        return 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-950 font-bold border-slate-400';
      default:
        return 'bg-gradient-to-r from-amber-700 to-amber-900 text-amber-100 font-bold border-amber-600';
    }
  };

  // Top 3 Players for the Podium
  const rank1 = players.find((p) => p.rank === 1);
  const rank2 = players.find((p) => p.rank === 2);
  const rank3 = players.find((p) => p.rank === 3);

  return (
    <div className="bg-[#090c12] border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 font-mono relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Daily Reset Countdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-[1px] shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-[#0d1017] rounded-[15px] flex items-center justify-center text-amber-400">
              <Trophy className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-black text-white uppercase font-sans tracking-tight">
                দৈনিক লিডারবোর্ড (Daily Turnover Leaderboard)
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40 uppercase">
                Top 10 High-Rollers
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              আজকের সর্বাধিক টার্নওভার (Turnover Volume) খেলোয়াড়দের লাইভ তালিকা ও প্রাইজ পুল।
            </p>
          </div>
        </div>

        {/* Live Timer & Pool Badge */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Daily Prize Pool */}
          <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent border border-amber-500/40 px-3.5 py-1.5 rounded-xl flex items-center space-x-2 text-xs">
            <Gift className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-[10px] text-slate-400 block leading-tight">দৈনিক প্রাইজ পুল:</span>
              <strong className="text-amber-300 font-black">৳ ১,৫০,০০০ / $1,250</strong>
            </div>
          </div>

          {/* Reset Timer */}
          <div className="bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center space-x-2 text-xs">
            <Clock className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="text-[10px] text-slate-400 block leading-tight">রিসেট হতে বাকি:</span>
              <strong className="text-cyan-300 font-mono">{timeRemaining}</strong>
            </div>
          </div>

          {/* Manual Trigger for Rising Star Animation */}
          <button
            onClick={triggerRandomRisingStar}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 transition-all hover:scale-105 active:scale-95 flex items-center space-x-1 text-xs"
            title="Simulate live bet surge & Rising Star animation"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Surge Test</span>
          </button>
        </div>
      </div>

      {/* Top 3 Champions Podium (Visual Gold, Silver, Bronze) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Rank 2 (Silver) */}
        {rank2 && (
          <motion.div
            layout
            key={rank2.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative rounded-3xl p-5 border transition-all flex flex-col justify-between order-2 md:order-1 ${
              rank2.isRisingStar
                ? 'bg-gradient-to-b from-slate-800/90 via-slate-900 to-slate-950 border-cyan-400 shadow-2xl shadow-cyan-500/20'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            {/* Rising Star Badge */}
            {rank2.isRisingStar && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[10px] font-black px-3 py-0.5 rounded-full shadow-lg shadow-cyan-500/40 flex items-center space-x-1 z-20"
              >
                <Sparkles className="w-3 h-3 animate-spin" />
                <span>🌟 RISING STAR +{rank2.risingDelta || 1} RANK!</span>
              </motion.div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-xl bg-slate-400/20 text-slate-300 border border-slate-400/40 font-black text-xs flex items-center justify-center shadow-md">
                  #2
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-sans">২য় স্থান (Silver)</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] border ${getTierBadge(rank2.vipTier)}`}>
                {rank2.vipTier}
              </span>
            </div>

            <div className="text-center py-3 space-y-2">
              <div className="relative inline-block mx-auto">
                <img
                  src={rank2.avatar}
                  alt={rank2.displayName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-400 shadow-lg"
                />
                <span className="absolute -bottom-1 -right-1 text-sm">{rank2.flag}</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white truncate font-sans">{rank2.displayName}</h4>
                <p className="text-[10px] text-slate-400 font-mono">@{rank2.username}</p>
              </div>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-3 border border-slate-800 space-y-1 text-center">
              <div className="text-[10px] text-slate-400 uppercase">টার্নওভার ভলিউম</div>
              <div className="text-base font-black text-slate-200">{formatAmount(rank2.turnover)}</div>
              <div className="text-[10px] text-amber-400 font-bold">পুরস্কার: {rank2.prizeReward}</div>
            </div>
          </motion.div>
        )}

        {/* Rank 1 (Champion Gold) */}
        {rank1 && (
          <motion.div
            layout
            key={rank1.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative rounded-3xl p-5 border transition-all flex flex-col justify-between order-1 md:order-2 md:-mt-3 ${
              rank1.isRisingStar
                ? 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border-amber-400 shadow-2xl shadow-amber-500/30'
                : 'bg-gradient-to-b from-amber-950/30 via-slate-950 to-slate-950 border-amber-500/50 shadow-xl shadow-amber-500/10'
            }`}
          >
            {/* Top Crown Ribbon */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 text-[10px] font-black px-4 py-0.5 rounded-full shadow-lg shadow-amber-500/40 flex items-center space-x-1 z-20">
              <Crown className="w-3.5 h-3.5 fill-current animate-bounce" />
              <span>👑 আজকের চ্যাম্পিয়ন (CHAMPION)</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-2">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-lg shadow-amber-500/30">
                  #1
                </span>
                <span className="text-[10px] text-amber-400 uppercase font-sans font-bold">১ম স্থান (Champion)</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] border ${getTierBadge(rank1.vipTier)}`}>
                {rank1.vipTier}
              </span>
            </div>

            <div className="text-center py-4 space-y-2">
              <div className="relative inline-block mx-auto">
                <div className="w-20 h-20 rounded-3xl p-[2px] bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 shadow-xl shadow-amber-500/30">
                  <img
                    src={rank1.avatar}
                    alt={rank1.displayName}
                    className="w-full h-full rounded-[22px] object-cover"
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 text-base">{rank1.flag}</span>
              </div>

              <div>
                <h4 className="text-base font-black text-white truncate font-sans">{rank1.displayName}</h4>
                <p className="text-[11px] text-amber-400 font-mono font-bold">@{rank1.username}</p>
              </div>
            </div>

            <div className="bg-amber-950/30 rounded-2xl p-3.5 border border-amber-500/40 space-y-1 text-center shadow-inner">
              <div className="text-[10px] text-amber-300 uppercase font-bold">মোট টার্নওভার (Turnover)</div>
              <div className="text-xl font-black text-amber-300">{formatAmount(rank1.turnover)}</div>
              <div className="text-[11px] text-emerald-400 font-bold">গ্র্যান্ড প্রাইজ: {rank1.prizeReward}</div>
            </div>
          </motion.div>
        )}

        {/* Rank 3 (Bronze) */}
        {rank3 && (
          <motion.div
            layout
            key={rank3.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative rounded-3xl p-5 border transition-all flex flex-col justify-between order-3 ${
              rank3.isRisingStar
                ? 'bg-gradient-to-b from-slate-800/90 via-slate-900 to-slate-950 border-cyan-400 shadow-2xl shadow-cyan-500/20'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            {/* Rising Star Badge */}
            {rank3.isRisingStar && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[10px] font-black px-3 py-0.5 rounded-full shadow-lg shadow-cyan-500/40 flex items-center space-x-1 z-20"
              >
                <Sparkles className="w-3 h-3 animate-spin" />
                <span>🌟 RISING STAR +{rank3.risingDelta || 1} RANK!</span>
              </motion.div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-xl bg-amber-700/20 text-amber-600 border border-amber-700/40 font-black text-xs flex items-center justify-center shadow-md">
                  #3
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-sans">৩য় স্থান (Bronze)</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] border ${getTierBadge(rank3.vipTier)}`}>
                {rank3.vipTier}
              </span>
            </div>

            <div className="text-center py-3 space-y-2">
              <div className="relative inline-block mx-auto">
                <img
                  src={rank3.avatar}
                  alt={rank3.displayName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-700/60 shadow-lg"
                />
                <span className="absolute -bottom-1 -right-1 text-sm">{rank3.flag}</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white truncate font-sans">{rank3.displayName}</h4>
                <p className="text-[10px] text-slate-400 font-mono">@{rank3.username}</p>
              </div>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-3 border border-slate-800 space-y-1 text-center">
              <div className="text-[10px] text-slate-400 uppercase">টার্নওভার ভলিউম</div>
              <div className="text-base font-black text-slate-200">{formatAmount(rank3.turnover)}</div>
              <div className="text-[10px] text-amber-400 font-bold">পুরস্কার: {rank3.prizeReward}</div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Ranks 4 to 10 Detailed Real-Time Motion List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase">
            <Award className="w-4 h-4 text-cyan-400" />
            <span>টপ ১০ লিডারবোর্ড র‍্যাঙ্কিং (Ranks 4 - 10)</span>
          </div>
          <span className="text-[10px] text-slate-400 flex items-center space-x-1 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>লাইভ সিঙ্ক হচ্ছে</span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <AnimatePresence>
            {players.slice(3).map((player) => {
              const isRising = player.isRisingStar;

              return (
                <motion.div
                  layout
                  key={player.id}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  className={`relative rounded-2xl p-3.5 sm:p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isRising
                      ? 'bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-950 border-cyan-400 shadow-xl shadow-cyan-500/20'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80'
                  }`}
                >
                  {/* Rising Star Banner Pill */}
                  {isRising && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute -top-2.5 right-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-md flex items-center space-x-1"
                    >
                      <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse" />
                      <span>🌟 RISING STAR! (+{player.risingDelta || 1} Rank)</span>
                    </motion.div>
                  )}

                  {/* Player Profile & Rank */}
                  <div className="flex items-center space-x-3.5">
                    {/* Rank Badge */}
                    <div
                      className={`w-9 h-9 rounded-xl font-mono font-black text-sm flex items-center justify-center shrink-0 border ${
                        player.rank <= 5
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      #{player.rank}
                    </div>

                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <img
                        src={player.avatar}
                        alt={player.displayName}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                      />
                      <span className="absolute -bottom-1 -right-1 text-xs">{player.flag}</span>
                    </div>

                    {/* Name & Tier */}
                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-xs font-sans truncate">
                          {player.displayName}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[8px] border ${getTierBadge(player.vipTier)}`}>
                          {player.vipTier}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-2">
                        <span>@{player.username}</span>
                        <span>•</span>
                        <span className="text-cyan-400 truncate max-w-[120px]">{player.favoriteGame}</span>
                      </div>
                    </div>
                  </div>

                  {/* Turnover & Prize */}
                  <div className="flex items-center justify-between sm:justify-end sm:space-x-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 font-mono">
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] text-slate-400 uppercase">টার্নওভার ভলিউম</div>
                      <div className="text-sm font-black text-white">
                        {formatAmount(player.turnover)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-amber-400 font-bold">প্রাইজ রিওয়ার্ড</div>
                      <div className="text-xs font-bold text-amber-300">
                        {player.prizeReward.split('+')[0]}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Logged in Player Rank Status Bar */}
      {currentUser && (
        <div className="bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 border border-cyan-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-white font-bold font-sans">
                আপনার বর্তমান লিডারবোর্ড অবস্থান: <span className="text-cyan-400">#12 (Top 5%)</span>
              </div>
              <div className="text-[11px] text-slate-400">
                টপ ১০-এ প্রবেশ করতে আরও <strong className="text-amber-300">৳ ৪২,০০০ টার্নওভার</strong> প্রয়োজন!
              </div>
            </div>
          </div>

          <button
            onClick={() => onLaunchGame && onLaunchGame('spribe_aviator')}
            className="py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs uppercase shadow-md active:scale-95 transition-all self-end sm:self-center shrink-0"
          >
            টার্নওভার বাড়ান (Play Now)
          </button>
        </div>
      )}
    </div>
  );
};
