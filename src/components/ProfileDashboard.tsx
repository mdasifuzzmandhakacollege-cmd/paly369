/**
 * @file ProfileDashboard.tsx
 * @description Master Redesigned VIP Profile Dashboard for GamePlay365.
 * Strictly adheres to the Asian-market Emerald & Gold aesthetic:
 * 1. User Header: Avatar, User ID (with copy), Verification Badge, Direct Balance Pill.
 * 2. VIP Progress Bar: V1 to V2 progress with turnover stats, XP percent, and upgrade rewards.
 * 3. Quick Action Cashier Controls: Deposit, Withdraw, Sync.
 * 4. Clean 4-Column Icon-Grid Menu:
 *    - Events (ইভেন্ট ও অফার)
 *    - Missions (দৈনিক মিশন)
 *    - SVIP (ভিআইপি ক্লাব)
 *    - Cashback (ক্যাশব্যাক ও রিবেট)
 *    - Claim (অদাবিকৃত রিওয়ার্ডস - triggers DailyUnclaimedRewardsModal)
 *    - Treasure Chest (এমেরাল্ড ট্রেজার - triggers TreasureChestModal)
 *    - History (লেনদেন হিস্ট্রি)
 *    - Night Mode (ডার্ক/লাইট টগল)
 *    - Affiliate (এজেন্ট ট্রি ও রেফারেল)
 *    - Support (২৪/৭ কাস্টমার সাপোর্ট)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  Sparkles,
  ShieldCheck,
  Award,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  RotateCw,
  Gift,
  Coins,
  History,
  Moon,
  Sun,
  Headphones,
  Users,
  Flame,
  Calendar,
  Zap,
  Target,
  ChevronRight,
  TrendingUp,
  LogOut
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { useWalletGame } from '../contexts/WalletGameContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { soundEngine } from '../services/soundEngine';
import { TreasureChestModal } from './TreasureChestModal';
import { DailyUnclaimedRewardsModal } from './DailyUnclaimedRewardsModal';

interface ProfileDashboardProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onOpenCashier: () => void;
  onNavigateTab?: (tab: any) => void;
}

export const ProfileDashboard: React.FC<ProfileDashboardProps> = ({
  currentUser,
  currentWallet,
  currency,
  onOpenCashier,
  onNavigateTab
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user: firebaseUser, logout: firebaseLogout } = useAuth();
  const {
    formattedBalance,
    refreshState,
    showToast,
    transactions,
    setActiveTab,
    logoutUser,
    isAdmin
  } = useWalletGame();

  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isTreasureOpen, setIsTreasureOpen] = useState<boolean>(false);
  const [isRewardsOpen, setIsRewardsOpen] = useState<boolean>(false);

  // VIP Stats Calculation
  const userTransactions = transactions.filter((tx) => tx.user_id === currentUser.id);
  const totalTurnover = userTransactions
    .filter((tx) => tx.type === 'BET')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const currentVipLevel = 1;
  const nextVipLevel = 2;
  const requiredTurnover = 50000;
  const progressPercent = Math.min(100, Math.round((totalTurnover / requiredTurnover) * 100));

  const handleCopyUserId = () => {
    navigator.clipboard.writeText(currentUser.id);
    setCopiedId(true);
    soundEngine.playClick(950);
    showToast('ইউজার আইডি কপি হয়েছে');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSyncWallet = async () => {
    soundEngine.playClick(850);
    setIsSyncing(true);
    try {
      await refreshState();
      setTimeout(() => {
        setIsSyncing(false);
        showToast('ওয়ালেট ডাটা সিঙ্ক সম্পন্ন হয়েছে');
      }, 500);
    } catch {
      setIsSyncing(false);
    }
  };

  const menuItems = [
    {
      id: 'claim',
      title: 'দাবিকৃত রিওয়ার্ডস',
      titleEn: 'Claim Rewards',
      icon: Gift,
      badge: 'রিওয়ার্ড ভল্ট',
      badgeColor: 'bg-amber-400 text-slate-950 font-black',
      action: () => {
        soundEngine.playClick(1000);
        setIsRewardsOpen(true);
      }
    },
    {
      id: 'treasure',
      title: 'ট্রেজার চেস্ট',
      titleEn: 'Treasure Chest',
      icon: Sparkles,
      badge: 'ফ্রি বক্স',
      badgeColor: 'bg-emerald-500 text-white font-bold',
      action: () => {
        soundEngine.playClick(1000);
        setIsTreasureOpen(true);
      }
    },
    {
      id: 'svip',
      title: 'SVIP এক্সক্লুসিভ',
      titleEn: 'SVIP Privileges',
      icon: Crown,
      badge: 'V1-V10',
      badgeColor: 'bg-amber-400/20 text-amber-300 border border-amber-400/40',
      action: () => {
        soundEngine.playClick(900);
        if (onNavigateTab) onNavigateTab('vip');
        else setActiveTab('vip');
      }
    },
    {
      id: 'affiliate',
      title: 'এজেন্ট ও রেফারেল',
      titleEn: 'Affiliate Network',
      icon: Users,
      badge: '১০% রিবেট',
      badgeColor: 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40',
      action: () => {
        soundEngine.playClick(900);
        if (onNavigateTab) onNavigateTab('affiliate');
        else setActiveTab('affiliate');
      }
    },
    {
      id: 'events',
      title: 'ইভেন্ট ও অফার',
      titleEn: 'Special Events',
      icon: Flame,
      badge: '১৯ অফার',
      badgeColor: 'bg-amber-400 text-slate-950 font-black',
      action: () => {
        soundEngine.playClick(900);
        if (onNavigateTab) onNavigateTab('promo');
        else setActiveTab('promo');
      }
    },
    {
      id: 'missions',
      title: 'দৈনিক মিশন',
      titleEn: 'Daily Missions',
      icon: Target,
      badge: 'নতুন',
      badgeColor: 'bg-cyan-400 text-slate-950 font-bold',
      action: () => {
        soundEngine.playClick(900);
        showToast('আজকের মিশন: ২টি গেমে স্পিন করে ৳৩০০ বোনাস জিতুন');
      }
    },
    {
      id: 'cashback',
      title: 'ক্যাশব্যাক ও রিবেট',
      titleEn: 'Cashback Rebate',
      icon: Coins,
      badge: '৫% রিফান্ড',
      badgeColor: 'bg-emerald-400/20 text-emerald-300',
      action: () => {
        soundEngine.playClick(900);
        if (onNavigateTab) onNavigateTab('wagering');
        else setActiveTab('wagering');
      }
    },
    {
      id: 'history',
      title: 'লেনদেন হিস্ট্রি',
      titleEn: 'Ledger History',
      icon: History,
      badge: undefined,
      action: () => {
        soundEngine.playClick(900);
        if (onNavigateTab) onNavigateTab('audit');
        else setActiveTab('audit');
      }
    },
    {
      id: 'nightmode',
      title: 'নাইট মোড / থিম',
      titleEn: theme === 'dark' ? 'Night Mode (Active)' : 'Day Mode',
      icon: theme === 'dark' ? Moon : Sun,
      badge: undefined,
      action: () => {
        soundEngine.playClick(900);
        toggleTheme();
        showToast(`থিম সুইচ করা হয়েছে: ${theme === 'dark' ? 'লাইট মোড' : 'ডার্ক মোড'}`);
      }
    },
    {
      id: 'support',
      title: '২৪/৭ সাপোর্ট',
      titleEn: 'Live Concierge',
      icon: Headphones,
      badge: 'লাইভ',
      badgeColor: 'bg-emerald-500 text-white font-bold',
      action: () => {
        soundEngine.playClick(900);
        showToast('PLAY369 লাইভ চ্যাট সাপোর্ট সক্রিয় রয়েছে');
      }
    },
    ...(isAdmin ? [{
      id: 'admin_panel',
      title: 'অ্যাডমিন প্যানেল',
      titleEn: 'Admin Operator',
      icon: ShieldCheck,
      badge: 'ADMIN',
      badgeColor: 'bg-amber-500 text-slate-950 font-black',
      action: () => {
        soundEngine.playClick(900);
        if (onNavigateTab) onNavigateTab('admin');
        else setActiveTab('admin');
      }
    }] : [])
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6 text-white font-sans">
      
      {/* 1. TOP USER CARD (Strict Emerald & Gold Aesthetic) */}
      <div className="relative rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-950 to-emerald-900 border-2 border-amber-400/50 p-5 sm:p-7 shadow-[0_0_40px_rgba(16,185,129,0.2)] overflow-hidden">
        {/* Subtle Ambient Gold Glow */}
        <div className="absolute top-0 right-0 w-80 h-32 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          
          {/* Avatar & User ID Details */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-600 p-0.5 shadow-xl shadow-amber-500/25">
                <div className="w-full h-full bg-emerald-950 rounded-[14px] flex items-center justify-center text-slate-950">
                  <span className="text-2xl sm:text-3xl font-black text-transparent bg-gradient-to-br from-amber-300 to-yellow-500 bg-clip-text font-mono">
                    {currentUser.username.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] font-mono shadow-md border border-slate-950 flex items-center gap-1">
                <Crown className="w-3 h-3 fill-current" />
                <span>V{currentVipLevel}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {currentUser.username}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/40 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>ভেরিফায়েড VIP</span>
                </span>
              </div>

              {/* User ID with Copy */}
              <div className="flex items-center space-x-2 text-xs text-emerald-200/80 font-mono">
                <span>UID: {currentUser.id.substring(0, 14)}...</span>
                <button
                  onClick={handleCopyUserId}
                  className="p-1 rounded bg-emerald-900/80 hover:bg-emerald-800 text-amber-300 transition-colors cursor-pointer"
                  title="ইউজার আইডি কপি করুন"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <div className="text-[11px] text-emerald-300/80 font-mono">
                রিজিওন: 🇧🇩 বাংলাদেশ • কারেন্সি: {currency}
              </div>

              {/* Prominent Quick Logout Button in User Card */}
              <div className="pt-1">
                <button
                  onClick={() => {
                    soundEngine.playClick(800);
                    if (firebaseUser) firebaseLogout();
                    logoutUser();
                    showToast('সফলভাবে লগআউট হয়েছে');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-600 border border-rose-500/50 text-rose-300 hover:text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95 shadow-sm"
                >
                  <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>লগ আউট (Sign Out)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Balance Box with Quick Actions */}
          <div className="bg-emerald-950/90 border-2 border-emerald-600/60 p-4 rounded-xl flex flex-col sm:items-end justify-between space-y-3 min-w-[240px]">
            <div className="flex items-center justify-between sm:justify-end space-x-3 w-full">
              <span className="text-xs text-emerald-300 font-medium">ওয়ালেট ব্যালেন্স:</span>
              <button
                onClick={handleSyncWallet}
                disabled={isSyncing}
                className="text-amber-400 hover:text-amber-300 text-xs flex items-center space-x-1 cursor-pointer"
                title="ব্যালেন্স সিঙ্ক"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>সিঙ্ক</span>
              </button>
            </div>

            <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono tracking-tight">
              {formattedBalance}
            </div>

            {/* Quick Action Buttons (Deposit & Withdraw) */}
            <div className="grid grid-cols-2 gap-2 w-full pt-1">
              <button
                onClick={() => {
                  soundEngine.playClick(1200);
                  onOpenCashier();
                }}
                className="py-2 px-3 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-1"
              >
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                <span>ডিপোজিট</span>
              </button>

              <button
                onClick={() => {
                  soundEngine.playClick(1000);
                  onOpenCashier();
                }}
                className="py-2 px-3 rounded-lg bg-emerald-900 hover:bg-emerald-800 border border-emerald-600 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-1"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>উইথড্র</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. VIP PROGRESS BAR (V1 to V2) */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 border-2 border-emerald-600/50 p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="font-black text-white">VIP প্রগ্রেস লেডার</span>
            <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-400/30">
              V{currentVipLevel} ➜ V{nextVipLevel}
            </span>
          </div>

          <div className="text-emerald-300 font-mono font-bold">
            প্রগ্রেস: <span className="text-amber-300">{progressPercent}%</span>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-3 rounded-full bg-emerald-950 border border-emerald-700/60 overflow-hidden p-0.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-emerald-200/80 font-mono pt-1">
          <span>বর্তমান টার্নওভার: {currency === 'BDT' ? '৳' : '$'}{totalTurnover.toLocaleString()}</span>
          <span>V2 লক্ষ্যমাত্রা: {currency === 'BDT' ? '৳' : '$'}{requiredTurnover.toLocaleString()}</span>
        </div>
      </div>

      {/* 3. CLEAN ICON-GRID MENU (Asian-market iGaming Style) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white tracking-tight flex items-center space-x-2">
            <span>দ্রুত অ্যাক্সেস মেনু (Quick Access Menu)</span>
          </h3>
          <span className="text-xs text-emerald-300/80 font-mono">১০টি সার্ভিস</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={item.action}
                className="relative rounded-xl p-4 bg-emerald-900/60 hover:bg-emerald-800/80 border-2 border-emerald-600/40 hover:border-amber-400/80 transition-all flex flex-col items-center text-center cursor-pointer shadow-sm group min-h-[110px] justify-between"
              >
                {/* Optional Badge */}
                {item.badge && (
                  <span className={`absolute top-2 right-2 px-1.5 py-0.2 rounded-md text-[9px] ${item.badgeColor || 'bg-amber-400 text-slate-950'}`}>
                    {item.badge}
                  </span>
                )}

                {/* Icon in Gold Ring */}
                <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700/60 group-hover:border-amber-400/80 flex items-center justify-center text-amber-400 transition-colors shrink-0 mt-1">
                  <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </div>

                <div className="mt-2">
                  <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-emerald-300/70 font-sans">
                    {item.titleEn}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 4. DEDICATED SIGN OUT / LOGOUT CARD */}
      <div className="pt-2">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            soundEngine.playClick(800);
            if (firebaseUser) firebaseLogout();
            logoutUser();
            showToast('সফলভাবে লগআউট হয়েছে');
          }}
          className="w-full py-3.5 px-4 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border-2 border-rose-500/40 text-rose-300 hover:text-white flex items-center justify-center space-x-2 font-black text-sm tracking-wide shadow-lg shadow-rose-950/40 cursor-pointer transition-all active:scale-95"
        >
          <LogOut className="w-5 h-5 text-rose-400 stroke-[2.5]" />
          <span>অ্যাকাউন্ট থেকে লগ আউট করুন (Sign Out)</span>
        </motion.button>
      </div>

      {/* Gamified Modals */}
      <TreasureChestModal
        isOpen={isTreasureOpen}
        onClose={() => setIsTreasureOpen(false)}
        currency={currency}
      />

      <DailyUnclaimedRewardsModal
        isOpen={isRewardsOpen}
        onClose={() => setIsRewardsOpen(false)}
        currency={currency}
      />
    </div>
  );
};
