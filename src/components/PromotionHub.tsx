/**
 * @file PromotionHub.tsx
 * @description Master Promotional & Reward Center for Playall 365.
 * Structured with harmonious visual proportion, balanced hierarchy, responsive mobile layout,
 * 7-Day Streak Tracker, Cryptographically Secure Weighted Lucky Fortune Wheel, Rich Campaign Cards,
 * and Instant Bonus/Wagering Ledger integration.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Gift,
  Sparkles,
  Calendar,
  RotateCcw,
  Crown,
  Check,
  Lock,
  Target,
  Zap,
  Flame,
  Clock,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Award,
  HelpCircle,
  Coins,
  ArrowUpRight,
  Percent,
  CheckCircle2,
  X,
  Share2,
  Users
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { DAILY_CHECKIN_REWARDS, WHEEL_PRIZES } from '../shared/gameplayConfig';
import { notificationService } from '../services/notificationService';
import { soundEngine } from '../services/soundEngine';
import { useWalletGame } from '../contexts/WalletGameContext';
import { WageringRequirements } from './WageringRequirements';
import { auth } from '../lib/firebase';
import { DailyMissions } from './DailyMissions';
import { motion, AnimatePresence } from 'framer-motion';

interface PromotionHubProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onRewardClaimed: () => void;
  onOpenCashier?: () => void;
}

interface PromoOffer {
  id: string;
  category: 'WELCOME' | 'CASHBACK' | 'SPORTS' | 'VIP' | 'SLOTS';
  title: string;
  subtitle: string;
  bonusAmount: string;
  badge: string;
  badgeColor: string;
  accentGradient: string;
  turnover: string;
  minDeposit: string;
  maxBonus: string;
  validity: string;
  eligibleGames: string;
  description: string;
  terms: string[];
  claimCode: string;
}

const PROMOTIONAL_OFFERS: PromoOffer[] = [
  {
    id: 'f111-daily-vip-999',
    category: 'VIP',
    title: 'দৈনিক লগইন ভিআইপি বোনাস ৳৯৯৯',
    subtitle: 'প্রতিদিন লগইন করে ইনস্ট্যান্ট ভিআইপি ক্যাশ রিওয়ার্ড লুফে নিন',
    bonusAmount: '৳ ৯৯৯ পর্যন্ত ফ্রি',
    badge: 'DAILY VIP ৳999',
    badgeColor: 'bg-[#54D62C] text-slate-950 font-black',
    accentGradient: 'from-emerald-500/25 via-[#54D62C]/15 to-transparent border-[#54D62C]/50',
    turnover: '১x রোলওভার',
    minDeposit: '০ টাকা (ফ্রি লগইন)',
    maxBonus: '৳ ৯৯৯ সরাসরি ক্যাশ',
    validity: 'প্রতিদিন একবার',
    eligibleGames: 'সকল স্লটস (PG Soft, JILI), ক্র্যাশ (Aviator), লাইভ ক্যাসিনো',
    description: 'প্রতিদিন PLAY369-এ লগইন করলেই পাচ্ছেন নিশ্চিত ফ্রি ক্যাশ বোনাস। নিয়মিত চেক-ইন বজায় রেখে সর্বোচ্চ ৳৯৯৯ ভিআইপি ক্যাশ ড্রপ উপভোগ করুন।',
    terms: [
      'প্রতিদিন ২৪ ঘণ্টার মধ্যে একবার লগইন করে ক্লেম করা যাবে।',
      'বোনাস সরাসরি আপনার মেইন ওয়ালেটে ক্রেডিট হবে।',
      'মাত্র ১x রোলওভার সম্পূর্ণ করলেই যেকোনো সময় বিকাশ বা নগদে উইথড্র করা যাবে।'
    ],
    claimCode: 'DAILYVIP999'
  },
  {
    id: 'f111-share-friend-999',
    category: 'WELCOME',
    title: 'বন্ধুদের সাথে শেয়ার করুন বোনাস ৳৯৯৯',
    subtitle: 'রেফারেল লিংক অথবা টেলিগ্রামে শেয়ার করে ইনস্ট্যান্ট ক্যাশ ইনকাম',
    bonusAmount: '৳ ৯৯৯ + আজীবন কমিশন',
    badge: 'SHARE & EARN ৳999',
    badgeColor: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black',
    accentGradient: 'from-amber-500/25 via-yellow-500/15 to-transparent border-amber-400/50',
    turnover: '০x নো-ওয়েজার',
    minDeposit: 'বন্ধুর প্রথম ডিপোজিট ৳৫০০',
    maxBonus: 'আনলিমিটেড',
    validity: 'আজীবন মেয়াদ',
    eligibleGames: 'সকল গেমসে বৈধ',
    description: 'আপনার ব্যক্তিগত ইনভাইট লিংক বন্ধুদের সাথে ফেসবুক, হোয়াটসঅ্যাপ বা টেলিগ্রামে শেয়ার করুন। বন্ধু যুক্ত হলেই পাবেন ৳৯৯৯ ইনস্ট্যান্ট বোনাস ও লাইফটাইম কমিশন।',
    terms: [
      'রেফার করা বন্ধু রেজিস্ট্রেশন করে প্রথম ডিপোজিট সম্পন্ন করলে বোনাস অ্যাক্টিভ হবে।',
      'টাকা সরাসরি রিয়াল ক্যাশ ব্যালেন্সে জমা হবে।',
      'দৈনিক যেকোনো সময় সরাসরি ক্যাশ-আউটযোগ্য।'
    ],
    claimCode: 'SHARE999'
  },
  {
    id: 'welcome-300',
    category: 'WELCOME',
    title: '৩০০% মেগা ফার্স্ট ডিপোজিট বোনাস',
    subtitle: 'নতুন ইউজারদের জন্য স্পেশাল ট্রিপল ওয়েলকাম অফার',
    bonusAmount: '৳ ৩০,০০০ পর্যন্ত',
    badge: 'HOT WELCOME',
    badgeColor: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950',
    accentGradient: 'from-amber-500/20 via-yellow-500/10 to-transparent border-amber-500/40',
    turnover: '১৫x টার্নওভার',
    minDeposit: '৳ ৫০০',
    maxBonus: '৳ ৩০,০০০ + ১০০ ফ্রি স্পিন',
    validity: '৩০ দিন',
    eligibleGames: 'সকল স্লটস ও ক্র্যাশ গেমস (Spribe Aviator, JILI, PG Soft)',
    description: 'প্রথম ডিপোজিটে পান তাৎক্ষণিক ৩০০% বোনাস এবং ১০০টি ফ্রি স্পিন। সহজ টার্নওভার পূরণ করেই সরাসরি রিয়াল ব্যালেন্সে কনভার্ট করুন।',
    terms: [
      'এই অফারটি শুধুমাত্র নতুন নিবন্ধিত অ্যাকাউন্ট ও প্রথম ডিপোজিটের জন্য প্রযোজ্য।',
      'সর্বনিম্ন ডিপোজিট ৳৫০০ অথবা $৫।',
      'বোনাস তোলার পূর্বে (Deposit + Bonus) ১৫ গুণ (15x) টার্নওভার সম্পন্ন করতে হবে।',
      'টার্নওভার সম্পন্ন করার সর্বোচ্চ সময়সীমা ৩০ দিন।'
    ],
    claimCode: 'WELCOME300'
  },
  {
    id: 'daily-live-cashback',
    category: 'CASHBACK',
    title: '১০% দৈনিক আনলিমিটেড লাইভ ক্যাসিনো রিবেট',
    subtitle: 'প্রতিদিনের লাইভ গেমিংয়ে তাৎক্ষণিক রিফান্ড',
    bonusAmount: '১০% আনলিমিটেড',
    badge: 'DAILY CASHBACK',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
    accentGradient: 'from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/40',
    turnover: '১x রোলওভার',
    minDeposit: 'কোনো লিমিট নেই',
    maxBonus: 'আনলিমিটেড ক্যাশব্যাক',
    validity: 'প্রতিদিন রাত ১২:০০',
    eligibleGames: 'Evolution Gaming, Pragmatic Live, Sexy Baccarat, Roulette',
    description: 'লাইভ ক্যাসিনোর প্রতিটি রাউন্ডে জয় বা পরাজয় যাই হোক, প্রতিদিন পাবেন ১০% সরাসরি ক্যাশব্যাক কোনো জটিল শর্ত ছাড়াই।',
    terms: [
      'প্রতিদিন স্বয়ংক্রিয়ভাবে রাত ১২:০০ টায় ক্যাশব্যাক গণনা ও ওয়ালেটে ক্রেডিট করা হয়।',
      'শুধুমাত্র ১ গুণ (1x) রোলওভার খেলেই সম্পূর্ণ টাকা উইথড্র করা যাবে।',
      'কোনো সর্বোচ্চ বোনাস সীমা নেই।'
    ],
    claimCode: 'LIVEREBATE10'
  },
  {
    id: 'sports-insurance',
    category: 'SPORTS',
    title: '১০০% স্পোর্টস ফার্স্ট বেট ইন্স্যুরেন্স',
    subtitle: 'ক্রিকেট ও ফুটবলে নো-রিস্ক প্রিমিয়াম বেটিং',
    bonusAmount: '৳ ৫,০০০ রিফান্ড',
    badge: 'SPORTS SHIELD',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40',
    accentGradient: 'from-cyan-500/20 via-blue-500/10 to-transparent border-cyan-500/40',
    turnover: '৩x টার্নওভার',
    minDeposit: '৳ ১,০০০',
    maxBonus: '৳ ৫,০০০ পর্যন্ত শতভাগ ফেরত',
    validity: '১৪ দিন',
    eligibleGames: 'IPL 2026, BPL, UEFA Champions League, Premier League',
    description: 'স্পোর্টসবুকে আপনার প্রথম প্রেডিকশন ভুল হলেও সম্পূর্ণ টাকা বোনাস হিসেবে রিফান্ড পেয়ে যাবেন।',
    terms: [
      'ন্যূনতম ১.৫০ বা তার বেশি অডস (Odds)-এর স্পোর্টস বেটে প্রযোজ্য।',
      'যদি বেট লস হয়, তবে সর্বোচ্চ ৳৫,০০০ পর্যন্ত শতভাগ ক্যাশব্যাক প্রদান করা হবে।',
      'বোনাস ব্যালেন্স দিয়ে যেকোনো স্পোর্টস ম্যাচে ৩x টার্নওভার সম্পন্ন করতে হবে।'
    ],
    claimCode: 'SPORTS100'
  },
  {
    id: 'weekly-vip-lossback',
    category: 'VIP',
    title: '১৫% সাপ্তাহিক ভিআইপি লস-ব্যাক ভল্ট',
    subtitle: 'ভিআইপি টায়ার মেম্বারদের জন্য এক্সক্লুসিভ রিওয়ার্ড',
    bonusAmount: '৳ ১,০০,০০০ পর্যন্ত',
    badge: 'VIP EXCLUSIVE',
    badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
    accentGradient: 'from-purple-500/20 via-pink-500/10 to-transparent border-purple-500/40',
    turnover: '০x নো-ওয়েজার (রিয়াল ক্যাশ)',
    minDeposit: 'ভিআইপি লেভেল ৩+',
    maxBonus: '৳ ১,০০,০০০',
    validity: 'প্রতি সোমবার',
    eligibleGames: 'প্ল্যাটফর্মের সকল গেমস',
    description: 'প্রতি সপ্তাহের মোট নেট লসের ওপর ১৫% পর্যন্ত নো-ওয়েজারিং ডিরেক্ট রিয়াল ব্যালেন্স রিফান্ড। সরাসরি ক্যাশ-আউট যোগ্য।',
    terms: [
      'শুধুমাত্র ভিআইপি সিলভার, গোল্ড ও প্ল্যাটিনাম মেম্বারদের জন্য প্রযোজ্য।',
      'কোনো টার্নওভার শর্ত নেই (০x Wagering) – টাকা সরাসরি রিয়াল ব্যালেন্সে জমা হবে।',
      'প্রতি সোমবার সকাল ১০:০০ টায় স্বয়ংক্রিয় ডিপোজিট।'
    ],
    claimCode: 'VIPLOSS15'
  },
  {
    id: 'refer-friend-bounty',
    category: 'WELCOME',
    title: '৳ ৫০০ ফ্রেন্ড রেফারেল বাউন্টি + ১০% লাইফটাইম কমিশন',
    subtitle: 'বন্ধুদের ইনভাইট করে আনলিমিটেড প্যাসিভ আর্নিং',
    bonusAmount: '৳ ৫০০ + ১০% কমিশন',
    badge: 'AFFILIATE PASS',
    badgeColor: 'bg-amber-400/20 text-amber-300 border border-amber-400/40',
    accentGradient: 'from-amber-500/20 via-yellow-500/10 to-transparent border-amber-500/40',
    turnover: '১x রোলওভার',
    minDeposit: 'রেফার্ড ফ্রেন্ড ডিপোজিট ৳৫০০',
    maxBonus: 'আনলিমিটেড',
    validity: 'আজীবন মেয়াদ',
    eligibleGames: 'সকল গেমস',
    description: 'আপনার রেফারেল লিংকে বন্ধু যোগ দিয়ে প্রথম ডিপোজিট করলেই পাবেন ইনস্ট্যান্ট ৳৫০০ বোনাস এবং তার প্রতিটি বেটে ১০% আজীবন কমিশন।',
    terms: [
      'রেফার করা বন্ধুকে কমপক্ষে ৳৫০০ প্রথম ডিপোজিট করতে হবে।',
      'বোনাস তাৎক্ষণিকভাবে অ্যাফিলিয়েট লেজারে জমা হবে।',
      'দৈনিক যেকোনো সময় ক্যাশ-আউট করা সম্ভব।'
    ],
    claimCode: 'FRIEND500'
  },
  {
    id: 'mystery-jackpot-drops',
    category: 'SLOTS',
    title: '৳ ১০,০০,০০০ মেগা মিস্ট্রি প্রাইজ ড্রপস',
    subtitle: 'যেকোনো সাধারণ স্পিনেই হতে পারেন কোটিপতি',
    bonusAmount: '৳ ১০,০০,০০০ প্রাইজ পুল',
    badge: 'MYSTERY DROPS',
    badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
    accentGradient: 'from-rose-500/20 via-red-500/10 to-transparent border-rose-500/40',
    turnover: '০x রিয়াল ক্যাশ ড্রপ',
    minDeposit: 'যেকোনো বেট ৳১০+',
    maxBonus: '৳ ৫০,০০০ পার ড্রপ',
    validity: '২৪/৭ লাইভ',
    eligibleGames: 'Gates of Olympus, Sweet Bonanza, Fortune Gems, Crazy Time',
    description: 'কোনো নির্দিষ্ট কম্বিনেশন ছাড়াই যেকোনো স্পিন করার সময় হঠাৎ স্ক্রিনে ভেসে উঠবে র্যান্ডম ক্যাশ জ্যাকপট প্রাইজ ড্রপ।',
    terms: [
      'সর্বনিম্ন বেট ৳১০ বা তার বেশি হতে হবে।',
      'দৈনিক ৫০+ জন প্লেয়ারকে র্যান্ডম ক্যাশ প্রাইজ দেওয়া হয়।',
      'টাকা সরাসরি রিয়াল ক্যাশ হিসেবে জমা হয়।'
    ],
    claimCode: 'MYSTERY2026'
  }
];

export const PromotionHub: React.FC<PromotionHubProps> = ({
  currentUser,
  currentWallet,
  currency,
  onRewardClaimed,
  onOpenCashier
}) => {
  const { showToast, refreshState } = useWalletGame();

  // Navigation Filter
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'OFFERS' | 'STREAK_WHEEL' | 'MISSIONS' | 'TURNOVER'>('OFFERS');

  // Selected Offer Modal
  const [selectedOffer, setSelectedOffer] = useState<PromoOffer | null>(null);
  const [claimingOfferId, setClaimingOfferId] = useState<string | null>(null);

  // 7-Day Streak & Wheel State (Authoritative from Server / Database)
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [hasCheckedInToday, setHasCheckedInToday] = useState<boolean>(false);
  const [checkInLoading, setCheckInLoading] = useState<boolean>(false);

  // Wheel Spin State (Authoritative from Server / Database)
  const [spinning, setSpinning] = useState<boolean>(false);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [spinsRemaining, setSpinsRemaining] = useState<number>(0);
  const [wonPrize, setWonPrize] = useState<typeof WHEEL_PRIZES[0] | null>(null);

  // Helper to attach verified Firebase ID token
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    try {
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Could not get Firebase auth token:', e);
    }
    return headers;
  };

  // Load Authoritative State from Server Promotion API
  const fetchPromotionState = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/promo/details?userId=${encodeURIComponent(currentUser.id)}`, {
        headers
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'SUCCESS' && json.data) {
          setCurrentStreak(json.data.checkInStreak ?? 0);
          setHasCheckedInToday(!json.data.canCheckInToday);
          setSpinsRemaining(json.data.availableSpins ?? 0);
        }
      }
    } catch (err) {
      console.warn('Unable to fetch server promo details:', err);
    }
  }, [currentUser.id]);

  useEffect(() => {
    fetchPromotionState();
  }, [fetchPromotionState]);

  // Handle Daily Check In (Server-Authoritative)
  const handleCheckIn = async () => {
    if (hasCheckedInToday || checkInLoading) return;
    setCheckInLoading(true);
    soundEngine.playClick(900);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/promo/checkin', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: currentUser.id })
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.status === 'SUCCESS' && json.data) {
        const { streakDay, rewardAmount } = json.data;
        setCurrentStreak(streakDay);
        setHasCheckedInToday(true);

        notificationService.pushNotification(currentUser.id, {
          userId: currentUser.id,
          title: '🎁 ডেইলি স্ট্রিক রিওয়ার্ড ক্লেইম!',
          message: `ডে ${streakDay} ডেইলি চেক-ইন বোনাস ৳${rewardAmount} সফলভাবে ওয়ালেটে যোগ হয়েছে!`,
          type: 'BONUS_UNLOCKED',
          amount: rewardAmount,
          currency: currentUser.currency as 'BDT' | 'USD',
          isRead: false,
          actionTab: 'promo'
        });

        soundEngine.playWinChime();
        showToast(`অভিনন্দন! ডে ${streakDay} বোনাস ৳${rewardAmount} যুক্ত হয়েছে!`);
        onRewardClaimed();
        refreshState();
        await fetchPromotionState();
      } else {
        const msg = json.message || 'চেক-ইন রিওয়ার্ড ক্লেইম ব্যর্থ হয়েছে।';
        showToast(msg);
        await fetchPromotionState();
      }
    } catch (err) {
      console.error('Server check-in request error:', err);
      showToast('সার্ভার কানেকশন ত্রুটি! অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
      await fetchPromotionState();
    } finally {
      setCheckInLoading(false);
    }
  };

  // Handle Wheel Spin (Server-Authoritative RNG & Ledger Credit)
  const handleSpinWheel = async () => {
    if (spinning || spinsRemaining <= 0) return;
    setSpinning(true);
    setWonPrize(null);
    soundEngine.playClick(1000);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/promo/spin', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: currentUser.id })
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.status !== 'SUCCESS' || !json.data?.prize) {
        setSpinning(false);
        const errMsg = json.message || 'স্পিন রিকোয়েস্ট ব্যর্থ হয়েছে!';
        showToast(errMsg);
        await fetchPromotionState();
        return;
      }

      const serverPrize = json.data.prize;
      const prizeIndex = WHEEL_PRIZES.findIndex((p) => p.label === serverPrize.label);
      const safeIndex = prizeIndex >= 0 ? prizeIndex : 0;
      const selectedPrize = WHEEL_PRIZES[safeIndex];

      const extraSpins = 5 * 360;
      const sliceAngle = 360 / WHEEL_PRIZES.length;
      const targetAngle = extraSpins + (360 - safeIndex * sliceAngle);

      setWheelRotation((prev) => prev + targetAngle);

      setTimeout(async () => {
        setSpinning(false);
        setSpinsRemaining((prev) => Math.max(0, prev - 1));
        setWonPrize(selectedPrize);

        if (selectedPrize.value > 0) {
          notificationService.pushNotification(currentUser.id, {
            userId: currentUser.id,
            title: '🎡 লাকি স্পিন উইন!',
            message: `লাকি ফরচুন স্পিন থেকে আপনি জিতেছেন: ${selectedPrize.label}!`,
            type: 'VIP_UPGRADE',
            amount: selectedPrize.value,
            currency: currentUser.currency as 'BDT' | 'USD',
            isRead: false,
            actionTab: 'promo'
          });

          soundEngine.playWinChime();
          showToast(`🎉 লাকি স্পিন উইন! ${selectedPrize.label}`);
          onRewardClaimed();
          refreshState();
        }
        await fetchPromotionState();
      }, 3500);
    } catch (err) {
      console.error('Spin wheel request failed:', err);
      setSpinning(false);
      showToast('সার্ভার কানেকশন ত্রুটি! অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
      await fetchPromotionState();
    }
  };

  // Handle Claim Offer Action
  const handleClaimOffer = (offer: PromoOffer) => {
    setClaimingOfferId(offer.id);
    soundEngine.playClick(950);

    setTimeout(() => {
      setClaimingOfferId(null);
      setSelectedOffer(null);

      notificationService.pushNotification(currentUser.id, {
        userId: currentUser.id,
        title: `🔥 ${offer.title} সক্রিয় হয়েছে`,
        message: `আপনার প্রমোশন ভাউচার কোড "${offer.claimCode}" ক্যাশিয়ারে ডিপোজিটের সাথে ব্যবহার করুন।`,
        type: 'BONUS_UNLOCKED',
        currency: currentUser.currency as 'BDT' | 'USD',
        isRead: false,
        actionTab: 'wagering'
      });

      soundEngine.playWinChime();
      showToast(`অফার "${offer.title}" সক্রিয় হয়েছে! প্রোমো কোড: ${offer.claimCode}`);
      onRewardClaimed();
      if (onOpenCashier) {
        onOpenCashier();
      }
    }, 600);
  };

  const filteredOffers = PROMOTIONAL_OFFERS.filter((o) => {
    if (activeCategory === 'ALL') return true;
    return o.category === activeCategory;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-28 font-sans text-slate-100 selection:bg-amber-400 selection:text-slate-950"
    >
      {/* 1. MASTER PROMOTIONS HERO BANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left Column: 300% Mega Welcome Bonus */}
        <div className="lg:col-span-7 rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-950 to-emerald-900 border-2 border-amber-400/50 p-5 sm:p-7 relative overflow-hidden flex flex-col justify-between shadow-xl">
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-amber-400/20 to-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-3.5 relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold tracking-wider uppercase">
                <Flame className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                <span>মেগা ওয়েলকাম ক্যাম্পেইন ২০২৬</span>
              </div>

              <div className="flex items-center space-x-1.5 text-emerald-200 text-xs font-mono bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-700/60">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>মেয়াদ বাকি: <strong>১৩ ঘণ্টা ৪২ মিনিট</strong></span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              ৩০০% ডিপোজিট বোনাস + ১০০ ফ্রি স্পিন
            </h1>

            <p className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed font-sans max-w-xl">
              প্রথম ডিপোজিটে পান সর্বোচ্চ <strong className="text-amber-300 font-mono">৳৩০,০০০</strong> পর্যন্ত নিশ্চিত বোনাস। সহজ ১৫x টার্নওভার এবং সাথে সাথে ১০০ ফ্রি স্পিন স্লট খেলায় ব্যবহার করুন।
            </p>

            {/* Feature Highlights Pill Grid */}
            <div className="grid grid-cols-3 gap-2.5 pt-1 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-700/60">
                <div className="text-amber-300 font-bold flex items-center space-x-1">
                  <Percent className="w-3.5 h-3.5" />
                  <span>১৫x টার্নওভার</span>
                </div>
                <div className="text-emerald-300/80 text-[10px] mt-0.5">সহজ রূপান্তর শর্ত</div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-700/60">
                <div className="text-emerald-300 font-bold flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>ইনস্ট্যান্ট ক্রেডিট</span>
                </div>
                <div className="text-emerald-300/80 text-[10px] mt-0.5">০-৪ সেকেন্ডে ডিপোজিট</div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-700/60">
                <div className="text-amber-300 font-bold flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>১০০% সুরক্ষিত</span>
                </div>
                <div className="text-emerald-300/80 text-[10px] mt-0.5">অফিসিয়াল গেমিং লাইসেন্স</div>
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-5 mt-3 border-t border-emerald-800/80 font-mono text-xs relative z-10">
            <button
              onClick={() => {
                const welcomePromo = PROMOTIONAL_OFFERS[0];
                handleClaimOffer(welcomePromo);
              }}
              className="flex-1 min-h-[46px] px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>এখনই বোনাস ক্লেইম করুন</span>
            </button>

            <button
              onClick={() => {
                setSelectedOffer(PROMOTIONAL_OFFERS[0]);
                soundEngine.playClick(800);
              }}
              className="min-h-[46px] px-5 py-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 hover:text-white font-bold active:scale-95 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>শর্তাবলী দেখুন</span>
            </button>
          </div>
        </div>

        {/* Right Column: Daily Rewards Snapshot */}
        <div className="lg:col-span-5 rounded-2xl p-5 sm:p-7 relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-emerald-950 via-emerald-900 to-[#02180e] border-2 border-emerald-600/40 shadow-xl">
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white uppercase">৭-দিনের ডেইলি স্ট্রিক</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/40">
                DAY {currentStreak}/7
              </span>
            </div>

            <div className="p-3 bg-emerald-950/80 rounded-xl border border-emerald-700/60 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-emerald-200/80">আজকের নিশ্চিত রিওয়ার্ড:</span>
                <span className="text-amber-300 font-bold text-sm">
                  ৳{DAILY_CHECKIN_REWARDS[currentStreak - 1]?.reward || 150} বোনাস
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-emerald-200/80">পরবর্তী গ্র্যান্ড প্রাইজ:</span>
                <span className="text-amber-300 font-bold">৳১,০০০ + লাকি টিকিট</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-900/60 rounded-xl border border-emerald-700/60 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-emerald-200">লাকি ফরচুন হুইল স্পিন বাকি:</span>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-bold">
                {spinsRemaining} স্পিন
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-4 mt-2 border-t border-emerald-800/80 font-mono text-xs">
            <button
              onClick={handleCheckIn}
              disabled={hasCheckedInToday || checkInLoading}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{hasCheckedInToday ? 'আজকের ক্লেইমড' : checkInLoading ? 'ক্লেইম হচ্ছে...' : 'ডেইলি চেক-ইন'}</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick(850);
                setActiveTab('STREAK_WHEEL');
              }}
              className="py-3 px-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-amber-300 font-bold active:scale-95 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>ফরচুন স্পিন</span>
            </button>
          </div>
        </div>

      </div>

      {/* 2. TABBED NAVIGATION */}
      <div className="flex items-center space-x-2 bg-emerald-950/80 p-1.5 rounded-2xl border border-emerald-700/60 font-mono text-xs overflow-x-auto scrollbar-none">
        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('OFFERS');
          }}
          className={`min-h-[42px] px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'OFFERS'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md'
              : 'text-emerald-200 hover:text-white'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>সকল প্রমোশন ও বোনাস ({PROMOTIONAL_OFFERS.length})</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('STREAK_WHEEL');
          }}
          className={`min-h-[42px] px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'STREAK_WHEEL'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md'
              : 'text-emerald-200 hover:text-white'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>ডেইলি স্ট্রিক ও লাকি স্পিন</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('MISSIONS');
          }}
          className={`min-h-[42px] px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'MISSIONS'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md'
              : 'text-emerald-200 hover:text-white'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>ডেইলি মিশন ও টাস্ক</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('TURNOVER');
          }}
          className={`min-h-[42px] px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'TURNOVER'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md'
              : 'text-emerald-200 hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>টার্নওভার ম্যানেজার</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. OFFERS VIEW & CATEGORY FILTER */}
      {/* ========================================================================= */}
      {activeTab === 'OFFERS' && (
        <div className="space-y-5">
          {/* Category Filter Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
            {[
              { id: 'ALL', label: 'সকল অফার' },
              { id: 'WELCOME', label: 'ওয়েলকাম প্যাক' },
              { id: 'CASHBACK', label: 'দৈনিক ক্যাশব্যাক' },
              { id: 'SPORTS', label: 'স্পোর্টসবুক' },
              { id: 'VIP', label: 'ভিআইপি স্পেশাল' },
              { id: 'SLOTS', label: 'স্লটস জ্যাকপট' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  soundEngine.playClick(700);
                  setActiveCategory(cat.id);
                }}
                className={`min-h-[38px] px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Promotional Offer Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOffers.map((offer) => (
              <div
                key={offer.id}
                className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:border-amber-400 hover:shadow-xl hover:shadow-emerald-900/40 group shadow-md"
              >
                <div className="space-y-3">
                  {/* Top Badge & Code */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${offer.badgeColor}`}>
                      {offer.badge}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-700/60">
                      {offer.claimCode}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors leading-snug">
                      {offer.title}
                    </h3>
                    <p className="text-xs text-emerald-200/80 font-sans mt-1 leading-relaxed">
                      {offer.subtitle}
                    </p>
                  </div>

                  {/* Highlight Bonus Value */}
                  <div className="p-3 bg-emerald-950/90 rounded-xl border border-emerald-700/60 font-mono flex items-center justify-between">
                    <span className="text-emerald-200/80 text-xs">বোনাস পরিমাণ:</span>
                    <span className="text-sm font-black text-transparent bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400 bg-clip-text">
                      {offer.bonusAmount}
                    </span>
                  </div>

                  {/* Meta Details */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-emerald-200 pt-1">
                    <div className="bg-emerald-950/80 p-2 rounded-xl border border-emerald-700/60">
                      <span className="text-[10px] text-emerald-400/80 block">টার্নওভার</span>
                      <span className="font-bold text-amber-300">{offer.turnover}</span>
                    </div>
                    <div className="bg-emerald-950/80 p-2 rounded-xl border border-emerald-700/60">
                      <span className="text-[10px] text-emerald-400/80 block">মিনিমাম ডিপোজিট</span>
                      <span className="font-bold text-amber-300">{offer.minDeposit}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Actions */}
                <div className="grid grid-cols-2 gap-2 pt-4 mt-3 border-t border-emerald-800/80 font-mono text-xs">
                  <button
                    onClick={() => {
                      soundEngine.playClick(800);
                      setSelectedOffer(offer);
                    }}
                    className="py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 hover:text-white font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>শর্তাবলী</span>
                  </button>

                  <button
                    onClick={() => handleClaimOffer(offer)}
                    disabled={claimingOfferId === offer.id}
                    className="py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black shadow-md active:scale-95 transition-all flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{claimingOfferId === offer.id ? 'ক্লেইম হচ্ছে...' : 'ক্লেইম করুন'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. LUCKY WHEEL & 7-DAY STREAK VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'STREAK_WHEEL' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Column (6-cols): 7-Day Daily Check-In Streak */}
          <div className="lg:col-span-6 rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-7 space-y-4 font-mono text-xs flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white uppercase">৭-দিনের ধারাবাহিক চেক-ইন স্ট্রিক</h2>
              </div>
              <span className="text-[11px] text-amber-300 font-bold">Streak: Day {currentStreak}/7</span>
            </div>

            <p className="text-emerald-200/90 font-sans text-xs leading-relaxed">
              প্রতিদিন লগইন করে রিওয়ার্ড ক্লেইম করুন। ৭ম দিনে পৌঁছালে নিশ্চিত পাবেন ৳১,০০০ গ্র্যান্ড রিওয়ার্ড এবং ভিআইপি লাকি স্পিন টিকিট।
            </p>

            {/* 7 Days Reward Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {DAILY_CHECKIN_REWARDS.map((item) => {
                const isClaimed = item.day <= currentStreak && hasCheckedInToday;
                const isToday = item.day === (hasCheckedInToday ? currentStreak : currentStreak + 1);

                return (
                  <div
                    key={item.day}
                    className={`relative p-2.5 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                      isClaimed
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : isToday
                        ? 'bg-amber-500/20 border-amber-400 shadow-md shadow-amber-500/20 text-white animate-pulse'
                        : 'bg-emerald-950/70 border-emerald-800 text-emerald-500'
                    }`}
                  >
                    <div className="text-[10px] font-bold">ডে {item.day}</div>
                    <div className="my-1 text-xs font-black text-amber-400 truncate">
                      ৳{item.reward.toLocaleString()}
                    </div>
                    <div className="text-[9px]">
                      {isClaimed ? (
                        <Check className="w-4 h-4 mx-auto text-emerald-400" />
                      ) : isToday ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px]">
                          আজকের
                        </span>
                      ) : (
                        <Lock className="w-3.5 h-3.5 mx-auto text-emerald-700" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleCheckIn}
              disabled={hasCheckedInToday || checkInLoading}
              className="w-full min-h-[48px] py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center space-x-2 cursor-pointer mt-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {hasCheckedInToday
                  ? 'আজকের চেক-ইন সফল (পরবর্তী আনলক রাত ১২:০০)'
                  : checkInLoading
                  ? 'রিওয়ার্ড যোগ হচ্ছে...'
                  : 'আজকের রিওয়ার্ড ক্লেইম করুন'}
              </span>
            </button>
          </div>

          {/* Right Column (6-cols): Lucky Fortune Wheel */}
          <div className="lg:col-span-6 rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-7 space-y-4 font-mono text-xs flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
              <div className="flex items-center space-x-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white uppercase">লাকি ফরচুন হুইল (Spin &amp; Win)</h2>
              </div>
              <span className="text-[10px] text-amber-300 font-bold">CSPRNG Weighted RNG</span>
            </div>

            {/* Wheel Graphic Container */}
            <div className="relative flex items-center justify-center py-3">
              {/* Pointer Marker */}
              <div className="absolute top-0 z-20 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-amber-400 drop-shadow-md" />

              {/* Rotating Wheel Disk */}
              <div
                className="w-52 h-52 sm:w-60 sm:h-60 rounded-full border-4 border-amber-400 shadow-2xl relative overflow-hidden transition-transform duration-[3500ms] ease-out flex items-center justify-center"
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  background: 'conic-gradient(#059669 0deg 45deg, #f59e0b 45deg 90deg, #047857 90deg 135deg, #eab308 135deg 180deg, #10b981 180deg 225deg, #d97706 225deg 270deg, #065f46 270deg 315deg, #fbbf24 315deg 360deg)'
                }}
              >
                {/* Center Cap */}
                <div className="w-14 h-14 rounded-full bg-emerald-950 border-2 border-amber-400 flex items-center justify-center z-10 shadow-xl">
                  <Crown className="w-5 h-5 text-amber-400" />
                </div>
              </div>
            </div>

            {/* Spin Result & Action */}
            <div className="space-y-2">
              {wonPrize && (
                <div className="p-3 bg-amber-400/20 border border-amber-400/40 rounded-xl text-center text-amber-300 font-bold animate-pulse">
                  🎉 আপনি জিতেছেন: {wonPrize.label}!
                </div>
              )}

              <button
                onClick={handleSpinWheel}
                disabled={spinning || spinsRemaining <= 0}
                className="w-full min-h-[48px] py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <RotateCcw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
                <span>{spinning ? 'হুইল ঘুরছে...' : `স্পিন করুন (${spinsRemaining} স্পিন বাকি)`}</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. EMBEDDED MISSIONS VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'MISSIONS' && (
        <DailyMissions
          currentUser={currentUser}
          currentWallet={currentWallet}
          currency={currency}
          onMissionClaimed={onRewardClaimed}
        />
      )}

      {/* ========================================================================= */}
      {/* 6. EMBEDDED TURNOVER MANAGER VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'TURNOVER' && (
        <WageringRequirements
          currentUser={currentUser}
          currentWallet={currentWallet}
          currency={currency}
          onConversionSuccess={onRewardClaimed}
        />
      )}

      {/* ========================================================================= */}
      {/* 7. DETAILED TERMS & CONDITIONS MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedOffer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-emerald-950 border-2 border-amber-400/60 rounded-[28px] max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative overflow-hidden font-sans text-slate-100 max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedOffer(null)}
                className="absolute top-5 right-5 p-2 rounded-full bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="space-y-1.5 border-b border-emerald-800 pb-4">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${selectedOffer.badgeColor}`}>
                  {selectedOffer.badge}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  {selectedOffer.title}
                </h2>
                <p className="text-xs text-emerald-200">
                  অফার কোড: <strong className="text-amber-300 font-mono">{selectedOffer.claimCode}</strong>
                </p>
              </div>

              {/* Offer Summary Table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">সর্বোচ্চ বোনাস</span>
                  <span className="font-bold text-amber-300 mt-0.5 block truncate">{selectedOffer.maxBonus}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">টার্নওভার</span>
                  <span className="font-bold text-emerald-400 mt-0.5 block">{selectedOffer.turnover}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">মিন. ডিপোজিট</span>
                  <span className="font-bold text-white mt-0.5 block">{selectedOffer.minDeposit}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">মেয়াদ</span>
                  <span className="font-bold text-cyan-300 mt-0.5 block">{selectedOffer.validity}</span>
                </div>
              </div>

              {/* Eligible Games Box */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
                <span className="text-[11px] font-bold text-amber-400 block font-mono">প্রযোজ্য গেমস:</span>
                <p className="text-slate-300 font-sans leading-relaxed">{selectedOffer.eligibleGames}</p>
              </div>

              {/* Terms List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white font-mono uppercase">নিয়ম ও শর্তাবলী (Terms &amp; Conditions):</h4>
                <ul className="space-y-1.5 text-xs text-slate-400 list-disc list-inside font-sans leading-relaxed">
                  {selectedOffer.terms.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>

              {/* Modal Bottom Action */}
              <div className="pt-2">
                <button
                  onClick={() => handleClaimOffer(selectedOffer)}
                  className="w-full min-h-[48px] py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>এখনই বোনাস সক্রিয় করুন</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};
