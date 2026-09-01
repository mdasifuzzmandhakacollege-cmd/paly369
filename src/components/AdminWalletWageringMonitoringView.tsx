/**
 * @file AdminWalletWageringMonitoringView.tsx
 * @description PLAY369 Task A3: Authoritative Admin Wallet & Wagering Monitoring View (Read-Only).
 * 
 * CORE CONTRACT & ARCHITECTURAL INVARIANTS:
 * 1. Read-Only Monitoring: Strictly zero financial mutation buttons (no wallet adjustments, balance credits/debits, bonus releases, or wagering overrides).
 * 2. Authoritative PostgreSQL Data Source: Consumes `/api/admin/wallets` and `/api/admin/wagering` backed by PostgreSQL. Zero Firestore financial reads.
 * 3. Exact Scale-4 Monetary Precision: Preserves exact decimal strings (e.g. "1500.0000") without floating point rounding drift.
 * 4. Zero Secrets Exposure: Masked emails and identifiers, no API keys, HMAC secrets, or private tokens in UI.
 * 5. Mobile-First Emerald Green & Gold Styling: Minimum 48px touch targets, safe-area padding, responsive cards and table layouts.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Database,
  Eye,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  Wallet,
  Sparkles,
  Target,
  Percent,
  Calendar,
  User,
  Hash,
  AlertOctagon,
  ArrowRight,
  Coins,
  DollarSign,
  TrendingUp,
  Layers,
  Award
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { soundEngine } from '../services/soundEngine';

// Types for Authoritative Wallet
export interface AuthoritativeWalletRecord {
  id: number;
  userId: number;
  username: string;
  email: string | null;
  emailMasked: string | null;
  userStatus: string;
  currency: string;
  realBalance: string;
  bonusBalance: string;
  lockedBalance: string;
  commissionBalance: string;
  totalBalance: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletSummaryData {
  totalWallets: number;
  totalRealBalance: string;
  totalBonusBalance: string;
  totalLockedBalance: string;
  totalCommissionBalance: string;
  totalSystemBalance: string;
}

// Types for Authoritative Wagering
export interface AuthoritativeWageringRecord {
  id: number;
  userId: number;
  username: string;
  userEmail: string | null;
  emailMasked: string | null;
  promoName: string;
  bonusAmountGranted: string;
  requiredMultiplier: number;
  targetTurnoverAmount: string;
  completedTurnoverAmount: string;
  remainingTurnoverAmount: string;
  progressPercent: number;
  status: string;
  isReleased: boolean;
  isWithdrawalBlocked: boolean;
  releasedAt: string | null;
  releaseTransactionId: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WageringSummaryData {
  totalRequirements: number;
  activeCount: number;
  completedCount: number;
  expiredCount: number;
  blockedPlayersCount: number;
  totalBonusGranted: string;
  totalTargetTurnover: string;
  totalCompletedTurnover: string;
  totalRemainingTurnover: string;
}

export interface AdminWalletWageringMonitoringViewProps {
  onClose?: () => void;
}

export const AdminWalletWageringMonitoringView: React.FC<AdminWalletWageringMonitoringViewProps> = ({ onClose }) => {
  const { user: authUser } = useAuth();

  // Active View Tab: 'wallets' or 'wagering'
  const [activeTab, setActiveTab] = useState<'wallets' | 'wagering'>('wallets');

  // Wallets State
  const [wallets, setWallets] = useState<AuthoritativeWalletRecord[]>([]);
  const [walletSummary, setWalletSummary] = useState<WalletSummaryData>({
    totalWallets: 0,
    totalRealBalance: '0.0000',
    totalBonusBalance: '0.0000',
    totalLockedBalance: '0.0000',
    totalCommissionBalance: '0.0000',
    totalSystemBalance: '0.0000',
  });
  const [walletCurrencyFilter, setWalletCurrencyFilter] = useState<'ALL' | 'BDT' | 'USD'>('ALL');
  const [walletStatusFilter, setWalletStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED' | 'SUSPENDED'>('ALL');
  const [walletSearchQuery, setWalletSearchQuery] = useState('');
  const [walletPage, setWalletPage] = useState(1);
  const [walletLimit, setWalletLimit] = useState(20);
  const [walletTotalPages, setWalletTotalPages] = useState(1);
  const [walletTotalCount, setWalletTotalCount] = useState(0);

  // Wagering State
  const [wagering, setWagering] = useState<AuthoritativeWageringRecord[]>([]);
  const [wageringSummary, setWageringSummary] = useState<WageringSummaryData>({
    totalRequirements: 0,
    activeCount: 0,
    completedCount: 0,
    expiredCount: 0,
    blockedPlayersCount: 0,
    totalBonusGranted: '0.0000',
    totalTargetTurnover: '0.0000',
    totalCompletedTurnover: '0.0000',
    totalRemainingTurnover: '0.0000',
  });
  const [wageringStatusFilter, setWageringStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED'>('ALL');
  const [wageringReleasedFilter, setWageringReleasedFilter] = useState<'ALL' | 'RELEASED' | 'UNRELEASED'>('ALL');
  const [wageringSearchQuery, setWageringSearchQuery] = useState('');
  const [wageringPage, setWageringPage] = useState(1);
  const [wageringLimit, setWageringLimit] = useState(20);
  const [wageringTotalPages, setWageringTotalPages] = useState(1);
  const [wageringTotalCount, setWageringTotalCount] = useState(0);

  // Shared UI State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<AuthoritativeWalletRecord | null>(null);
  const [selectedWagering, setSelectedWagering] = useState<AuthoritativeWageringRecord | null>(null);
  const [sourceTag, setSourceTag] = useState<string>('POSTGRESQL_AUTHORITATIVE');

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    soundEngine.playClick();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --------------------------------------------------------------------------
  // Fetch Wallets
  // --------------------------------------------------------------------------
  const fetchWallets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await authUser?.getIdToken();
      const params = new URLSearchParams();
      params.append('page', String(walletPage));
      params.append('limit', String(walletLimit));
      if (walletCurrencyFilter !== 'ALL') params.append('currency', walletCurrencyFilter);
      if (walletStatusFilter !== 'ALL') params.append('status', walletStatusFilter);
      if (walletSearchQuery.trim()) params.append('search', walletSearchQuery.trim());

      const res = await fetch(`/api/admin/wallets?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to fetch wallets`);
      }

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setWallets(json.data);
        if (json.summary) setWalletSummary(json.summary);
        if (json.pagination) {
          setWalletTotalPages(json.pagination.totalPages || 1);
          setWalletTotalCount(json.pagination.total || 0);
        }
        if (json.source) setSourceTag(json.source);
      } else {
        throw new Error(json.error || 'Invalid wallets response format');
      }
    } catch (err: any) {
      console.error('[AdminWalletWageringMonitoringView.fetchWallets error]:', err);
      setError(err.message || 'PostgreSQL authoritative wallets read error');
    } finally {
      setLoading(false);
    }
  }, [authUser, walletPage, walletLimit, walletCurrencyFilter, walletStatusFilter, walletSearchQuery]);

  // --------------------------------------------------------------------------
  // Fetch Wagering
  // --------------------------------------------------------------------------
  const fetchWagering = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await authUser?.getIdToken();
      const params = new URLSearchParams();
      params.append('page', String(wageringPage));
      params.append('limit', String(wageringLimit));
      if (wageringStatusFilter !== 'ALL') params.append('status', wageringStatusFilter);
      if (wageringReleasedFilter === 'RELEASED') params.append('released', 'true');
      if (wageringReleasedFilter === 'UNRELEASED') params.append('released', 'false');
      if (wageringSearchQuery.trim()) params.append('search', wageringSearchQuery.trim());

      const res = await fetch(`/api/admin/wagering?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to fetch wagering requirements`);
      }

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setWagering(json.data);
        if (json.summary) setWageringSummary(json.summary);
        if (json.pagination) {
          setWageringTotalPages(json.pagination.totalPages || 1);
          setWageringTotalCount(json.pagination.total || 0);
        }
        if (json.source) setSourceTag(json.source);
      } else {
        throw new Error(json.error || 'Invalid wagering response format');
      }
    } catch (err: any) {
      console.error('[AdminWalletWageringMonitoringView.fetchWagering error]:', err);
      setError(err.message || 'PostgreSQL authoritative wagering read error');
    } finally {
      setLoading(false);
    }
  }, [authUser, wageringPage, wageringLimit, wageringStatusFilter, wageringReleasedFilter, wageringSearchQuery]);

  // Trigger data fetch on tab/filter changes
  useEffect(() => {
    if (activeTab === 'wallets') {
      fetchWallets();
    } else {
      fetchWagering();
    }
  }, [activeTab, fetchWallets, fetchWagering]);

  // Debounced search handlers
  const handleWalletSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWalletSearchQuery(e.target.value);
    setWalletPage(1);
  };

  const handleWageringSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWageringSearchQuery(e.target.value);
    setWageringPage(1);
  };

  return (
    <div id="admin-wallet-wagering-monitoring-view" className="space-y-6 animate-in fade-in duration-300 pb-16">
      
      {/* 1. TOP HEADER & AUTHORITATIVE SOURCE BADGE */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner flex-shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  ওয়ালেট ও ওয়েজারিং মনিটরিং (Authoritative Ops)
                </h2>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black tracking-wider uppercase">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>{sourceTag}</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                  <Lock className="w-3 h-3" />
                  <span>READ-ONLY AUDIT</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                PostgreSQL অরিজিনাল ব্যালেন্স, লকড ফান্ড, টার্নওভার প্রোগ্রেস ও উইথড্র ব্লকেড রিয়েলটাইম মনিটর
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end md:self-auto">
            <button
              id="refresh-wallet-wagering-btn"
              onClick={() => {
                soundEngine.playClick();
                if (activeTab === 'wallets') fetchWallets();
                else fetchWagering();
              }}
              disabled={loading}
              className="min-h-[48px] px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50 shadow-md"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">রিফ্রেশ ডেটা</span>
            </button>
            {onClose && (
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onClose();
                }}
                className="min-h-[48px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. TAB SWITCHER (WALLETS vs WAGERING) */}
      <div className="flex items-center space-x-3 bg-slate-950 p-2 rounded-2xl border border-slate-800 font-mono text-xs sm:text-sm">
        <button
          id="tab-wallets-btn"
          onClick={() => {
            soundEngine.playClick();
            setActiveTab('wallets');
          }}
          className={`min-h-[48px] flex-1 py-3 px-4 rounded-xl font-black transition-all flex items-center justify-center space-x-2.5 cursor-pointer ${
            activeTab === 'wallets'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>প্লেয়ার ওয়ালেট ব্যালেন্স ({walletSummary.totalWallets})</span>
        </button>

        <button
          id="tab-wagering-btn"
          onClick={() => {
            soundEngine.playClick();
            setActiveTab('wagering');
          }}
          className={`min-h-[48px] flex-1 py-3 px-4 rounded-xl font-black transition-all flex items-center justify-center space-x-2.5 cursor-pointer ${
            activeTab === 'wagering'
              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>ওয়েজারিং ও টার্নওভার গেট ({wageringSummary.totalRequirements})</span>
        </button>
      </div>

      {/* 3. ERROR BANNER (FAIL CLOSED) */}
      {error && (
        <div className="bg-rose-950/60 border border-rose-500/40 rounded-2xl p-4 flex items-start space-x-3 text-rose-200 animate-in fade-in">
          <AlertOctagon className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-300">PostgreSQL ডেটাবেস এরর (Fail-Closed Active)</h4>
            <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'wallets') fetchWallets();
              else fetchWagering();
            }}
            className="min-h-[44px] px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold rounded-lg border border-rose-500/30 transition-all cursor-pointer flex-shrink-0"
          >
            পুনরায় চেষ্টা
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. WALLET MONITORING VIEW                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'wallets' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Total Wallets */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                <span>মোট ওয়ালেট</span>
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                {walletSummary.totalWallets.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Active Database Accounts</div>
            </div>

            {/* Total Real Balance */}
            <div className="bg-slate-900/80 border border-emerald-500/30 p-4 rounded-2xl bg-gradient-to-b from-emerald-950/20 to-transparent">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-medium mb-1">
                <span>রিয়েল ব্যালেন্স (REAL)</span>
                <Coins className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">
                ৳{walletSummary.totalRealBalance}
              </div>
              <div className="text-[10px] text-emerald-400/70 mt-1">Scale-4 Authoritative Cash</div>
            </div>

            {/* Total Bonus Balance */}
            <div className="bg-slate-900/80 border border-amber-500/30 p-4 rounded-2xl bg-gradient-to-b from-amber-950/20 to-transparent">
              <div className="flex items-center justify-between text-amber-400 text-xs font-medium mb-1">
                <span>বোনাস ব্যালেন্স (BONUS)</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
                ৳{walletSummary.totalBonusBalance}
              </div>
              <div className="text-[10px] text-amber-400/70 mt-1">Pending Wagering Unlock</div>
            </div>

            {/* Total Locked Balance */}
            <div className="bg-slate-900/80 border border-rose-500/30 p-4 rounded-2xl bg-gradient-to-b from-rose-950/20 to-transparent">
              <div className="flex items-center justify-between text-rose-400 text-xs font-medium mb-1">
                <span>লকড ব্যালেন্স (LOCKED)</span>
                <Lock className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-300 font-mono">
                ৳{walletSummary.totalLockedBalance}
              </div>
              <div className="text-[10px] text-rose-400/70 mt-1">Reserved For Payouts</div>
            </div>

            {/* Combined System Total */}
            <div className="col-span-2 lg:col-span-1 bg-slate-900/80 border border-teal-500/30 p-4 rounded-2xl bg-gradient-to-b from-teal-950/20 to-transparent">
              <div className="flex items-center justify-between text-teal-400 text-xs font-medium mb-1">
                <span>সিস্টেম লাইবিলিটি (TOTAL)</span>
                <TrendingUp className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-teal-300 font-mono">
                ৳{walletSummary.totalSystemBalance}
              </div>
              <div className="text-[10px] text-teal-400/70 mt-1">Sum of All Player Funds</div>
            </div>
          </div>

          {/* Filtering Controls */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              
              {/* Search input */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="wallet-search-input"
                  type="text"
                  placeholder="ইউজার আইডি, ইউজারনেম বা ইমেইল দিয়ে সার্চ করুন..."
                  value={walletSearchQuery}
                  onChange={handleWalletSearchChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-h-[48px]"
                />
                {walletSearchQuery && (
                  <button
                    onClick={() => {
                      setWalletSearchQuery('');
                      setWalletPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Currency Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">কারেন্সি:</span>
                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['ALL', 'BDT', 'USD'] as const).map((curr) => (
                    <button
                      key={curr}
                      onClick={() => {
                        soundEngine.playClick();
                        setWalletCurrencyFilter(curr);
                        setWalletPage(1);
                      }}
                      className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        walletCurrencyFilter === curr
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">স্ট্যাটাস:</span>
                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['ALL', 'ACTIVE', 'LOCKED', 'SUSPENDED'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        soundEngine.playClick();
                        setWalletStatusFilter(st);
                        setWalletPage(1);
                      }}
                      className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        walletStatusFilter === st
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Wallets Table & Mobile Cards */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-xs text-slate-400">PostgreSQL ডেটাবেস থেকে ওয়ালেট ব্যালেন্স লোড হচ্ছে...</p>
              </div>
            ) : wallets.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-400" />
                <p className="text-sm font-bold text-slate-400">কোন ওয়ালেট রেকর্ড পাওয়া যায়নি</p>
                <p className="text-xs text-slate-600 mt-1">ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন</p>
              </div>
            ) : (
              <div>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3.5 px-4">ওয়ালেট / ইউজার আইডি</th>
                        <th className="py-3.5 px-4">ইউজারনেম ও ইমেইল</th>
                        <th className="py-3.5 px-4">কারেন্সি</th>
                        <th className="py-3.5 px-4 text-right">রিয়েল ব্যালেন্স (REAL)</th>
                        <th className="py-3.5 px-4 text-right">বোনাস (BONUS)</th>
                        <th className="py-3.5 px-4 text-right">লকড (LOCKED)</th>
                        <th className="py-3.5 px-4 text-right">মোট ব্যালেন্স</th>
                        <th className="py-3.5 px-4 text-center">স্ট্যাটাস</th>
                        <th className="py-3.5 px-4">আপডেট টাইম</th>
                        <th className="py-3.5 px-4 text-center">ইন্সপেক্ট</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {wallets.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white">
                            <div className="flex items-center space-x-1.5">
                              <span>W#{w.id}</span>
                              <span className="text-[10px] text-slate-500 font-normal">(U#{w.userId})</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-sans font-bold text-slate-200">{w.username}</div>
                            <div className="text-[10px] text-slate-400">{w.emailMasked || 'No Email'}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold text-[10px]">
                              {w.currency}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-emerald-400">
                            ৳{w.realBalance}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-amber-300">
                            ৳{w.bonusBalance}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-rose-400">
                            ৳{w.lockedBalance}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-teal-300">
                            ৳{w.totalBalance}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              w.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : w.status === 'LOCKED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}>
                              {w.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-[10px]">
                            {new Date(w.updatedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => {
                                soundEngine.playClick();
                                setSelectedWallet(w);
                              }}
                              className="min-h-[44px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer inline-flex items-center space-x-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ভিউ</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-800">
                  {wallets.map((w) => (
                    <div key={w.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-sm">{w.username}</div>
                          <div className="text-xs text-slate-400 font-mono">W#{w.id} • User #{w.userId} • {w.currency}</div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          w.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {w.status}
                        </span>
                      </div>

                      {/* Balances Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 font-mono text-center">
                        <div>
                          <div className="text-[10px] text-slate-400">REAL</div>
                          <div className="text-xs font-black text-emerald-400 mt-0.5">৳{w.realBalance}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">BONUS</div>
                          <div className="text-xs font-bold text-amber-300 mt-0.5">৳{w.bonusBalance}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">LOCKED</div>
                          <div className="text-xs font-bold text-rose-400 mt-0.5">৳{w.lockedBalance}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[10px] text-slate-500 font-mono">
                          আপডেট: {new Date(w.updatedAt).toLocaleTimeString()}
                        </div>
                        <button
                          onClick={() => {
                            soundEngine.playClick();
                            setSelectedWallet(w);
                          }}
                          className="min-h-[48px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-xl border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>ডিটেইলস ইন্সপেক্ট</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-mono">
              <div>
                দেখাচ্ছে {wallets.length} টি ওয়ালেট (মোট {walletTotalCount} টি রেকর্ডের মধ্যে) • পেজ {walletPage} / {walletTotalPages}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  id="wallet-prev-page-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setWalletPage((p) => Math.max(1, p - 1));
                  }}
                  disabled={walletPage <= 1 || loading}
                  className="min-h-[48px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 rounded-xl border border-slate-700 flex items-center space-x-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>আগের পেজ</span>
                </button>

                <button
                  id="wallet-next-page-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setWalletPage((p) => Math.min(walletTotalPages, p + 1));
                  }}
                  disabled={walletPage >= walletTotalPages || loading}
                  className="min-h-[48px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 rounded-xl border border-slate-700 flex items-center space-x-1 cursor-pointer"
                >
                  <span>পরের পেজ</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. WAGERING REQUIREMENTS MONITORING VIEW                                  */}
      {/* ========================================================================= */}
      {activeTab === 'wagering' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Total Requirements */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                <span>মোট রিকোয়ারমেন্ট</span>
                <Target className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                {wageringSummary.totalRequirements.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">All Promotional Grants</div>
            </div>

            {/* Active (Unreleased) */}
            <div className="bg-slate-900/80 border border-amber-500/30 p-4 rounded-2xl bg-gradient-to-b from-amber-950/20 to-transparent">
              <div className="flex items-center justify-between text-amber-400 text-xs font-medium mb-1">
                <span>চলমান (ACTIVE)</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-300">
                {wageringSummary.activeCount}
              </div>
              <div className="text-[10px] text-amber-400/70 mt-1">Incomplete Turnover</div>
            </div>

            {/* Blocked Players for Withdrawal */}
            <div className="bg-slate-900/80 border border-rose-500/30 p-4 rounded-2xl bg-gradient-to-b from-rose-950/20 to-transparent">
              <div className="flex items-center justify-between text-rose-400 text-xs font-medium mb-1">
                <span>উইথড্র ব্লকড ইউজার</span>
                <Lock className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-300">
                {wageringSummary.blockedPlayersCount}
              </div>
              <div className="text-[10px] text-rose-400/70 mt-1">Gate Gated Withdrawals</div>
            </div>

            {/* Total Target Turnover */}
            <div className="bg-slate-900/80 border border-teal-500/30 p-4 rounded-2xl bg-gradient-to-b from-teal-950/20 to-transparent">
              <div className="flex items-center justify-between text-teal-400 text-xs font-medium mb-1">
                <span>টার্গেট টার্নওভার</span>
                <TrendingUp className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-teal-300 font-mono">
                ৳{wageringSummary.totalTargetTurnover}
              </div>
              <div className="text-[10px] text-teal-400/70 mt-1">Required Turnover Sum</div>
            </div>

            {/* Total Remaining Turnover */}
            <div className="col-span-2 lg:col-span-1 bg-slate-900/80 border border-emerald-500/30 p-4 rounded-2xl bg-gradient-to-b from-emerald-950/20 to-transparent">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-medium mb-1">
                <span>অবশিষ্ট টার্নওভার (REMAINING)</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">
                ৳{wageringSummary.totalRemainingTurnover}
              </div>
              <div className="text-[10px] text-emerald-400/70 mt-1">Scale-4 Exact Calculation</div>
            </div>
          </div>

          {/* Filtering Controls */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              
              {/* Search input */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="wagering-search-input"
                  type="text"
                  placeholder="প্রমো নাম, ইউজার আইডি, ইউজারনেম দিয়ে সার্চ করুন..."
                  value={wageringSearchQuery}
                  onChange={handleWageringSearchChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 min-h-[48px]"
                />
                {wageringSearchQuery && (
                  <button
                    onClick={() => {
                      setWageringSearchQuery('');
                      setWageringPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">স্ট্যাটাস:</span>
                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['ALL', 'ACTIVE', 'COMPLETED', 'EXPIRED'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        soundEngine.playClick();
                        setWageringStatusFilter(st);
                        setWageringPage(1);
                      }}
                      className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        wageringStatusFilter === st
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Released Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">রিলিজ:</span>
                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['ALL', 'RELEASED', 'UNRELEASED'] as const).map((rel) => (
                    <button
                      key={rel}
                      onClick={() => {
                        soundEngine.playClick();
                        setWageringReleasedFilter(rel);
                        setWageringPage(1);
                      }}
                      className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        wageringReleasedFilter === rel
                          ? 'bg-emerald-400 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {rel}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Wagering Table & Mobile Cards */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                <p className="text-xs text-slate-400">PostgreSQL ডেটাবেস থেকে ওয়েজারিং রেকর্ড লোড হচ্ছে...</p>
              </div>
            ) : wagering.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
                <p className="text-sm font-bold text-slate-400">কোন ওয়েজারিং রেকর্ড পাওয়া যায়নি</p>
                <p className="text-xs text-slate-600 mt-1">ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন</p>
              </div>
            ) : (
              <div>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3.5 px-4">রিকোয়ারমেন্ট ID</th>
                        <th className="py-3.5 px-4">ইউজার ও প্রমোশন</th>
                        <th className="py-3.5 px-4 text-right">বোনাস গ্র্যান্ট</th>
                        <th className="py-3.5 px-4 text-right">টার্গেট টার্নওভার</th>
                        <th className="py-3.5 px-4 text-right">সম্পন্ন টার্নওভার</th>
                        <th className="py-3.5 px-4 text-right">অবশিষ্ট (Scale-4)</th>
                        <th className="py-3.5 px-4 text-center">প্রোগ্রেস</th>
                        <th className="py-3.5 px-4 text-center">উইথড্র গেট</th>
                        <th className="py-3.5 px-4 text-center">স্ট্যাটাস</th>
                        <th className="py-3.5 px-4 text-center">ইন্সপেক্ট</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {wagering.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white">
                            <span>WR#{r.id}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-sans font-bold text-slate-200">{r.username} (U#{r.userId})</div>
                            <div className="text-[10px] text-amber-400/80 font-bold">{r.promoName}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-amber-300">
                            ৳{r.bonusAmountGranted}
                            <div className="text-[9px] text-slate-500 font-normal">({r.requiredMultiplier}x Rollover)</div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-teal-400">
                            ৳{r.targetTurnoverAmount}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                            ৳{r.completedTurnoverAmount}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-rose-400">
                            ৳{r.remainingTurnoverAmount}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="w-24 mx-auto space-y-1">
                              <div className="flex justify-between text-[9px] text-slate-400">
                                <span>{r.progressPercent}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    r.progressPercent >= 100
                                      ? 'bg-emerald-400'
                                      : 'bg-gradient-to-r from-amber-500 to-emerald-400'
                                  }`}
                                  style={{ width: `${Math.min(100, r.progressPercent)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {r.isWithdrawalBlocked ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-black">
                                <Lock className="w-3 h-3" />
                                <span>BLOCKED</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>CLEAR</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              r.status === 'ACTIVE'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : r.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => {
                                soundEngine.playClick();
                                setSelectedWagering(r);
                              }}
                              className="min-h-[44px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer inline-flex items-center space-x-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ভিউ</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-800">
                  {wagering.map((r) => (
                    <div key={r.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-sm">{r.promoName}</div>
                          <div className="text-xs text-slate-400 font-mono">WR#{r.id} • {r.username} (U#{r.userId})</div>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          {r.isWithdrawalBlocked && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-black">
                              BLOCKED
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            r.status === 'ACTIVE'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {r.status}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-400">টার্নওভার অগ্রগতি ({r.progressPercent}%)</span>
                          <span className="text-amber-300 font-bold">৳{r.completedTurnoverAmount} / ৳{r.targetTurnoverAmount}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              r.progressPercent >= 100
                                ? 'bg-emerald-400'
                                : 'bg-gradient-to-r from-amber-400 to-emerald-400'
                            }`}
                            style={{ width: `${Math.min(100, r.progressPercent)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1">
                          <span>বোনাস: ৳{r.bonusAmountGranted} ({r.requiredMultiplier}x)</span>
                          <span className="text-rose-400 font-bold">অবশিষ্ট: ৳{r.remainingTurnoverAmount}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[10px] text-slate-500 font-mono">
                          {r.expiresAt ? `মেয়াদ: ${new Date(r.expiresAt).toLocaleDateString()}` : 'কোন মেয়াদ নেই'}
                        </div>
                        <button
                          onClick={() => {
                            soundEngine.playClick();
                            setSelectedWagering(r);
                          }}
                          className="min-h-[48px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-xl border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>ডিটেইলস ইন্সপেক্ট</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-mono">
              <div>
                দেখাচ্ছে {wagering.length} টি রেকর্ড (মোট {wageringTotalCount} টির মধ্যে) • পেজ {wageringPage} / {wageringTotalPages}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  id="wagering-prev-page-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setWageringPage((p) => Math.max(1, p - 1));
                  }}
                  disabled={wageringPage <= 1 || loading}
                  className="min-h-[48px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 rounded-xl border border-slate-700 flex items-center space-x-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>আগের পেজ</span>
                </button>

                <button
                  id="wagering-next-page-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setWageringPage((p) => Math.min(wageringTotalPages, p + 1));
                  }}
                  disabled={wageringPage >= wageringTotalPages || loading}
                  className="min-h-[48px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 rounded-xl border border-slate-700 flex items-center space-x-1 cursor-pointer"
                >
                  <span>পরের পেজ</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. WALLET DETAIL INSPECTION MODAL (READ-ONLY)                              */}
      {/* ========================================================================= */}
      {selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0">
            {/* Modal Header */}
            <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">ওয়ালেট রেকর্ড ইন্সপেকশন (W#{selectedWallet.id})</h3>
                  <p className="text-xs text-slate-400 font-mono">User #{selectedWallet.userId} • {selectedWallet.username}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedWallet(null)}
                className="min-h-[44px] min-w-[44px] p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto font-mono text-xs">
              {/* Authoritative Badge */}
              <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xl flex items-center justify-between">
                <span className="text-emerald-300 font-bold flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Authoritative PostgreSQL Source</span>
                </span>
                <span className="text-emerald-400 font-black">STRICT READ-ONLY</span>
              </div>

              {/* Balances Breakdown */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400">REAL BALANCE (ক্যাশ)</div>
                  <div className="text-base font-black text-emerald-400 mt-1">৳{selectedWallet.realBalance}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">BONUS BALANCE (বোনাস)</div>
                  <div className="text-base font-black text-amber-300 mt-1">৳{selectedWallet.bonusBalance}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">LOCKED BALANCE (লকড ফান্ড)</div>
                  <div className="text-base font-black text-rose-400 mt-1">৳{selectedWallet.lockedBalance}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">COMMISSION (অ্যাফিলিয়েট)</div>
                  <div className="text-base font-black text-teal-300 mt-1">৳{selectedWallet.commissionBalance}</div>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300 font-bold">মোট ব্যালেন্স (COMBINED):</span>
                  <span className="text-lg font-black text-white">৳{selectedWallet.totalBalance} {selectedWallet.currency}</span>
                </div>
              </div>

              {/* Detailed Specs */}
              <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">ইমেইল (Masked):</span>
                  <span className="text-slate-200">{selectedWallet.emailMasked || 'Not Provided'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">ওয়ালেট ভার্সন (OCC Version):</span>
                  <span className="text-slate-200">v{selectedWallet.version}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">ওয়ালেট স্ট্যাটাস:</span>
                  <span className="text-emerald-400 font-bold uppercase">{selectedWallet.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">তৈরির তারিখ:</span>
                  <span className="text-slate-300">{new Date(selectedWallet.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">সর্বশেষ আপডেট:</span>
                  <span className="text-slate-300">{new Date(selectedWallet.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedWallet(null)}
                className="min-h-[48px] px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. WAGERING DETAIL INSPECTION MODAL (READ-ONLY)                           */}
      {/* ========================================================================= */}
      {selectedWagering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0">
            {/* Modal Header */}
            <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">ওয়েজারিং রিকোয়ারমেন্ট ইন্সপেকশন (WR#{selectedWagering.id})</h3>
                  <p className="text-xs text-slate-400 font-mono">User #{selectedWagering.userId} • {selectedWagering.username}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedWagering(null)}
                className="min-h-[44px] min-w-[44px] p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto font-mono text-xs">
              {/* Withdrawal Gate Status Alert */}
              {selectedWagering.isWithdrawalBlocked ? (
                <div className="bg-rose-950/40 border border-rose-500/40 p-3.5 rounded-xl flex items-center space-x-3 text-rose-200">
                  <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-rose-300">উইথড্রয়াল সক্রিয়ভাবে ব্লকড (Gate Active)</div>
                    <div className="text-[10px] text-rose-300/80">
                      এই ইউজারের টার্নওভার সম্পন্ন না হওয়া পর্যন্ত সকল ক্যাশআউট উইথড্রয়াল আটকে রাখা হয়েছে।
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-950/40 border border-emerald-500/40 p-3.5 rounded-xl flex items-center space-x-3 text-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-emerald-300">উইথড্রয়াল গেট ক্লিয়ার (Unrestricted)</div>
                    <div className="text-[10px] text-emerald-300/80">
                      ওয়েজারিং রিকোয়ারমেন্ট রিলিজ বা সম্পন্ন হয়েছে, উইথড্রয়ালের কোনো বাধা নেই।
                    </div>
                  </div>
                </div>
              )}

              {/* Progress & Numbers Grid */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-sm font-bold text-white">
                  <span>{selectedWagering.promoName}</span>
                  <span className="text-amber-400">{selectedWagering.requiredMultiplier}x Rollover</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <div className="text-[10px] text-slate-400">বোনাস গ্র্যান্ট</div>
                    <div className="text-sm font-black text-amber-300 mt-0.5">৳{selectedWagering.bonusAmountGranted}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">টার্গেট টার্নওভার</div>
                    <div className="text-sm font-black text-teal-300 mt-0.5">৳{selectedWagering.targetTurnoverAmount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">সম্পন্ন টার্নওভার</div>
                    <div className="text-sm font-black text-emerald-400 mt-0.5">৳{selectedWagering.completedTurnoverAmount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">অবশিষ্ট টার্নওভার (Scale-4)</div>
                    <div className="text-sm font-black text-rose-400 mt-0.5">৳{selectedWagering.remainingTurnoverAmount}</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 pt-2 border-t border-slate-800">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>অগ্রগতি শতাংশ</span>
                    <span className="text-white font-bold">{selectedWagering.progressPercent}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        selectedWagering.progressPercent >= 100
                          ? 'bg-emerald-400'
                          : 'bg-gradient-to-r from-amber-400 to-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, selectedWagering.progressPercent)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">স্ট্যাটাস:</span>
                  <span className="text-amber-400 font-bold uppercase">{selectedWagering.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">রিলিজ ফ্ল্যাগ:</span>
                  <span className={selectedWagering.isReleased ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                    {selectedWagering.isReleased ? 'RELEASED (উন্মুক্ত)' : 'UNRELEASED (লকড)'}
                  </span>
                </div>
                {selectedWagering.releaseTransactionId && (
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">রিলিজ ট্রানজেকশন ID:</span>
                    <span className="text-slate-200">{selectedWagering.releaseTransactionId}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">মেয়াদোত্তীর্ণের তারিখ:</span>
                  <span className="text-slate-300">
                    {selectedWagering.expiresAt ? new Date(selectedWagering.expiresAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">গ্র্যান্টের তারিখ:</span>
                  <span className="text-slate-300">{new Date(selectedWagering.createdAt).toLocaleString()}</span>
                </div>
                {selectedWagering.completedAt && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">সম্পন্নের তারিখ:</span>
                    <span className="text-emerald-400">{new Date(selectedWagering.completedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedWagering(null)}
                className="min-h-[48px] px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
