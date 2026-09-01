/**
 * @file AffiliateDashboard.tsx
 * @description Server-Authoritative Multi-Tier MLM Affiliate & Referral Center for Playall 365.
 * Strictly adheres to server authority:
 * 1. Loads real affiliate state from GET /api/affiliate/summary with Firebase Bearer token.
 * 2. Displays ONLY server-authoritative data: referralCode, direct/subordinate counts,
 *    turnover volume, total commission, unclaimed commission, and real commission records.
 * 3. Claims commission via POST /api/affiliate/claim; never mutates balance locally before server response.
 * 4. Zero fake/random/synthetic metrics. Zero localStorage authority.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Share2,
  Users,
  TrendingUp,
  Gift,
  Copy,
  Check,
  Award,
  ShieldCheck,
  Sparkles,
  BarChart3,
  LineChart as LineChartIcon,
  MessageCircle,
  Send,
  Facebook,
  RefreshCw,
  Clock,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { soundEngine } from '../services/soundEngine';
import {
  referralService,
  AffiliateSummaryResponse,
  AffiliateCommissionRecord
} from '../services/referralService';
import { useAuth } from '../contexts/AuthContext';
import { useWalletGame } from '../contexts/WalletGameContext';
import { motion, AnimatePresence } from 'framer-motion';

interface AffiliateDashboardProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onCommissionClaimed: () => void;
}

export const AffiliateDashboard: React.FC<AffiliateDashboardProps> = ({
  currentUser,
  currentWallet,
  currency,
  onCommissionClaimed
}) => {
  const { user } = useAuth();
  const { refreshState } = useWalletGame();

  const [summary, setSummary] = useState<AffiliateSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [timeframe, setTimeframe] = useState<'7D' | '14D' | '30D'>('30D');
  const [chartType, setChartType] = useState<'AREA' | 'BAR'>('AREA');

  // Authoritative data fetcher
  const loadAffiliateSummary = useCallback(async (showSpinner: boolean = false) => {
    if (showSpinner) setLoading(true);
    setError(null);

    try {
      if (!user) {
        setLoading(false);
        return;
      }
      const token = await user.getIdToken();
      const res = await referralService.fetchAffiliateSummary(token);

      if (res.success && res.data) {
        setSummary(res.data);
      } else {
        setError(res.error || 'Failed to load affiliate data from server.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading affiliate summary.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAffiliateSummary(true);
  }, [loadAffiliateSummary]);

  // Subscribe to real-time events
  useEffect(() => {
    const unsubscribe = referralService.subscribe(() => {
      loadAffiliateSummary(false);
    });
    return () => unsubscribe();
  }, [loadAffiliateSummary]);

  // Authoritative values
  const node = summary?.node;
  const referralCode = node?.referralCode || '';
  const totalDirectReferrals = node?.totalDirectReferrals || 0;
  const totalSubordinates = node?.totalSubordinates || 0;
  const totalMembers = totalDirectReferrals + totalSubordinates;

  const totalTurnover = parseFloat(node?.totalTurnoverVolume || '0');
  const totalCommission = parseFloat(node?.totalCommissionEarned || '0');
  const unclaimedAmount = parseFloat(node?.unclaimedCommission || '0');
  const recentCommissions: AffiliateCommissionRecord[] = summary?.recentCommissions || [];

  // Referral link derived strictly from authoritative server referralCode (fail closed if unavailable)
  const dynamicReferralLink = useMemo(() => {
    return referralCode ? referralService.generateReferralLink(referralCode) : '';
  }, [referralCode]);

  const shareLinks = useMemo(() => {
    return (dynamicReferralLink && referralCode)
      ? referralService.getShareLinks(dynamicReferralLink, referralCode)
      : null;
  }, [dynamicReferralLink, referralCode]);

  // Copy handlers
  const handleCopyLink = () => {
    if (!dynamicReferralLink || !referralCode) return;
    navigator.clipboard.writeText(dynamicReferralLink);
    soundEngine.playClick(950);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    soundEngine.playClick(950);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Commission Claim Handler with server-only authority
  const handleClaimCommission = async () => {
    if (!user || unclaimedAmount <= 0 || claiming) return;

    setClaiming(true);
    soundEngine.playClick(900);

    try {
      const token = await user.getIdToken();
      const res = await referralService.claimCommissionOnServer(token);

      if (res.success && res.data) {
        soundEngine.playWinChime();
        const claimedStr = parseFloat(res.data.claimedAmount).toFixed(2);
        setToast({
          message: `সফলভাবে ৳${claimedStr} রেফারেল কমিশন মেইন ওয়ালেটে যুক্ত হয়েছে!`,
          type: 'success'
        });

        // Refresh authoritative summary & local wallet state
        await loadAffiliateSummary(false);
        refreshState();
        onCommissionClaimed();
      } else {
        soundEngine.playClick(300);
        setToast({
          message: res.error || 'কমিশন ক্লেইম সম্পন্ন হয়নি। দয়া করে পুনরায় চেষ্টা করুন।',
          type: 'error'
        });
      }
    } catch (err: any) {
      soundEngine.playClick(300);
      setToast({
        message: err.message || 'নেটওয়ার্ক ত্রুটির কারণে ক্লেইম ব্যর্থ হয়েছে।',
        type: 'error'
      });
    } finally {
      setClaiming(false);
      setTimeout(() => setToast(null), 5000);
    }
  };

  // Build Real Analytics Data from Authoritative Commissions
  const chartData = useMemo(() => {
    const days = timeframe === '7D' ? 7 : timeframe === '14D' ? 14 : 30;
    const result = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Aggregate real settled/claimed commissions for this specific calendar date
      const matched = recentCommissions.filter((c) => {
        const cDate = c.settledAt ? new Date(c.settledAt).toISOString().split('T')[0] : '';
        return cDate === dateKey;
      });

      const dayCommission = matched.reduce((acc, c) => acc + parseFloat(c.commissionAmount || '0'), 0);
      const dayTurnover = matched.reduce((acc, c) => acc + parseFloat(c.validBetAmount || '0'), 0);

      result.push({
        date: dayLabel,
        commission: Number(dayCommission.toFixed(4)),
        turnover: Number(dayTurnover.toFixed(2)),
        entriesCount: matched.length
      });
    }

    return result;
  }, [recentCommissions, timeframe]);

  const symbol = currency === 'BDT' ? '৳' : '$';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-28 font-sans text-slate-100 selection:bg-amber-400 selection:text-slate-950"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl border-2 flex items-center space-x-3 shadow-xl ${
              toast.type === 'success'
                ? 'bg-emerald-950 border-amber-400 text-amber-300'
                : 'bg-red-950 border-red-500 text-red-300'
            }`}
          >
            {toast.type === 'success' ? (
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="font-mono text-xs sm:text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. MASTER BANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Authoritative Referral Link & Share Tools */}
        <div className="lg:col-span-7 rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-950 to-emerald-900 border-2 border-amber-400/50 p-5 sm:p-7 relative overflow-hidden flex flex-col justify-between shadow-xl">
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-amber-400/20 to-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-3.5 relative z-10">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-emerald-950 border border-amber-400/50 text-amber-300 text-xs font-mono font-bold uppercase shadow-sm">
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span>সার্ভার-অথরিটেটিভ এফিলিয়েট প্রোগ্রাম</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              আজীবন ৩-লেভেল এফিলিয়েট কমিশন (Up to 0.80% Turnover)
            </h1>

            <p className="text-xs sm:text-sm text-emerald-200/90 font-sans leading-relaxed">
              আপনার অফিসিয়াল রেফারেল কোড ব্যবহার করে যোগ দেওয়া মেম্বারদের প্রতিটি ভ্যালিড বেট থেকে স্বয়ংক্রিয়ভাবে মাল্টি-টিয়ার কমিশন উপভোগ করুন।
            </p>

            {/* Authoritative Referral Link & Code Box */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-mono text-amber-300 font-bold">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>আপনার অথেনটিকেটেড রেফারেল লিংক:</span>
                </span>
                <span className="text-emerald-300 text-[11px]">
                  কোড: <strong className="text-amber-300">{referralCode || (loading ? 'লোড হচ্ছে...' : 'অনুপলব্ধ')}</strong>
                </span>
              </div>

              <div className="bg-emerald-950/90 border-2 border-emerald-700/80 p-2.5 sm:p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono shadow-lg shadow-emerald-950">
                <div className="flex items-center space-x-2 text-emerald-200 truncate w-full min-w-0">
                  <span className="text-emerald-100 bg-emerald-900/60 px-3 py-2 rounded-xl border border-emerald-700 truncate flex-1 select-all text-xs text-left font-mono font-bold">
                    {dynamicReferralLink || (loading ? 'সার্ভার থেকে লোড হচ্ছে...' : 'রেফারেল লিংক অনুপলব্ধ')}
                  </span>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
                  <button
                    onClick={handleCopyLink}
                    disabled={!referralCode || loading}
                    className="flex-1 sm:flex-none min-h-[38px] px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black flex items-center justify-center space-x-1.5 shadow-md active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-950 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'কপি হয়েছে!' : 'লিংক কপি'}</span>
                  </button>

                  <button
                    onClick={handleCopyCode}
                    disabled={!referralCode || loading}
                    className="min-h-[38px] px-3 py-2 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center justify-center space-x-1 disabled:opacity-50 transition-all cursor-pointer"
                    title="রেফারেল কোড কপি করুন"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Award className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{copiedCode ? 'কোড কপি!' : 'কোড'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Social Share Buttons */}
            <div className="pt-2">
              <div className="text-[11px] text-emerald-300 font-mono mb-2">বন্ধুদের সাথে শেয়ার করুন:</div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                <a
                  href={shareLinks?.whatsapp || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2.5 rounded-xl bg-emerald-800/40 hover:bg-emerald-800/60 border border-emerald-600 text-emerald-200 text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm group ${
                    !shareLinks ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={shareLinks?.telegram || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2.5 rounded-xl bg-emerald-800/40 hover:bg-emerald-800/60 border border-emerald-600 text-emerald-200 text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm group ${
                    !shareLinks ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <Send className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>Telegram</span>
                </a>

                <a
                  href={shareLinks?.facebook || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2.5 rounded-xl bg-emerald-800/40 hover:bg-emerald-800/60 border border-emerald-600 text-emerald-200 text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm group ${
                    !shareLinks ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <Facebook className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
                  <span>Facebook</span>
                </a>

                <button
                  onClick={handleCopyLink}
                  disabled={!referralCode || loading}
                  className="hidden sm:flex p-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 text-xs font-mono font-bold items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Copy className="w-4 h-4 text-amber-400" />
                  <span>অন্যান্য</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 pt-4 mt-3 border-t border-emerald-800/80 text-xs font-mono text-emerald-300 relative z-10">
            <span className="flex items-center space-x-1 text-amber-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>PostgreSQL ACID লেজার সিকিউরড</span>
            </span>
            <span>•</span>
            <span>জিরো ফ্লোট রাউন্ডিং ড্রাফট</span>
          </div>
        </div>

        {/* Right Column: Unclaimed Commission Snapshot */}
        <div className="lg:col-span-5 rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-7 relative overflow-hidden flex flex-col justify-between shadow-xl">
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
              <span className="text-xs text-emerald-300 uppercase font-bold">ক্লেইমেবল কমিশন (Unclaimed)</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
                SERVER AUTHORITATIVE
              </span>
            </div>

            <div className="p-4 bg-emerald-950/90 rounded-2xl border border-emerald-700/60">
              <div className="text-[11px] text-emerald-300">উত্তোলনযোগ্য কমিশন:</div>
              <div className="text-3xl sm:text-4xl font-black text-transparent bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400 bg-clip-text mt-1">
                {currency === 'BDT' ? `৳${unclaimedAmount.toFixed(2)}` : `$${unclaimedAmount.toFixed(2)}`}
              </div>
              <div className="text-[10px] text-emerald-400 mt-1 font-semibold flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>মেইন ওয়ালেটে সরাসরি যুক্ত হবে ০% ফি সহ</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-900/60 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-emerald-300">মোট রেফারেল নেটওয়ার্ক:</span>
                <span className="font-bold text-amber-300">{totalMembers} জন মেম্বার</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px]">
                <span className="text-slate-400">ডাইরেক্ট (Tier 1): {totalDirectReferrals}</span>
                <span className="text-slate-400">সাবঅর্ডিনেট (Tier 2/3): {totalSubordinates}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleClaimCommission}
            disabled={claiming || unclaimedAmount <= 0 || loading}
            className="w-full min-h-[46px] mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs font-mono shadow-lg shadow-emerald-950 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            {claiming ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>সার্ভারে ক্লেইম ভেরিফাই হচ্ছে...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{unclaimedAmount > 0 ? 'কমিশন মেইন ওয়ালেটে নিন' : 'ক্লেইম করার মতো কমিশন নেই'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. 3-TIER COMMISSION RATES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tier 1 */}
        <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 space-y-2 font-mono flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-200 uppercase font-bold">Tier 1 (Direct Referrals)</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black border border-amber-400/30">
              0.50%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{totalDirectReferrals} মেম্বার</div>
            <div className="text-xs text-amber-300 mt-0.5">টার্নওভার রেট: 50 bps (0.0050)</div>
          </div>
          <p className="text-[11px] text-emerald-200/90 font-sans leading-relaxed">
            আপনার সরাসরি রেফারেল লিংকে রেজিস্টার্ড প্লেয়ারদের প্রতিটি ভ্যালিড বেট থেকে ০.৫০% আজীবন অটো কমিশন।
          </p>
        </div>

        {/* Tier 2 */}
        <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 space-y-2 font-mono flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-200 uppercase font-bold">Tier 2 (Grandchild Downline)</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black border border-emerald-500/30">
              0.20%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{totalSubordinates} মেম্বার</div>
            <div className="text-xs text-amber-300 mt-0.5">টার্নওভার রেট: 20 bps (0.0020)</div>
          </div>
          <p className="text-[11px] text-emerald-200/90 font-sans leading-relaxed">
            Tier 1 মেম্বারদের আমন্ত্রিত ২য় স্তরের প্লেয়ারদের টার্নওভার থেকে ০.২০% কমিশন।
          </p>
        </div>

        {/* Tier 3 */}
        <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 space-y-2 font-mono flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-200 uppercase font-bold">Tier 3 (Network Layer)</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30">
              0.10%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">৩য় লেয়ার</div>
            <div className="text-xs text-amber-300 mt-0.5">টার্নওভার রেট: 10 bps (0.0010)</div>
          </div>
          <p className="text-[11px] text-emerald-200/90 font-sans leading-relaxed">
            ৩য় স্তরের সকল সক্রিয় প্লেয়ারদের সম্মিলিত গেমপ্লে টার্নওভার থেকে ০.১০% প্যাসিভ ইনকাম।
          </p>
        </div>
      </div>

      {/* 3. VISUAL PERFORMANCE ANALYTICS */}
      <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-7 space-y-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-emerald-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white font-sans">
                সার্ভার-অথরিটেটিভ পারফরম্যান্স অ্যানালিটিক্স
              </h2>
              <p className="text-xs text-emerald-300 font-mono">
                আসল টার্নওভার ও কমিশন ট্রেন্ডস
              </p>
            </div>
          </div>

          {/* Controls Toolbar */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {/* Timeframe Selector */}
            <div className="flex items-center bg-emerald-950 p-1 rounded-xl border border-emerald-700">
              {(['7D', '14D', '30D'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => {
                    soundEngine.playClick(700);
                    setTimeframe(tf);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    timeframe === tf ? 'bg-amber-400 text-slate-950 font-black' : 'text-emerald-200 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Chart Type Selector */}
            <div className="flex items-center bg-emerald-950 p-1 rounded-xl border border-emerald-700">
              <button
                onClick={() => setChartType('AREA')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'AREA' ? 'bg-amber-400 text-slate-950' : 'text-emerald-200 hover:text-white'
                }`}
                title="Area Chart"
              >
                <LineChartIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('BAR')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'BAR' ? 'bg-amber-400 text-slate-950' : 'text-emerald-200 hover:text-white'
                }`}
                title="Bar Chart"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Snapshot Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-emerald-950/80 p-3 rounded-2xl border border-emerald-700/60">
            <span className="text-[10px] text-emerald-300 uppercase">মোট অর্জিত কমিশন</span>
            <div className="text-base sm:text-lg font-black text-amber-300 mt-0.5 truncate">
              {symbol}{totalCommission.toFixed(2)}
            </div>
          </div>

          <div className="bg-emerald-950/80 p-3 rounded-2xl border border-emerald-700/60">
            <span className="text-[10px] text-emerald-300 uppercase">মোট টার্নওভার ভলিউম</span>
            <div className="text-base sm:text-lg font-black text-white mt-0.5 truncate">
              {symbol}{totalTurnover.toLocaleString()}
            </div>
          </div>

          <div className="bg-emerald-950/80 p-3 rounded-2xl border border-emerald-700/60">
            <span className="text-[10px] text-emerald-300 uppercase">মোট মেম্বার</span>
            <div className="text-base sm:text-lg font-black text-emerald-300 mt-0.5 truncate">
              {totalMembers} জন
            </div>
          </div>

          <div className="bg-emerald-950/80 p-3 rounded-2xl border border-emerald-700/60">
            <span className="text-[10px] text-emerald-300 uppercase">ক্লেইমেবল ব্যালেন্স</span>
            <div className="text-base sm:text-lg font-black text-amber-300 mt-0.5 truncate">
              {symbol}{unclaimedAmount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-64 sm:h-72 w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'AREA' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" />
                <XAxis dataKey="date" stroke="#6ee7b7" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6ee7b7" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#022c22', borderColor: '#059669', borderRadius: '12px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="commission" stroke="#fbbf24" strokeWidth={2} fillOpacity={1} fill="url(#commGrad)" name="কমিশন" />
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" />
                <XAxis dataKey="date" stroke="#6ee7b7" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6ee7b7" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#022c22', borderColor: '#059669', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="commission" fill="#fbbf24" radius={[4, 4, 0, 0]} name="কমিশন" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. REAL RECENT COMMISSIONS LEDGER */}
      <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-7 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2 font-sans">
              <Users className="w-4 h-4 text-amber-400" />
              <span>সাম্প্রতিক কমিশন রেকর্ড ({recentCommissions.length})</span>
            </h2>
            <p className="text-xs text-emerald-300 font-mono mt-0.5">
              পোস্টগ্রেসকিউএল লেজারে সংরক্ষিত প্রকৃত কমিশন লেনদেন তালিকা।
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => loadAffiliateSummary(false)}
              className="text-xs font-mono text-emerald-300 bg-emerald-950 hover:bg-emerald-900 px-3 py-1 rounded-full border border-emerald-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>
          </div>
        </div>

        {recentCommissions.length === 0 ? (
          <div className="py-12 text-center space-y-3 font-mono">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-800 flex items-center justify-center mx-auto text-emerald-500">
              <Clock className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-300 font-sans">
              এখনও কোনো কমিশন রেকর্ড তৈরি হয়নি
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              আপনার রেফারেল কোড <strong className="text-amber-300">{referralCode || 'অনুপলব্ধ'}</strong> শেয়ার করুন। আপনার রেফার করা বন্ধুদের প্রতিটি স্পিন থেকে স্বয়ংক্রিয় কমিশন যোগ হবে।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-emerald-950 text-emerald-300 uppercase text-[10px]">
                <tr>
                  <th className="p-3">ট্রানজেকশন ID</th>
                  <th className="p-3">টিয়ার</th>
                  <th className="p-3">তারিখ ও সময়</th>
                  <th className="p-3">টার্নওভার (Valid Bet)</th>
                  <th className="p-3">কমিশন রেট</th>
                  <th className="p-3">অর্জিত কমিশন</th>
                  <th className="p-3">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-800/80">
                {recentCommissions.map((c) => (
                  <tr key={c.id} className="hover:bg-emerald-900/40 transition-colors">
                    <td className="p-3 text-emerald-200 font-bold truncate max-w-[180px]">
                      {c.sourceTransactionId}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-amber-300 border border-amber-400/30 text-[10px] font-bold">
                        Tier {c.tier}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {c.settledAt ? new Date(c.settledAt).toLocaleString() : 'N/A'}
                    </td>
                    <td className="p-3 text-slate-200">
                      {symbol}{parseFloat(c.validBetAmount || '0').toLocaleString()}
                    </td>
                    <td className="p-3 text-emerald-300">
                      {c.commissionRate === '0.0050' ? '0.50%' : c.commissionRate === '0.0020' ? '0.20%' : `${(parseFloat(c.commissionRate) * 100).toFixed(2)}%`}
                    </td>
                    <td className="p-3 text-amber-400 font-black">
                      +{symbol}{parseFloat(c.commissionAmount || '0').toFixed(4)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'SETTLED'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : c.status === 'CLAIMED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};
