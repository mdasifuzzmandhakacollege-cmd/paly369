/**
 * @file AdminPanel.tsx
 * @description Enterprise Role-Based Admin Management Console for Playall 365.
 * Features Real-Time Semi-Automated Deposit/Withdrawal Approval Queues,
 * Gateway Account Management (bKash/Nagad/Rocket/USDT), Financial KPIs,
 * Player Balance Adjustments, and B2B API Architecture documentation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  CreditCard,
  Sliders,
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  Settings,
  Send,
  FileCode2,
  Terminal,
  Activity,
  Layers,
  Sparkles,
  Receipt,
  ShieldAlert,
  Loader2,
  ArrowLeft,
  AlertOctagon,
  KeyRound,
  Database
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWalletGame } from '../contexts/WalletGameContext';
import { AdminPaymentOperationsView } from './AdminPaymentOperationsView';
import { AdminWalletWageringMonitoringView } from './AdminWalletWageringMonitoringView';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { notificationService } from '../services/notificationService';
import { soundEngine } from '../services/soundEngine';
import {
  PaymentRequestEntity,
  PaymentStatus,
  PaymentMethodType,
  UserEntity,
  WalletEntity
} from '../server/types/seamless';
import { paymentGatewayEngine } from '../services/paymentGatewayEngine';
import {
  DepositIntent,
  WithdrawalRecord,
  PaymentDestinationAccount,
  DoubleEntryLedgerEntry,
  WebhookLog,
  AuditLogEntry
} from '../server/types/paymentGateway';

interface AdminPanelProps {
  onStateMutated: () => void;
  onClose?: () => void;
  onRedirect?: (tab: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onStateMutated, onClose, onRedirect }) => {
  const { user: authUser, firestoreUser } = useAuth();
  const { currentUser, setActiveTab } = useWalletGame();

  // Strict Firestore Role Verification State
  const [roleVerifying, setRoleVerifying] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [verifiedRole, setVerifiedRole] = useState<string | null>(null);
  const [authErrorReason, setAuthErrorReason] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(4);

  const handleRedirect = useCallback(() => {
    soundEngine.playNavClick();
    if (onRedirect) {
      onRedirect('lobby');
    } else if (onClose) {
      onClose();
    } else {
      setActiveTab('lobby');
    }
  }, [onRedirect, onClose, setActiveTab]);

  // Authoritative Server-Side Role Verification via /api/auth/verify-role
  useEffect(() => {
    let isCancelled = false;

    const verifyServerRole = async () => {
      setRoleVerifying(true);

      if (!authUser) {
        if (!isCancelled) {
          setIsAuthorized(false);
          setVerifiedRole('PLAYER');
          setAuthErrorReason('কোনো সক্রিয় অথেনটিকেটেড সেশন পাওয়া যায়নি (No authenticated user session).');
          setRoleVerifying(false);
        }
        return;
      }

      try {
        const idToken = await authUser.getIdToken();
        if (!idToken) {
          if (!isCancelled) {
            setIsAuthorized(false);
            setVerifiedRole('PLAYER');
            setAuthErrorReason('অথেনটিকেশন টোকেন পাওয়া যায়নি (Missing authentication token).');
            setRoleVerifying(false);
          }
          return;
        }

        const res = await fetch('/api/auth/verify-role', {
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.isPrivileged === true) {
            if (!isCancelled) {
              setIsAuthorized(true);
              setVerifiedRole(data.role || 'ADMIN');
              setRoleVerifying(false);
            }
            return;
          } else {
            if (!isCancelled) {
              setIsAuthorized(false);
              setVerifiedRole(data.role || 'PLAYER');
              setAuthErrorReason(
                `সার্ভার নিরাপত্তা যাচাইয়ে আপনার অ্যাকাউন্ট (${authUser.email || authUser.uid}) অ্যাডমিন বা অপারেটর হিসেবে অনুমোদিত নয়। বর্তমান রোল: '${data.role || 'PLAYER'}'।`
              );
              setRoleVerifying(false);
            }
            return;
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          if (!isCancelled) {
            setIsAuthorized(false);
            setVerifiedRole('PLAYER');
            setAuthErrorReason(errData.error || 'সার্ভার রোল ভেরিফিকেশন ব্যর্থ হয়েছে (Role verification failed on server).');
            setRoleVerifying(false);
          }
        }
      } catch (err: any) {
        console.warn('[AdminPanel] Authoritative server role check error:', err);
        if (!isCancelled) {
          // Fail closed
          setIsAuthorized(false);
          setVerifiedRole('PLAYER');
          setAuthErrorReason('সার্ভার নিরাপত্তা যাচাই করতে ত্রুটি হয়েছে (Failed to verify role with authoritative server).');
          setRoleVerifying(false);
        }
      }
    };

    verifyServerRole();

    return () => {
      isCancelled = true;
    };
  }, [authUser]);

  // Automatic Redirection Mechanism for Unauthorized Users
  useEffect(() => {
    if (!roleVerifying && !isAuthorized) {
      if (redirectCountdown <= 0) {
        handleRedirect();
        return;
      }
      const timer = setTimeout(() => {
        setRedirectCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [roleVerifying, isAuthorized, redirectCountdown, handleRedirect]);
  const [activeSubTab, setActiveSubTab] = useState<'authoritative_ops' | 'authoritative_wallet_wagering' | 'automated_gateway' | 'deposits' | 'withdrawals' | 'gateways' | 'users' | 'api_guide'>('authoritative_ops');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReasonModal, setRejectReasonModal] = useState<{ id: string; type: 'DEPOSIT' | 'WITHDRAWAL' } | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState('ভুল TrxID বা অ্যাকাউন্টে কোনো টাকা জমা হয়নি (Invalid TrxID or funds not received)');

  // Automated Payment Gateway Data
  const [liveIntents, setLiveIntents] = useState<DepositIntent[]>(paymentGatewayEngine.getDepositIntents());
  const [liveWithdrawals, setLiveWithdrawals] = useState<WithdrawalRecord[]>(paymentGatewayEngine.getWithdrawalRecords());
  const [destinationPool, setDestinationPool] = useState<PaymentDestinationAccount[]>(paymentGatewayEngine.getDestinationPool());
  const [doubleEntryLedger, setDoubleEntryLedger] = useState<DoubleEntryLedgerEntry[]>(paymentGatewayEngine.getDoubleEntryLedger());
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(paymentGatewayEngine.getAuditLogs());
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>(paymentGatewayEngine.getWebhookLogs());
  const [gatewayStats, setGatewayStats] = useState(paymentGatewayEngine.getStats());

  const refreshGatewayData = () => {
    setLiveIntents(paymentGatewayEngine.getDepositIntents());
    setLiveWithdrawals(paymentGatewayEngine.getWithdrawalRecords());
    setDestinationPool(paymentGatewayEngine.getDestinationPool());
    setDoubleEntryLedger(paymentGatewayEngine.getDoubleEntryLedger());
    setAuditLogs(paymentGatewayEngine.getAuditLogs());
    setWebhookLogs(paymentGatewayEngine.getWebhookLogs());
    setGatewayStats(paymentGatewayEngine.getStats());
  };

  React.useEffect(() => {
    const unsub = paymentGatewayEngine.subscribe(() => {
      refreshGatewayData();
    });
    return () => unsub();
  }, []);

  // Gateway Configurations State (Semi-Automated)
  const [gateways, setGateways] = useState({
    bkash: '01900-112233',
    bkashType: 'Merchant Wallet',
    nagad: '01844-992200',
    nagadType: 'Agent Cash-in',
    rocket: '01711-884422-9',
    rocketType: 'Biller / Agent',
    upay: '01399-556677',
    upayType: 'Merchant Pay',
    usdt: 'TK89xVqLiveSeamlessCasinoCryptoVault99201'
  });
  const [gatewaySavedToast, setGatewaySavedToast] = useState(false);

  // Manual Adjust Modal
  const [adjustUserModal, setAdjustUserModal] = useState<UserEntity | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(1000);
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjustReason, setAdjustReason] = useState('VIP Loyalty Goodwill Adjustment');

  // Pull live data
  const paymentRequests = seamlessEngine.getPaymentRequests();
  const allUsers = seamlessEngine.getUsers();
  const allWallets = seamlessEngine.getWallets();
  const transactions = seamlessEngine.getTransactions();

  // Metrics Calculation
  const totalDeposits = paymentRequests
    .filter((p) => p.type === 'DEPOSIT' && p.status === 'APPROVED')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalWithdrawals = paymentRequests
    .filter((p) => p.type === 'WITHDRAWAL' && p.status === 'APPROVED')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingDepositsCount = paymentRequests.filter((p) => p.type === 'DEPOSIT' && p.status === 'PENDING').length;
  const pendingWithdrawalsCount = paymentRequests.filter((p) => p.type === 'WITHDRAWAL' && p.status === 'PENDING').length;

  const totalBets = transactions
    .filter((t) => t.type === 'BET')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWins = transactions
    .filter((t) => t.type === 'WIN')
    .reduce((sum, t) => sum + t.amount, 0);

  const ggr = totalBets - totalWins;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    soundEngine.playClick(1200);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. Approve Deposit Handler
  const handleApproveDeposit = async (req: PaymentRequestEntity) => {
    setActionLoading(req.id);
    soundEngine.playClick(1000);

    try {
      await seamlessEngine.approvePaymentRequest(req.id);

      // Trigger realtime notification to user
      notificationService.notifyDepositConfirmed(req.amount, req.currency as any, req.method);
      soundEngine.playWalletCredit();

      onStateMutated();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    } finally {
      setActionLoading(null);
    }
  };

  // 2. Reject Request Handler
  const handleConfirmReject = async () => {
    if (!rejectReasonModal) return;
    setActionLoading(rejectReasonModal.id);

    try {
      const targetReq = paymentRequests.find((r) => r.id === rejectReasonModal.id);
      if (targetReq) {
        targetReq.status = 'REJECTED';
        targetReq.admin_note = rejectReasonText;
        targetReq.updated_at = new Date().toISOString();

        // If it was a withdrawal, refund money back to the user
        if (rejectReasonModal.type === 'WITHDRAWAL') {
          seamlessEngine.topUpWallet(targetReq.user_id, targetReq.currency, targetReq.amount);
          notificationService.notifySystemAlert(
            'উইথড্র বাতিল ও ব্যালেন্স রিফান্ড (Withdrawal Rejected & Refunded)',
            `আপনার ৳${targetReq.amount} উইথড্র বাতিল করা হয়েছে। কারণ: ${rejectReasonText}। ব্যালেন্স পুনরায় ওয়ালেটে ফেরত দেওয়া হয়েছে।`
          );
        } else {
          notificationService.notifySystemAlert(
            'ডিপোজিট বাতিল (Deposit Request Rejected)',
            `আপনার ৳${targetReq.amount} (${targetReq.method}) ডিপোজিট অনুরোধ বাতিল করা হয়েছে। কারণ: ${rejectReasonText}`
          );
        }
      }

      soundEngine.playClick(400);
      setRejectReasonModal(null);
      onStateMutated();
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
    } finally {
      setActionLoading(null);
    }
  };

  // 3. Save Gateway Config
  const handleSaveGateways = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick(1200);
    setGatewaySavedToast(true);
    setTimeout(() => setGatewaySavedToast(false), 3000);
  };

  // 4. Adjust Player Balance
  const handleAdjustBalance = () => {
    if (!adjustUserModal) return;
    soundEngine.playClick(900);

    const delta = adjustType === 'ADD' ? adjustAmount : -adjustAmount;
    seamlessEngine.topUpWallet(adjustUserModal.id, adjustUserModal.currency, delta);

    notificationService.notifySystemAlert(
      `অ্যাকাউন্ট ব্যালেন্স সমন্বয় (${adjustType === 'ADD' ? 'Credited' : 'Debited'})`,
      `অ্যাডমিন প্যানেল থেকে আপনার অ্যাকাউন্টে ${adjustUserModal.currency === 'BDT' ? '৳' : '$'}${adjustAmount} ${
        adjustType === 'ADD' ? 'যোগ' : 'কর্তন'
      } করা হয়েছে। বিবরণ: ${adjustReason}`
    );

    setAdjustUserModal(null);
    onStateMutated();
  };

  // Filter requests
  const filteredDeposits = paymentRequests
    .filter((r) => r.type === 'DEPOSIT')
    .filter((r) => (statusFilter === 'ALL' ? true : r.status === statusFilter))
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.trx_id.toLowerCase().includes(q) ||
        r.sender_number.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.user_id.toLowerCase().includes(q)
      );
    });

  const filteredWithdrawals = paymentRequests
    .filter((r) => r.type === 'WITHDRAWAL')
    .filter((r) => (statusFilter === 'ALL' ? true : r.status === statusFilter))
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.trx_id.toLowerCase().includes(q) ||
        (r.receiver_number && r.receiver_number.toLowerCase().includes(q)) ||
        r.id.toLowerCase().includes(q) ||
        r.user_id.toLowerCase().includes(q)
      );
    });

  // 1. STATE: VERIFYING ROLE IN FIRESTORE
  if (roleVerifying) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6 animate-fadeIn">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-xl shadow-amber-500/10">
          <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white font-bengali">
            Firestore অ্যাডমিন পারমিশন যাচাই করা হচ্ছে...
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-mono">
            Verifying authenticated operator credentials against Firestore users database...
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
          <span>User: {authUser?.email || currentUser?.username || 'Active Session'}</span>
        </div>
      </div>
    );
  }

  // 2. STATE: UNAUTHORIZED ROLE WITH AUTOMATIC REDIRECTION MECHANISM
  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6 animate-fadeIn">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 shadow-2xl shadow-rose-500/20">
          <ShieldAlert className="w-10 h-10 animate-pulse" />
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold font-mono uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" />
            <span>403 Forbidden • Access Restricted</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white font-bengali">
            অ্যাডমিন প্যানেল অ্যাক্সেস নিষিদ্ধ
          </h2>
          <p className="text-sm text-slate-300 font-bengali max-w-md mx-auto">
            এই রুটটি শুধুমাত্র Firestore ডাটাবেজে নথিবদ্ধ অনুমোদিত <strong className="text-amber-400">ADMIN</strong> ও <strong className="text-amber-400">OPERATOR</strong> রোলধারীদের জন্য সংরক্ষিত।
          </p>
        </div>

        {authErrorReason && (
          <div className="bg-slate-950/80 border border-rose-900/60 rounded-2xl p-4 max-w-md mx-auto text-left text-xs font-mono text-slate-400 space-y-1.5">
            <div className="flex items-center space-x-2 text-rose-400 font-bold">
              <AlertOctagon className="w-4 h-4" />
              <span>নিরাপত্তা নিরীক্ষা (Security Reason):</span>
            </div>
            <p className="text-slate-300 text-[11px] break-words">{authErrorReason}</p>
          </div>
        )}

        {/* Automatic Redirection Countdown Gauge */}
        <div className="bg-emerald-950/40 border border-amber-500/30 rounded-2xl p-4 max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-xs text-amber-300 font-mono font-bold">
            <Clock className="w-4 h-4 text-amber-400 animate-spin" />
            <span>স্বয়ংক্রিয় রিডাইরেক্ট (Redirecting):</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs font-mono flex items-center justify-center shadow">
              {redirectCountdown}s
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handleRedirect}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer font-bengali"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>এখনই লবিতে ফিরে যান (Return Now)</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm transition-all cursor-pointer font-bengali"
            >
              বন্ধ করুন (Close)
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. AUTHORIZED OPERATOR CONSOLE VIEW
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-fadeIn">
      {/* 1. TOP HEADER & ROLE BADGE */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-[#120e24] border border-amber-500/40 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-xs font-mono uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-amber-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{verifiedRole || 'SUPER ADMIN ROOT'}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[11px] border border-emerald-500/30">
              ● FIRESTORE ROLE VERIFIED
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1.5 flex items-center space-x-2">
            <span>Playall 365 Cashier &amp; Operations Control</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Semi-Automated Local Fiat (bKash, Nagad, Rocket, Upay) + Crypto TRC20 Verification &amp; Payout Console
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              soundEngine.playClick(1000);
              onStateMutated();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold flex items-center space-x-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>রিফ্রেশ ডেটা (Refresh)</span>
          </button>
        </div>
      </div>

      {/* 2. EXECUTIVE FINANCIAL KPIS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 font-mono">
        {/* Pending Deposit Alert Card */}
        <div className="bg-slate-900/90 border border-amber-500/40 p-4 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="text-[11px] text-amber-400 font-bold uppercase flex items-center justify-between">
            <span>অপেক্ষমাণ ডিপোজিট</span>
            <Clock className="w-4 h-4 text-amber-400 animate-spin" />
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {pendingDepositsCount} <span className="text-xs text-slate-400 font-normal">অনুরোধ</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Manual/Semi TrxID Verification</div>
        </div>

        {/* Pending Withdrawal Card */}
        <div className="bg-slate-900/90 border border-rose-500/40 p-4 rounded-2xl shadow-xl">
          <div className="text-[11px] text-rose-400 font-bold uppercase flex items-center justify-between">
            <span>অপেক্ষমাণ উইথড্র</span>
            <ArrowDownLeft className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {pendingWithdrawalsCount} <span className="text-xs text-slate-400 font-normal">অনুরোধ</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Pending Player Cashouts</div>
        </div>

        {/* Total Deposits Approved */}
        <div className="bg-slate-900/90 border border-emerald-500/30 p-4 rounded-2xl shadow-xl">
          <div className="text-[11px] text-emerald-400 font-bold uppercase flex items-center justify-between">
            <span>মোট ডিপোজিট</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-300 mt-1">
            ৳{totalDeposits.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Total Settled Inflow</div>
        </div>

        {/* Total Withdrawals Approved */}
        <div className="bg-slate-900/90 border border-blue-500/30 p-4 rounded-2xl shadow-xl">
          <div className="text-[11px] text-blue-400 font-bold uppercase flex items-center justify-between">
            <span>মোট পেইড উইথড্র</span>
            <Coins className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-black text-blue-300 mt-1">
            ৳{totalWithdrawals.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Total Settled Outflow</div>
        </div>

        {/* Gross Gaming Revenue (GGR) */}
        <div className="bg-slate-900/90 border border-purple-500/30 p-4 rounded-2xl shadow-xl col-span-2 lg:col-span-1">
          <div className="text-[11px] text-purple-400 font-bold uppercase flex items-center justify-between">
            <span>নেট GGR (REVENUE)</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-black text-purple-300 mt-1">
            ৳{ggr.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Platform Hold Retention</div>
        </div>
      </div>

      {/* 3. SUBTABS NAVIGATION */}
      <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 font-mono text-xs overflow-x-auto scrollbar-none">
        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveSubTab('authoritative_ops');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'authoritative_ops'
              ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black shadow-lg shadow-emerald-500/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>PostgreSQL পেমেন্ট অপারেশনস (Authoritative Ops)</span>
        </button>

        <button
          id="tab-authoritative-wallet-wagering-btn"
          onClick={() => {
            soundEngine.playClick();
            setActiveSubTab('authoritative_wallet_wagering');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'authoritative_wallet_wagering'
              ? 'bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 font-black shadow-lg shadow-amber-500/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Coins className="w-4 h-4 text-amber-400" />
          <span>ওয়ালেট ও ওয়েজারিং মনিটরিং (Wallets & Wagering)</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveSubTab('automated_gateway');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'automated_gateway'
              ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black shadow-lg shadow-emerald-500/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>অটো গেটওয়ে ও পুল হাব (Automated v2)</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveSubTab('deposits');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'deposits'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>ডিপোজিট কিউ ({pendingDepositsCount})</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveSubTab('withdrawals');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'withdrawals'
              ? 'bg-rose-600 text-white font-black shadow-lg shadow-rose-600/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>উইথড্র পেআউট ({pendingWithdrawalsCount})</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveSubTab('gateways');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'gateways'
              ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>গেটওয়ে নম্বর কনফিগ (Gateways)</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveSubTab('users');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'users'
              ? 'bg-purple-600 text-white font-black shadow-lg shadow-purple-600/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>প্লেয়ার ব্যালেন্স নিয়ন্ত্রণ (Users)</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveSubTab('api_guide');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSubTab === 'api_guide'
              ? 'bg-slate-800 text-cyan-300 font-black border border-cyan-500/50'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          <span>রিয়েল এপিআই ডকুমেন্টেশন (API Arch)</span>
        </button>
      </div>

      {/* 4. SUBTAB: POSTGRESQL AUTHORITATIVE PAYMENT OPERATIONS VIEW (READ-ONLY) */}
      {activeSubTab === 'authoritative_ops' && (
        <AdminPaymentOperationsView />
      )}

      {/* 4.1 SUBTAB: POSTGRESQL AUTHORITATIVE WALLET & WAGERING MONITORING (READ-ONLY) */}
      {activeSubTab === 'authoritative_wallet_wagering' && (
        <AdminWalletWageringMonitoringView />
      )}

      {/* 5. SUBTAB 0: FULLY AUTOMATED PAYMENT GATEWAY & POOL HUB */}
      {activeSubTab === 'automated_gateway' && (
        <div className="space-y-6">
          {/* Top Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="bg-slate-900/90 border border-emerald-500/30 p-4 rounded-2xl">
              <span className="text-[10px] text-emerald-400 font-bold uppercase block">স্বয়ংক্রিয় ডিপোজিট ইনলেট</span>
              <div className="text-xl font-black text-emerald-300 mt-1">৳{gatewayStats.totalDeposited.toLocaleString()}</div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{gatewayStats.totalIntents} Intents Generated</span>
            </div>

            <div className="bg-slate-900/90 border border-rose-500/30 p-4 rounded-2xl">
              <span className="text-[10px] text-rose-400 font-bold uppercase block">স্বয়ংক্রিয় পেআউট ডিসবার্স</span>
              <div className="text-xl font-black text-rose-300 mt-1">৳{gatewayStats.totalWithdrawn.toLocaleString()}</div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{gatewayStats.totalWithdrawals} Payouts Executed</span>
            </div>

            <div className="bg-slate-900/90 border border-amber-500/30 p-4 rounded-2xl">
              <span className="text-[10px] text-amber-400 font-bold uppercase block">অ্যাক্টিভ গেটওয়ে পুল অ্যাকাউন্ট</span>
              <div className="text-xl font-black text-amber-300 mt-1">{gatewayStats.activeGateways} Active Accounts</div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Dynamic Rotation Ready</span>
            </div>

            <div className="bg-slate-900/90 border border-purple-500/30 p-4 rounded-2xl">
              <span className="text-[10px] text-purple-400 font-bold uppercase block">নেট ক্যাশ-ফ্লো রিজার্ভ</span>
              <div className="text-xl font-black text-purple-300 mt-1">৳{gatewayStats.netCashFlow.toLocaleString()}</div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Double-Entry Balanced</span>
            </div>
          </div>

          {/* SECTION A: PAYMENT DESTINATION ACCOUNT ROTATION POOL */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                  <span>পেমেন্ট ডেস্টিনেশন একাউন্ট পুল ও ডাইনামিক রোটেশন ইঞ্জিন</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  ডিপোজিট রিকোয়েস্টের ক্যাপাসিটি, দৈনিক সীমা এবং স্বাস্থ্য অনুসারে স্বয়ংক্রিয়ভাবে অ্যাকাউন্ট বরাদ্দ
                </p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-mono font-bold">
                ● LOAD BALANCED POOL
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {destinationPool.map((dest) => {
                const usedPercent = Math.min(100, Math.round((dest.currentDayVolume / dest.dailyLimit) * 100));
                return (
                  <div
                    key={dest.id}
                    className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-3 font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        {dest.provider.toUpperCase()} ({dest.accountType})
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => {
                            paymentGatewayEngine.updateDestinationStatus(dest.id, { isActive: !dest.isActive });
                            refreshGatewayData();
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            dest.isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}
                        >
                          {dest.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">{dest.accountName}</div>
                      <div className="text-base font-bold text-white mt-0.5">{dest.accountNumber}</div>
                    </div>

                    {/* Capacity Progress Bar */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>আজকের ভলিউম: ৳{dest.currentDayVolume.toLocaleString()}</span>
                        <span className="text-amber-400 font-bold">{usedPercent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all rounded-full ${
                            usedPercent > 85 ? 'bg-rose-500' : usedPercent > 50 ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${usedPercent}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 text-right">
                        দৈনিক সীমা: ৳{dest.dailyLimit.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION B: LIVE DEPOSIT INTENTS & VERIFICATION LOGS */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>লাইভ অটো-ডিপোজিট ইনটেন্টস ও ৮-পয়েন্ট ভেরিফিকেশন লগ</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  ইউনিক ডিপোজিট আইডি, TrxID স্টেটাস ও অটোমেটেড ডাবল-এন্ট্রি লেজার সিঙ্ক
                </p>
              </div>
              <button
                onClick={refreshGatewayData}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">ডিপোজিট আইডি</th>
                    <th className="p-3">প্লেয়ার</th>
                    <th className="p-3">মেথড &amp; নম্বর</th>
                    <th className="p-3">পরিমাণ</th>
                    <th className="p-3">TrxID</th>
                    <th className="p-3">রিস্ক স্কোর</th>
                    <th className="p-3">স্ট্যাটাস</th>
                    <th className="p-3">সময়</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {liveIntents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500 font-sans">
                        কোনো ডিপোজিট ইনটেন্ট সক্রিয় নেই
                      </td>
                    </tr>
                  ) : (
                    liveIntents.map((intent) => (
                      <tr key={intent.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-bold text-white">{intent.id}</td>
                        <td className="p-3 text-slate-300">{intent.username}</td>
                        <td className="p-3 text-slate-300">
                          <span className="font-bold text-amber-300">{intent.provider.toUpperCase()}</span>
                          <span className="text-[10px] text-slate-500 block">{intent.destinationAccount.accountNumber}</span>
                        </td>
                        <td className="p-3 font-bold text-emerald-400">৳{intent.amount.toLocaleString()}</td>
                        <td className="p-3 text-white font-bold">{intent.providerTransactionId || 'অপেক্ষমাণ'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            intent.riskScore > 60 ? 'bg-red-500/20 text-red-400' : intent.riskScore > 30 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {intent.riskScore}/100
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            intent.status === 'CREDITED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : (intent.status === 'AWAITING_PAYMENT' || intent.status === 'VERIFIED' || intent.status === 'AWAITING_LEDGER_SETTLEMENT')
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                              : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}>
                            {intent.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">{new Date(intent.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION C: CONTROLLED WITHDRAWAL RESERVATIONS & DISPATCH */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400" />
                  <span>ব্যালেন্স রিজার্ভেশন ও পেআউট ডিসবার্সমেন্ট পাইপলাইন</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  WITHDRAWAL_RESERVED থেকে প্রোভাইডার ডিসবার্স কনফার্মেশন ও স্বয়ংক্রিয় ডেবিট নিষ্পত্তি
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">উইথড্র আইডি</th>
                    <th className="p-3">প্লেয়ার</th>
                    <th className="p-3">প্রাপক একাউন্ট</th>
                    <th className="p-3">পরিমাণ</th>
                    <th className="p-3">রিজার্ভেশন স্টেট</th>
                    <th className="p-3">প্রোভাইডার রেফারেন্স</th>
                    <th className="p-3">স্ট্যাটাস</th>
                    <th className="p-3">সময়</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {liveWithdrawals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500 font-sans">
                        কোনো উইথড্রয়াল রেকর্ড নেই
                      </td>
                    </tr>
                  ) : (
                    liveWithdrawals.map((wth) => (
                      <tr key={wth.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-bold text-white">{wth.id}</td>
                        <td className="p-3 text-slate-300">{wth.username}</td>
                        <td className="p-3 text-white font-bold">{wth.recipientAccount} ({wth.provider.toUpperCase()})</td>
                        <td className="p-3 font-bold text-rose-400">৳{wth.amount.toLocaleString()}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            RESERVED: ৳{wth.amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{wth.providerReference || 'Pending Gateway Disb'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            wth.status === 'WITHDRAWAL_COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : wth.status === 'WITHDRAWAL_RESERVED' || wth.status === 'PAYOUT_PROCESSING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}>
                            {wth.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">{new Date(wth.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION D: DOUBLE-ENTRY LEDGER & IMMUTABLE AUDIT LOGS */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-cyan-400" />
                <span>ডাবল-এন্ট্রি একাউন্টিং লেজার ও অপরিবর্তনযোগ্য সিস্টেম অডিট</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                System Liability Accounts &lt;-&gt; User Wallet Balances পূর্ণ গাণিতিক সামঞ্জস্য
              </p>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2.5">লেজার আইডি</th>
                    <th className="p-2.5">অ্যাকশন</th>
                    <th className="p-2.5">ডেবিট একাউন্ট</th>
                    <th className="p-2.5">ক্রেডিট একাউন্ট</th>
                    <th className="p-2.5">পরিমাণ</th>
                    <th className="p-2.5">ব্যালেন্স আফটার</th>
                    <th className="p-2.5">রেফারেন্স</th>
                    <th className="p-2.5">টাইমস্ট্যাম্প</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {doubleEntryLedger.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-slate-500 font-sans">
                        কোনো লেজার এন্ট্রি তৈরি হয়নি
                      </td>
                    </tr>
                  ) : (
                    doubleEntryLedger.map((ledger) => (
                      <tr key={ledger.id} className="hover:bg-slate-800/40">
                        <td className="p-2.5 text-slate-400">{ledger.id}</td>
                        <td className="p-2.5 font-bold text-amber-300">{ledger.entryType}</td>
                        <td className="p-2.5 text-rose-300">{ledger.debitAccount}</td>
                        <td className="p-2.5 text-emerald-300">{ledger.creditAccount}</td>
                        <td className="p-2.5 font-bold text-white">৳{ledger.amount.toLocaleString()}</td>
                        <td className="p-2.5 text-slate-300">৳{ledger.balanceAfter.toLocaleString()}</td>
                        <td className="p-2.5 text-slate-400">{ledger.reference}</td>
                        <td className="p-2.5 text-slate-500">{new Date(ledger.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUBTAB 1: DEPOSITS APPROVAL QUEUE */}
      {activeSubTab === 'deposits' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                <span>ইনকামিং ডিপোজিট ভেরিফিকেশন কিউ</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono">
                  {filteredDeposits.length} Records
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                প্লেয়ারদের জমা দেওয়া TrxID ও বিকাশ/নগদ স্টেটমেন্ট মিলিয়ে ১-ক্লিকে ব্যালেন্স ক্রেডিট করুন
              </p>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 font-mono text-xs">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      statusFilter === st
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="TrxID / মোবাইল নম্বর খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Table of Deposit Requests */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Req ID / সময়</th>
                  <th className="py-3 px-3">প্লেয়ার</th>
                  <th className="py-3 px-3">পদ্ধতি</th>
                  <th className="py-3 px-3">পরিমাণ</th>
                  <th className="py-3 px-3">প্রেরক নম্বর</th>
                  <th className="py-3 px-3">ট্রানজেকশন আইডি (TrxID)</th>
                  <th className="py-3 px-3">স্ট্যাটাস</th>
                  <th className="py-3 px-3 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      কোনো ডিপোজিট অনুরোধ পাওয়া যায়নি (No deposit requests found)
                    </td>
                  </tr>
                ) : (
                  filteredDeposits.map((req) => {
                    const isPending = req.status === 'PENDING';
                    const isApproved = req.status === 'APPROVED';
                    const isRejected = req.status === 'REJECTED';

                    return (
                      <tr
                        key={req.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isPending ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{req.id}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(req.created_at).toLocaleTimeString()}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-slate-200 font-bold">{req.user_id}</div>
                          <div className="text-[10px] text-slate-400">{req.currency} Wallet</div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.method === 'BKASH'
                                ? 'bg-pink-900/60 text-pink-300 border border-pink-700'
                                : req.method === 'NAGAD'
                                ? 'bg-amber-900/60 text-amber-300 border border-amber-700'
                                : req.method === 'ROCKET'
                                ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                                : req.method === 'USDT'
                                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {req.method}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-sm font-black text-emerald-400">
                            ৳{req.amount.toLocaleString()}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-slate-300 font-bold">{req.sender_number}</div>
                          <div className="text-[10px] text-slate-500">Target: {req.receiver_number}</div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-black text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-amber-500/30">
                              {req.trx_id}
                            </span>
                            <button
                              onClick={() => handleCopy(req.trx_id, req.id)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                              title="Copy TrxID"
                            >
                              {copiedId === req.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {isPending && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40 animate-pulse">
                              <Clock className="w-3 h-3" />
                              <span>অপেক্ষমাণ (Pending)</span>
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>অনুমোদিত (Credited)</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40">
                              <XCircle className="w-3 h-3" />
                              <span>বাতিল (Rejected)</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                disabled={actionLoading === req.id}
                                onClick={() => handleApproveDeposit(req)}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[11px] shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                              >
                                {actionLoading === req.id ? 'অনুমোদন হচ্ছে...' : '✅ অনুমোদন'}
                              </button>

                              <button
                                disabled={actionLoading === req.id}
                                onClick={() =>
                                  setRejectReasonModal({ id: req.id, type: 'DEPOSIT' })
                                }
                                className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700 font-bold text-[11px] transition-all cursor-pointer"
                              >
                                ❌ বাতিল
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500">
                              {req.admin_note || 'Completed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. SUBTAB 2: WITHDRAWALS APPROVAL QUEUE */}
      {activeSubTab === 'withdrawals' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                <span>প্লেয়ার উইথড্র ও পেআউট কিউ</span>
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-xs font-mono">
                  {filteredWithdrawals.length} Records
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                টার্নওভার ও রোলওভার শর্ত চেক করে বিকাশ/নগদে ক্যাশআউট সম্পন্ন করুন
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Req ID / সময়</th>
                  <th className="py-3 px-3">প্লেয়ার</th>
                  <th className="py-3 px-3">পদ্ধতি</th>
                  <th className="py-3 px-3">উইথড্র পরিমাণ</th>
                  <th className="py-3 px-3">গ্রাহকের রিসিভার নম্বর</th>
                  <th className="py-3 px-3">স্ট্যাটাস</th>
                  <th className="py-3 px-3 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      কোনো উইথড্র অনুরোধ পাওয়া যায়নি (No withdrawal requests found)
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((req) => {
                    const isPending = req.status === 'PENDING';
                    const isApproved = req.status === 'APPROVED';
                    const isRejected = req.status === 'REJECTED';

                    return (
                      <tr
                        key={req.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isPending ? 'bg-rose-500/5' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{req.id}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(req.created_at).toLocaleTimeString()}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-slate-200 font-bold">{req.user_id}</div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-300">
                            {req.method}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-sm font-black text-rose-400">
                            -৳{req.amount.toLocaleString()}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-slate-200 font-bold">{req.receiver_number}</div>
                        </td>

                        <td className="py-3 px-3">
                          {isPending && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold animate-pulse">
                              <Clock className="w-3 h-3" />
                              <span>অপেক্ষমাণ (Queued)</span>
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>পেইড (Paid)</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                              <XCircle className="w-3 h-3" />
                              <span>বাতিল ও রিফান্ড</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                disabled={actionLoading === req.id}
                                onClick={async () => {
                                  setActionLoading(req.id);
                                  req.status = 'APPROVED';
                                  req.admin_note = 'Dispatched via Agent Cashout';
                                  req.updated_at = new Date().toISOString();
                                  notificationService.notifyWithdrawalApproved(
                                    req.amount,
                                    req.currency as any
                                  );
                                  soundEngine.playWinChime();
                                  setActionLoading(null);
                                  onStateMutated();
                                }}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[11px] shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                              >
                                ✅ পেআউট সম্পন্ন
                              </button>

                              <button
                                disabled={actionLoading === req.id}
                                onClick={() =>
                                  setRejectReasonModal({ id: req.id, type: 'WITHDRAWAL' })
                                }
                                className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700 font-bold text-[11px] transition-all cursor-pointer"
                              >
                                ❌ রিফান্ড ও বাতিল
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500">
                              {req.admin_note || 'Settled'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. SUBTAB 3: GATEWAY CONFIGURATION */}
      {activeSubTab === 'gateways' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div>
            <h2 className="text-lg font-black text-white flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              <span>সেমি-অটোমেটিক পেমেন্ট চ্যানেল কনফিগারেশন</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              এখানে আপনার প্ল্যাটফর্মের সক্রিয় বিকাশ মার্চেন্ট, নগদ এজেন্ট ও ক্রিপ্টো অ্যাড্রেস সেট করুন যা প্লেয়ারদের ডিপোজিট পেজে প্রদর্শিত হবে।
            </p>
          </div>

          <form onSubmit={handleSaveGateways} className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
            {/* bKash Config */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-pink-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-pink-400">বিকাশ (bKash Gateway)</span>
                <span className="text-[10px] text-slate-500">Active</span>
              </div>
              <label className="text-[11px] text-slate-400 block">Agent / Merchant Number:</label>
              <input
                type="text"
                value={gateways.bkash}
                onChange={(e) => setGateways({ ...gateways, bkash: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-pink-500 focus:outline-none"
              />
              <label className="text-[11px] text-slate-400 block pt-1">Wallet Type:</label>
              <input
                type="text"
                value={gateways.bkashType}
                onChange={(e) => setGateways({ ...gateways, bkashType: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-pink-500 focus:outline-none"
              />
            </div>

            {/* Nagad Config */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">নগদ (Nagad Gateway)</span>
                <span className="text-[10px] text-slate-500">Active</span>
              </div>
              <label className="text-[11px] text-slate-400 block">Agent Number:</label>
              <input
                type="text"
                value={gateways.nagad}
                onChange={(e) => setGateways({ ...gateways, nagad: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
              />
              <label className="text-[11px] text-slate-400 block pt-1">Wallet Type:</label>
              <input
                type="text"
                value={gateways.nagadType}
                onChange={(e) => setGateways({ ...gateways, nagadType: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Rocket Config */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400">রকেট (Rocket DBBL)</span>
                <span className="text-[10px] text-slate-500">Active</span>
              </div>
              <label className="text-[11px] text-slate-400 block">Biller Code / Number:</label>
              <input
                type="text"
                value={gateways.rocket}
                onChange={(e) => setGateways({ ...gateways, rocket: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* USDT TRC20 Config */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">USDT Crypto (TRC-20)</span>
                <span className="text-[10px] text-slate-500">Cold Vault</span>
              </div>
              <label className="text-[11px] text-slate-400 block">Deposit TRC-20 Address:</label>
              <input
                type="text"
                value={gateways.usdt}
                onChange={(e) => setGateways({ ...gateways, usdt: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-emerald-500 focus:outline-none font-mono"
              />
            </div>

            <div className="col-span-1 md:col-span-2 pt-2 flex items-center justify-between">
              {gatewaySavedToast && (
                <span className="text-emerald-400 text-xs font-bold flex items-center space-x-1 animate-bounce">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>গেটওয়ে সেটিংস সফলভাবে আপডেট হয়েছে (Saved)</span>
                </span>
              )}
              <button
                type="submit"
                className="ml-auto px-6 py-3 rounded-2xl bg-amber-500 hover:bg-yellow-400 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/20 transition-all cursor-pointer"
              >
                💾 সেভ গেটওয়ে সেটিংস (Save Gateways)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. SUBTAB 4: USERS & BALANCE ADJUSTMENTS */}
      {activeSubTab === 'users' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">নিবন্ধিত প্লেয়ার ও অ্যাকাউন্ট ব্যালেন্স</h2>
              <p className="text-xs text-slate-400 font-mono">
                সরাসরি প্লেয়ারদের ওয়ালেট ব্যালেন্স যোগ/কর্তন করুন এবং স্ট্যাটাস ম্যানেজ করুন
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">User ID</th>
                  <th className="py-3 px-3">ইউজারনেম</th>
                  <th className="py-3 px-3">কারেন্সি</th>
                  <th className="py-3 px-3">রিয়েল ব্যালেন্স</th>
                  <th className="py-3 px-3">বোনাস ব্যালেন্স</th>
                  <th className="py-3 px-3">স্ট্যাটাস</th>
                  <th className="py-3 px-3 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allUsers.map((u) => {
                  const userWallet = allWallets.find((w) => w.user_id === u.id);
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-bold text-slate-400">{u.id}</td>
                      <td className="py-3 px-3 font-black text-white">{u.username}</td>
                      <td className="py-3 px-3 font-bold text-amber-300">{u.currency}</td>
                      <td className="py-3 px-3 font-black text-emerald-400">
                        {u.currency === 'BDT' ? '৳' : '$'}
                        {userWallet ? userWallet.real_balance.toLocaleString() : '0.00'}
                      </td>
                      <td className="py-3 px-3 font-bold text-yellow-300">
                        {u.currency === 'BDT' ? '৳' : '$'}
                        {userWallet ? userWallet.bonus_balance.toLocaleString() : '0.00'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setAdjustUserModal(u)}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-bold cursor-pointer"
                        >
                          ⚖️ ব্যালেন্স অ্যাডজাস্ট
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. SUBTAB 5: REAL API ARCHITECTURE & DEPLOYMENT GUIDE */}
      {activeSubTab === 'api_guide' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 font-mono">
          <div>
            <h2 className="text-lg font-black text-white flex items-center space-x-2">
              <Terminal className="w-5 h-5 text-cyan-400" />
              <span>Production API Endpoints &amp; Integration Blueprint</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              পরবর্তী সময়ে রিয়েল প্রোভাইডার (PG Soft, Pragmatic, Spribe) এবং রিয়েল পেমেন্ট গেটওয়ে যুক্ত করার আর্কিটেকচার
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seamless Wallet Endpoints */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-cyan-500/30 space-y-3">
              <div className="text-xs font-bold text-cyan-400 flex items-center space-x-1.5">
                <Zap className="w-4 h-4" />
                <span>1. B2B Seamless Aggregator Endpoints (&lt;4s SLA)</span>
              </div>
              <ul className="space-y-2 text-[11px] text-slate-300">
                <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <strong className="text-emerald-400">POST /api/seamless/balance</strong>
                  <div className="text-slate-400 text-[10px]">Returns current ACID wallet balance with HMAC SHA-256</div>
                </li>
                <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <strong className="text-rose-400">POST /api/seamless/bet</strong>
                  <div className="text-slate-400 text-[10px]">Row-Level Lock (FOR UPDATE) balance deduction &amp; Idempotency</div>
                </li>
                <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <strong className="text-yellow-400">POST /api/seamless/win</strong>
                  <div className="text-slate-400 text-[10px]">Settles game payout, increments player wallet &amp; logs ledger</div>
                </li>
                <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <strong className="text-blue-400">POST /api/seamless/refund</strong>
                  <div className="text-slate-400 text-[10px]">Rolls back bet on network timeouts with transactional safety</div>
                </li>
              </ul>
            </div>

            {/* Local Fiat Payment Gateways */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-amber-500/30 space-y-3">
              <div className="text-xs font-bold text-amber-400 flex items-center space-x-1.5">
                <CreditCard className="w-4 h-4" />
                <span>2. Local Fiat &amp; Crypto Webhooks</span>
              </div>
              <ul className="space-y-2 text-[11px] text-slate-300">
                <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <strong className="text-pink-400">POST /api/cashier/bkash/ipn</strong>
                  <div className="text-slate-400 text-[10px]">Instant Payment Notification for bKash Merchant API</div>
                </li>
                <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <strong className="text-amber-400">POST /api/cashier/nagad/callback</strong>
                  <div className="text-slate-400 text-[10px]">RSA-encrypted signature callback for Nagad PGW</div>
                </li>
                <li className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <strong className="text-emerald-400">POST /api/cashier/crypto/webhook</strong>
                  <div className="text-slate-400 text-[10px]">TRC-20 Blockchain transaction confirmation listener</div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectReasonModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 font-mono">
            <h3 className="text-base font-black text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>অনুরোধ বাতিল করার কারণ লিখুন</span>
            </h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Rejection Reason:</label>
              <textarea
                value={rejectReasonText}
                onChange={(e) => setRejectReasonText(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setRejectReasonModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                নিশ্চিত বাতিল করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ADJUST USER BALANCE MODAL */}
      {adjustUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 font-mono">
            <h3 className="text-base font-black text-white flex items-center space-x-2">
              <Coins className="w-5 h-5 text-amber-400" />
              <span>ব্যালেন্স সমন্বয়: {adjustUserModal.username}</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">অ্যাকশন টাইপ:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADD')}
                    className={`py-2 rounded-xl text-xs font-bold ${
                      adjustType === 'ADD'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-950 text-slate-400'
                    }`}
                  >
                    + যোগ করুন (Credit)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('DEDUCT')}
                    className={`py-2 rounded-xl text-xs font-bold ${
                      adjustType === 'DEDUCT'
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-950 text-slate-400'
                    }`}
                  >
                    - কর্তন করুন (Debit)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  পরিমাণ ({adjustUserModal.currency}):
                </label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">অডিট কারণ (Audit Reason):</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setAdjustUserModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                onClick={handleAdjustBalance}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-yellow-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                সমন্বয় সম্পন্ন করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
