/**
 * @file AdminPaymentOperationsView.tsx
 * @description PLAY369 Task A2: Authoritative Deposit / Withdrawal Operations View (Read-Only).
 * 
 * CORE CONTRACT & ARCHITECTURAL INVARIANTS:
 * 1. Read-Only Operations: Strictly zero financial mutation buttons (no approval, rejection, or balance changes).
 * 2. Authoritative PostgreSQL Data Source: Consumes `/api/admin/payments` backed by PostgreSQL. Zero Firestore reads.
 * 3. Exact Scale-4 Monetary Representation: Preserves strings like "500.0000" without floating point drift.
 * 4. Zero Secrets Exposure: Masked identifiers, no API keys or HMAC secrets in the UI.
 * 5. Mobile-First Emerald & Gold Aesthetics: Minimum 48px touch targets, safe-area padding, responsive cards.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Layers,
  Database,
  Eye,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  CreditCard,
  Building2,
  Info,
  Calendar,
  User,
  Hash,
  Wallet
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { soundEngine } from '../services/soundEngine';

export interface AuthoritativePaymentRecord {
  id: number;
  userId: number;
  username: string;
  userEmail: string | null;
  walletId: number;
  type: 'DEPOSIT' | 'WITHDRAWAL' | string;
  method: string;
  amount: string;
  currency: string;
  senderNumber: string | null;
  receiverNumber: string | null;
  senderNumberMasked: string | null;
  receiverNumberMasked: string | null;
  trxId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED' | string;
  adminNote: string | null;
  walletLockedBalance?: string;
  withdrawalLockedAmount?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSummaryData {
  totalCount: number;
  pendingDepositsCount: number;
  pendingDepositsAmount: string;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsAmount: string;
  approvedTotalAmount: string;
  rejectedCount: number;
}

export interface AdminPaymentOperationsViewProps {
  onClose?: () => void;
}

export const AdminPaymentOperationsView: React.FC<AdminPaymentOperationsViewProps> = ({ onClose }) => {
  const { user: authUser } = useAuth();

  // State Management
  const [payments, setPayments] = useState<AuthoritativePaymentRecord[]>([]);
  const [summary, setSummary] = useState<PaymentSummaryData>({
    totalCount: 0,
    pendingDepositsCount: 0,
    pendingDepositsAmount: '0.0000',
    pendingWithdrawalsCount: 0,
    pendingWithdrawalsAmount: '0.0000',
    approvedTotalAmount: '0.0000',
    rejectedCount: 0,
  });
  const [sourceTag, setSourceTag] = useState<string>('POSTGRESQL_AUTHORITATIVE');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Pagination State
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED'>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Interaction State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AuthoritativePaymentRecord | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Search Debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Authoritative Payments from PostgreSQL API
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let idToken = '';
      if (authUser && typeof authUser.getIdToken === 'function') {
        idToken = await authUser.getIdToken();
      }

      const queryParams = new URLSearchParams();
      queryParams.set('page', String(page));
      queryParams.set('limit', String(limit));
      if (typeFilter !== 'ALL') queryParams.set('type', typeFilter);
      if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
      if (methodFilter !== 'ALL') queryParams.set('method', methodFilter);
      if (currencyFilter !== 'ALL') queryParams.set('currency', currencyFilter);
      if (debouncedSearch.trim()) queryParams.set('search', debouncedSearch.trim());

      const res = await fetch(`/api/admin/payments?${queryParams.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}: Failed to load authoritative payments`);
      }

      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        setPayments(payload.data);
        if (payload.source) setSourceTag(payload.source);
        if (payload.summary) setSummary(payload.summary);
        if (payload.pagination) {
          setPage(payload.pagination.page);
          setLimit(payload.pagination.limit);
          setTotalPages(payload.pagination.totalPages);
          setTotalCount(payload.pagination.total);
        }
        setLastRefreshedAt(new Date());
      } else {
        throw new Error(payload.error || 'Invalid authoritative payload structure');
      }
    } catch (err: any) {
      console.error('[AdminPaymentOperationsView] Fetch failed:', err);
      setError(err.message || 'PostgreSQL database connection failed (Fail-Closed).');
    } finally {
      setLoading(false);
    }
  }, [authUser, page, limit, typeFilter, statusFilter, methodFilter, currencyFilter, debouncedSearch]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    soundEngine.playClick(1200);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getMethodBadgeClass = (method: string) => {
    const m = method.toUpperCase();
    if (m.includes('BKASH')) return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
    if (m.includes('NAGAD')) return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    if (m.includes('ROCKET')) return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    if (m.includes('UPAY')) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    if (m.includes('USDT') || m.includes('CRYPTO')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    return 'bg-slate-700/50 text-slate-300 border-slate-600';
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          <span>অপেক্ষমাণ (PENDING)</span>
        </span>
      );
    }
    if (s === 'APPROVED' || s === 'COMPLETED' || s === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>অনুমোদিত (APPROVED)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
        <XCircle className="w-3.5 h-3.5" />
        <span>বাতিল (REJECTED)</span>
      </span>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20 sm:pb-12 animate-fadeIn">
      {/* 1. Header & Source Badge */}
      <div className="bg-gradient-to-r from-[#06241a] via-[#0b3829] to-[#041a12] border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>source: {sourceTag}</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>READ-ONLY AUDIT MODE</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <span>ডিপোজিট ও উইথড্র অপারেশনাল ভিউ (Payment Operations)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              PostgreSQL নিশ্চিত অথরিটেটিভ ডেটাবেস থেকে প্রাপ্ত লাইভ পেমেন্ট কিউ ও ট্রানজাকশন হিস্টোরি।
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                soundEngine.playClick(1000);
                fetchPayments();
              }}
              disabled={loading}
              className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 font-bold text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ (Refresh)</span>
            </button>

            {onClose && (
              <button
                onClick={() => {
                  soundEngine.playClick(800);
                  onClose();
                }}
                className="min-h-[48px] min-w-[48px] p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center transition-all cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Summary KPI Metric Cards (Scale-4 BigInt Arithmetic Strings) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Pending Deposits */}
        <div className="bg-[#0b281f]/80 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-mono">PENDING DEPOSITS</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-2xl font-black text-emerald-400 font-mono">
              ৳{summary.pendingDepositsAmount}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{summary.pendingDepositsCount} টি ডিপোজিট অপেক্ষমাণ</span>
            </div>
          </div>
        </div>

        {/* Pending Withdrawals */}
        <div className="bg-[#0b281f]/80 border border-amber-500/20 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-mono">PENDING WITHDRAWALS</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-2xl font-black text-amber-400 font-mono">
              ৳{summary.pendingWithdrawalsAmount}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>{summary.pendingWithdrawalsCount} টি উইথড্র অপেক্ষমাণ</span>
            </div>
          </div>
        </div>

        {/* Total Settled / Approved Amount */}
        <div className="bg-[#0b281f]/80 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-mono">APPROVED VOLUME</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-2xl font-black text-white font-mono">
              ৳{summary.approvedTotalAmount}
            </div>
            <div className="text-xs text-slate-400 mt-1">মোট অনুমোদিত পরিমাণ</div>
          </div>
        </div>

        {/* Rejected / Cancelled Count */}
        <div className="bg-[#0b281f]/80 border border-rose-500/20 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-mono">REJECTED REQUESTS</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-2xl font-black text-rose-400 font-mono">
              {summary.rejectedCount}
            </div>
            <div className="text-xs text-slate-400 mt-1">বাতিলকৃত অনুরোধ সংখ্যা</div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="bg-[#0b281f] border border-emerald-500/20 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
        {/* Type Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              soundEngine.playClick(1000);
              setTypeFilter('ALL');
              setPage(1);
            }}
            className={`min-h-[48px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              typeFilter === 'ALL'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-emerald-500/20'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>সকল অনুরোধ (All Types)</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick(1000);
              setTypeFilter('DEPOSIT');
              setPage(1);
            }}
            className={`min-h-[48px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              typeFilter === 'DEPOSIT'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-emerald-500/20'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>ডিপোজিট (Deposits)</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick(1000);
              setTypeFilter('WITHDRAWAL');
              setPage(1);
            }}
            className={`min-h-[48px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              typeFilter === 'WITHDRAWAL'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-emerald-500/20'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>উইথড্রয়াল (Withdrawals)</span>
          </button>
        </div>

        {/* Dropdowns and Search Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search TrxID, User, Phone, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[48px] pl-10 pr-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full min-h-[48px] px-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 text-white text-xs sm:text-sm appearance-none focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              <option value="ALL">সকল স্ট্যাটাস (All Status)</option>
              <option value="PENDING">অপেক্ষমাণ (PENDING)</option>
              <option value="APPROVED">অনুমোদিত (APPROVED)</option>
              <option value="REJECTED">বাতিল (REJECTED)</option>
              <option value="FAILED">ব্যর্থ (FAILED)</option>
            </select>
            <Filter className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Payment Method Dropdown */}
          <div className="relative">
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[48px] px-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 text-white text-xs sm:text-sm appearance-none focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              <option value="ALL">সকল মেথড (All Methods)</option>
              <option value="BKASH">bKash (বিকাশ)</option>
              <option value="NAGAD">Nagad (নগদ)</option>
              <option value="ROCKET">Rocket (রকেট)</option>
              <option value="UPAY">Upay (উপায়)</option>
              <option value="USDT">USDT (Crypto)</option>
            </select>
            <CreditCard className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Currency Dropdown */}
          <div className="relative">
            <select
              value={currencyFilter}
              onChange={(e) => {
                setCurrencyFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[48px] px-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 text-white text-xs sm:text-sm appearance-none focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              <option value="ALL">সকল কারেন্সি (All Currencies)</option>
              <option value="BDT">BDT (৳)</option>
              <option value="USD">USD ($)</option>
            </select>
            <Building2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 4. Error Banner (Fail-Closed State) */}
      {error && (
        <div className="bg-rose-950/80 border border-rose-500/40 rounded-2xl p-4 sm:p-5 flex items-start gap-3 text-rose-300">
          <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm sm:text-base text-rose-200">PostgreSQL ডেটাবেস রিড ত্রুটি (Fail-Closed)</h3>
            <p className="text-xs sm:text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* 5. Paginated Requests List / Table */}
      <div className="bg-[#0b281f] border border-emerald-500/20 rounded-3xl overflow-hidden shadow-2xl">
        {/* Table Header Controls */}
        <div className="p-4 sm:p-5 border-b border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">পেমেন্ট রিকোয়েস্ট তালিকা ({totalCount})</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-mono">
              Page {page} of {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <label className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>প্রতি পেজে:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-slate-900 border border-emerald-500/30 rounded-xl px-2 py-1 text-xs text-white focus:outline-none"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </label>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <p className="text-sm text-slate-400 font-mono">PostgreSQL অথরিটেটিভ ডেটা লোড হচ্ছে...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && payments.length === 0 && !error && (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">কোনো পেমেন্ট রিকোয়েস্ট পাওয়া যায়নি</h3>
            <p className="text-xs text-slate-400">ফিল্টার বা সার্চ শর্ত পরিবর্তন করে পুনরায় চেষ্টা করুন।</p>
          </div>
        )}

        {/* List of Cards (Mobile-first responsive design) */}
        {!loading && payments.length > 0 && (
          <div className="divide-y divide-emerald-500/10">
            {payments.map((req) => {
              const isDeposit = req.type.toUpperCase() === 'DEPOSIT';
              return (
                <div
                  key={req.id}
                  className="p-4 sm:p-5 hover:bg-emerald-900/10 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left Column: ID, Type, User, Method */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center border ${
                        isDeposit
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}
                    >
                      {isDeposit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">#{req.id}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${getMethodBadgeClass(
                            req.method
                          )}`}
                        >
                          {req.method}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            isDeposit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {req.type}
                        </span>
                        {getStatusBadge(req.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 font-medium">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-white font-bold">{req.username}</span>
                          <span className="text-slate-500 font-mono">(UID: {req.userId})</span>
                        </span>

                        {req.senderNumberMasked && (
                          <span className="text-slate-400 font-mono">
                            প্রেরক: <span className="text-slate-200">{req.senderNumberMasked}</span>
                          </span>
                        )}

                        {req.receiverNumberMasked && (
                          <span className="text-slate-400 font-mono">
                            প্রাপক: <span className="text-slate-200">{req.receiverNumberMasked}</span>
                          </span>
                        )}
                      </div>

                      {/* TrxID with Copy */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-xs text-slate-400 font-mono">TrxID:</span>
                        <code className="text-xs font-mono font-bold text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/20">
                          {req.trxId}
                        </code>
                        <button
                          onClick={() => handleCopy(req.trxId, `trx-${req.id}`)}
                          className="min-h-[32px] min-w-[32px] p-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="TrxID কপি করুন"
                        >
                          {copiedId === `trx-${req.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Exact Amount, Locked Balance, Timestamps, Action */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 border-t lg:border-t-0 border-emerald-500/10 pt-3 lg:pt-0">
                    <div className="text-left lg:text-right">
                      <div className="text-base sm:text-lg font-black font-mono text-emerald-400">
                        ৳{req.amount} <span className="text-xs font-normal text-slate-400">{req.currency}</span>
                      </div>

                      {!isDeposit && req.withdrawalLockedAmount && req.withdrawalLockedAmount !== '0.0000' && (
                        <div className="text-xs font-mono text-amber-400/90 flex items-center gap-1 lg:justify-end mt-0.5">
                          <Lock className="w-3 h-3" />
                          <span>লকড ব্যালেন্স: ৳{req.withdrawalLockedAmount}</span>
                        </div>
                      )}

                      <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1 lg:justify-end">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{new Date(req.createdAt).toLocaleString('bn-BD', { hour12: true })}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        soundEngine.playClick(1000);
                        setSelectedRecord(req);
                      }}
                      className="min-h-[48px] px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    >
                      <Eye className="w-4 h-4" />
                      <span>বিস্তারিত (Inspect)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="p-4 sm:p-5 border-t border-emerald-500/20 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 font-mono">
              মোট {totalCount} টি রেকর্ডের মধ্যে {Math.min((page - 1) * limit + 1, totalCount)} -{' '}
              {Math.min(page * limit, totalCount)} প্রদর্শিত হচ্ছে
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  soundEngine.playClick(900);
                  setPage((p) => Math.max(1, p - 1));
                }}
                disabled={page <= 1}
                className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-500/30 text-slate-300 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">পূর্ববর্তী (Prev)</span>
              </button>

              <span className="px-3 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold">
                {page} / {totalPages}
              </span>

              <button
                onClick={() => {
                  soundEngine.playClick(900);
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                disabled={page >= totalPages}
                className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-500/30 text-slate-300 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <span className="hidden sm:inline">পরবর্তী (Next)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Read-Only Detailed Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0b281f] border border-emerald-500/30 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>পেমেন্ট অনুরোধ বিবরণ #{selectedRecord.id}</span>
                  </h3>
                  <span className="text-xs text-emerald-400 font-mono font-bold">
                    source: {sourceTag} (READ-ONLY)
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  soundEngine.playClick(800);
                  setSelectedRecord(null);
                }}
                className="min-h-[48px] min-w-[48px] p-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Read-Only Notice */}
            <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-300">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p>
                এটি একটি অপরিবর্তনযোগ্য রিড-অনলি ভিউ। আর্থিক সুরক্ষার স্বার্থে এই প্যানেল থেকে সরাসরি কোনো স্ট্যাটাস বা ব্যালেন্স পরিবর্তন করা সম্ভব নয়।
              </p>
            </div>

            {/* Record Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1">
                <span className="text-slate-400 font-mono">অনুরোধের ধরন (Type)</span>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      selectedRecord.type === 'DEPOSIT'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {selectedRecord.type}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1">
                <span className="text-slate-400 font-mono">বর্তমান স্ট্যাটাস (Status)</span>
                <div>{getStatusBadge(selectedRecord.status)}</div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1">
                <span className="text-slate-400 font-mono">নির্ধারিত অর্থ (Exact Amount)</span>
                <div className="text-base font-black font-mono text-emerald-400">
                  ৳{selectedRecord.amount} {selectedRecord.currency}
                </div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1">
                <span className="text-slate-400 font-mono">পেমেন্ট মেথড (Gateway Method)</span>
                <div className="text-sm font-bold text-white font-mono">{selectedRecord.method}</div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1">
                <span className="text-slate-400 font-mono">ব্যবহারকারী (User ID & Username)</span>
                <div className="text-sm font-bold text-white">
                  {selectedRecord.username} <span className="text-slate-400 font-mono">(ID: {selectedRecord.userId})</span>
                </div>
                {selectedRecord.userEmail && (
                  <div className="text-xs text-slate-400 font-mono">{selectedRecord.userEmail}</div>
                )}
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1">
                <span className="text-slate-400 font-mono">ওয়ালেট আইডি (Wallet ID)</span>
                <div className="text-sm font-bold font-mono text-white">#{selectedRecord.walletId}</div>
              </div>

              {selectedRecord.type === 'WITHDRAWAL' && (
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1 sm:col-span-2">
                  <span className="text-slate-400 font-mono">উইথড্রয়াল লকড ব্যালেন্স (Locked Amount)</span>
                  <div className="text-sm font-bold font-mono text-amber-400 flex items-center gap-1.5">
                    <Lock className="w-4 h-4" />
                    <span>৳{selectedRecord.withdrawalLockedAmount || selectedRecord.amount} {selectedRecord.currency}</span>
                  </div>
                </div>
              )}

              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1 sm:col-span-2">
                <span className="text-slate-400 font-mono">ট্রানজাকশন আইডি (TrxID)</span>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-mono font-bold text-amber-300 bg-slate-900 px-2 py-1 rounded border border-emerald-500/20 break-all">
                    {selectedRecord.trxId}
                  </code>
                  <button
                    onClick={() => handleCopy(selectedRecord.trxId, 'modal-trx')}
                    className="min-h-[44px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedId === 'modal-trx' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'modal-trx' ? 'কপি হয়েছে' : 'কপি'}</span>
                  </button>
                </div>
              </div>

              {selectedRecord.senderNumberMasked && (
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1">
                  <span className="text-slate-400 font-mono">প্রেরক অ্যাকাউন্ট (Sender)</span>
                  <div className="text-sm font-mono font-bold text-slate-200">{selectedRecord.senderNumberMasked}</div>
                </div>
              )}

              {selectedRecord.receiverNumberMasked && (
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1">
                  <span className="text-slate-400 font-mono">প্রাপক অ্যাকাউন্ট (Receiver)</span>
                  <div className="text-sm font-mono font-bold text-slate-200">{selectedRecord.receiverNumberMasked}</div>
                </div>
              )}

              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1">
                <span className="text-slate-400 font-mono">তৈরির সময় (Created At)</span>
                <div className="text-xs font-mono text-slate-300">
                  {new Date(selectedRecord.createdAt).toISOString()}
                </div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1">
                <span className="text-slate-400 font-mono">আপডেট সময় (Updated At)</span>
                <div className="text-xs font-mono text-slate-300">
                  {new Date(selectedRecord.updatedAt).toISOString()}
                </div>
              </div>

              {selectedRecord.adminNote && (
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/10 space-y-1 sm:col-span-2">
                  <span className="text-slate-400 font-mono">অ্যাডমিন নোট (Admin Note)</span>
                  <div className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    {selectedRecord.adminNote}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Close Action */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  soundEngine.playClick(800);
                  setSelectedRecord(null);
                }}
                className="min-h-[48px] px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm transition-all cursor-pointer"
              >
                বন্ধ করুন (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
