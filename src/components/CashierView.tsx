/**
 * @file CashierView.tsx
 * @description Premium Mobile Deposit & Cashier Vault for PLAY369.
 * 
 * Design & Integrity Standards (TASK C1.1):
 *  - Zero floating-point conversions on authoritative money values
 *  - Exact decimal strings and scale-4 BigInt comparisons end-to-end
 *  - No hardcoded providerAvailable=true, providerConfigured=true, or methodAvailable=true
 *  - Channel availability remains UNKNOWN/PENDING until runtime StarPay configuration is provisioned
 *  - No invented claims (0% fee, fake min/max limits omitted unless authoritatively configured)
 *  - Empty initial state for sender phone and withdrawal recipient (placeholders only)
 *  - All interactive touch targets >= 48px
 *  - Preserves authenticated ownership, Task 6.1-6.1.5 guarantees, and Emerald + Gold theme
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Receipt,
  RotateCw,
  Info,
  RefreshCw,
  AlertTriangle,
  Lock,
  Wallet,
  ArrowRight
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import {
  PaymentProviderId,
  PaymentMethod,
  DepositIntent,
  WithdrawalRecord,
  DoubleEntryLedgerEntry
} from '../server/types/paymentGateway';
import { paymentGatewayEngine } from '../services/paymentGatewayEngine';
import { soundEngine } from '../services/soundEngine';
import { useWalletGame } from '../contexts/WalletGameContext';
import { toScale4 } from '../server/utils/paymentAmount';
import { motion } from 'framer-motion';

interface CashierViewProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onLedgerMutated: () => void;
  onClose?: () => void;
}

export interface PaymentChannelMeta {
  provider: PaymentProviderId;
  method: PaymentMethod;
  name: string;
  banglaName: string;
  accentColor: string;
  icon: string;
  fee?: string;
  minBDT?: string;
  maxBDT?: string;
  // StarPay ready lifecycle flags: Default to false/pending until real runtime configuration exists
  providerConfigured?: boolean;
  providerAvailable?: boolean;
  methodAvailable?: boolean;
  maintenanceMode?: boolean;
}

/**
 * Exact decimal money formatter for financial UI display.
 * Formats integer part with commas while strictly preserving all fractional digits
 * without converting to JS floating point numbers.
 * e.g. "0.0516" -> "0.0516"
 *      "2500" -> "2,500"
 *      "100.0000" -> "100.0000"
 */
export function formatExactMoneyStr(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0.00';
  const str = String(val).trim();
  if (!str) return '0.00';

  const isNeg = str.startsWith('-');
  const cleanStr = isNeg ? str.slice(1) : str;
  const parts = cleanStr.split('.');
  const intPart = parts[0] || '0';
  const fracPart = parts.length > 1 ? parts[1] : null;

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (fracPart !== null) {
    return `${isNeg ? '-' : ''}${formattedInt}.${fracPart}`;
  }
  return `${isNeg ? '-' : ''}${formattedInt}`;
}

export function hasLockedBalance(wallet?: WalletEntity): boolean {
  if (!wallet || wallet.locked_balance === undefined || wallet.locked_balance === null) return false;
  try {
    const units = toScale4(String(wallet.locked_balance));
    return units > 0n;
  } catch {
    return false;
  }
}

export const PAYMENT_CHANNELS: PaymentChannelMeta[] = [
  {
    provider: 'bkash',
    method: 'BKASH',
    name: 'bKash',
    banglaName: 'বিকাশ',
    accentColor: '#E2136E',
    icon: 'bK',
    providerAvailable: false,
    providerConfigured: false,
    methodAvailable: false
  },
  {
    provider: 'nagad',
    method: 'NAGAD',
    name: 'Nagad',
    banglaName: 'নগদ',
    accentColor: '#F7941D',
    icon: 'NG',
    providerAvailable: false,
    providerConfigured: false,
    methodAvailable: false
  },
  {
    provider: 'rocket',
    method: 'ROCKET',
    name: 'Rocket',
    banglaName: 'রকেট',
    accentColor: '#8C3494',
    icon: 'RK',
    providerAvailable: false,
    providerConfigured: false,
    methodAvailable: false
  },
  {
    provider: 'bank_transfer',
    method: 'BANK_TRANSFER',
    name: 'Bank Transfer',
    banglaName: 'ব্যাংক ট্রান্সফার',
    accentColor: '#00A859',
    icon: 'BT',
    providerAvailable: false,
    providerConfigured: false,
    methodAvailable: false
  },
  {
    provider: 'card_payment',
    method: 'CARD_PAYMENT',
    name: 'Card',
    banglaName: 'কার্ড পেমেন্ট',
    accentColor: '#1A1F71',
    icon: 'CC',
    providerAvailable: false,
    providerConfigured: false,
    methodAvailable: false
  },
  {
    provider: 'usdt_crypto',
    method: 'USDT',
    name: 'USDT',
    banglaName: 'ক্রিপ্টো (TRC-20)',
    accentColor: '#26A17B',
    icon: 'USDT',
    providerAvailable: false,
    providerConfigured: false,
    methodAvailable: false
  }
];

export const CashierView: React.FC<CashierViewProps> = ({
  currentUser,
  currentWallet,
  currency,
  onLedgerMutated
}) => {
  const { showToast, refreshState } = useWalletGame();

  // Primary Navigation Modes: DEPOSIT and WITHDRAWAL (with HISTORY secondary view)
  const [activeMode, setActiveMode] = useState<'DEPOSIT' | 'WITHDRAWAL' | 'HISTORY'>('DEPOSIT');
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderId>('bkash');

  // Exact-String Amount Contract Preservation
  const [depositAmountStr, setDepositAmountStr] = useState<string>(currency === 'BDT' ? '2500' : '25');
  const [senderNumber, setSenderNumber] = useState<string>('');
  const [depositStep, setDepositStep] = useState<'AMOUNT' | 'PAYMENT' | 'VERIFYING' | 'SUCCESS'>('AMOUNT');
  const [trxIdInput, setTrxIdInput] = useState<string>('');
  const [activeIntent, setActiveIntent] = useState<DepositIntent | null>(null);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number>(900); // 15 mins
  const [isCreatingIntent, setIsCreatingIntent] = useState<boolean>(false);

  // Verification Animation States
  const [verificationProgressStep, setVerificationProgressStep] = useState<number>(0);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Withdrawal Form States: Empty initial recipient to prevent fake prefilling
  const [withdrawAmountStr, setWithdrawAmountStr] = useState<string>(currency === 'BDT' ? '5000' : '50');
  const [withdrawRecipient, setWithdrawRecipient] = useState<string>('');
  const [withdrawRecipientName, setWithdrawRecipientName] = useState<string>(currentUser.username || '');
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);

  // Data Lists & Copy Alerts
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [depositIntents, setDepositIntents] = useState<DepositIntent[]>([]);
  const [withdrawalRecords, setWithdrawalRecords] = useState<WithdrawalRecord[]>([]);
  const [, setLedgerEntries] = useState<DoubleEntryLedgerEntry[]>([]);

  const activeChannel = PAYMENT_CHANNELS.find((c) => c.provider === selectedProvider) || PAYMENT_CHANNELS[0];
  const quickPresets = currency === 'BDT' ? ['500', '1000', '2500', '5000', '10000', '25000'] : ['10', '25', '50', '100', '250', '500'];

  // Sync data with Payment Gateway Engine
  const refreshEngineData = () => {
    setDepositIntents(paymentGatewayEngine.getDepositIntents(currentUser.id));
    setWithdrawalRecords(paymentGatewayEngine.getWithdrawalRecords(currentUser.id));
    setLedgerEntries(paymentGatewayEngine.getDoubleEntryLedger());
  };

  useEffect(() => {
    refreshEngineData();
    const unsub = paymentGatewayEngine.subscribe(() => {
      refreshEngineData();
      onLedgerMutated();
    });
    return () => unsub();
  }, [currentUser.id]);

  // Timer countdown for active intent
  useEffect(() => {
    if (depositStep === 'PAYMENT' && timeRemainingSec > 0) {
      const timer = setInterval(() => {
        setTimeRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [depositStep, timeRemainingSec]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    soundEngine.playClick(950);
    showToast(`${label} কপি করা হয়েছে`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // --------------------------------------------------------------------------
  // Step 1: Create Deposit Intent & Assign Pool Destination
  // Zero JS float conversion: validates exact decimal string & scale-4 BigInt
  // --------------------------------------------------------------------------
  const handleCreateDepositIntent = () => {
    const rawVal = depositAmountStr.trim();

    // Basic UI format validation without converting to JS float or silent rounding
    if (!rawVal || !/^\d+(\.\d{1,4})?$/.test(rawVal)) {
      showToast('অনুগ্রহ করে সঠিক পরিমাণ লিখুন (যেমন 2500 বা 2500.50)');
      return;
    }

    try {
      const minorUnits = toScale4(rawVal);
      if (minorUnits <= 0n) {
        showToast('অনুগ্রহ করে শূন্যের চেয়ে বেশি পরিমাণ লিখুন');
        return;
      }
    } catch (err: any) {
      showToast(err.message || 'অনুগ্রহ করে সঠিক পরিমাণ লিখুন');
      return;
    }

    setIsCreatingIntent(true);
    soundEngine.playClick(1000);

    try {
      const intent = paymentGatewayEngine.createDepositIntent({
        userId: currentUser.id,
        username: currentUser.username,
        provider: selectedProvider,
        method: activeChannel.method,
        amount: rawVal,
        currency: currentUser.currency as 'BDT' | 'USD',
        idempotencyKey: `DEP-INTENT-${Date.now()}`
      });

      setActiveIntent(intent);
      setDepositStep('PAYMENT');
      setTimeRemainingSec(900);
      showToast(`ডিপোজিট রেফারেন্স তৈরি হয়েছে: ${intent.id}`);
    } catch (err: any) {
      showToast(err.message || 'ডিপোজিট রিকোয়েস্ট তৈরি করা যায়নি');
    } finally {
      setIsCreatingIntent(false);
    }
  };

  // --------------------------------------------------------------------------
  // Step 2 & 3: Submit TrxID & Run Authoritative Verification
  // --------------------------------------------------------------------------
  const handleVerifyTrxId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIntent) return;

    const cleanTrx = trxIdInput.trim().toUpperCase();
    if (!cleanTrx || cleanTrx.length < 6) {
      setVerificationError('সঠিক ৮-১০ অক্ষরের ট্রানজেকশন আইডি (TrxID) লিখুন');
      soundEngine.playClick(400);
      return;
    }

    setVerificationError(null);
    setDepositStep('VERIFYING');
    setVerificationProgressStep(1);

    soundEngine.playClick(1100);

    setTimeout(() => setVerificationProgressStep(2), 600);
    setTimeout(() => setVerificationProgressStep(3), 1200);
    setTimeout(() => setVerificationProgressStep(4), 1800);

    setTimeout(async () => {
      try {
        const res = await paymentGatewayEngine.verifyAndCreditDeposit({
          depositId: activeIntent.id,
          trxId: cleanTrx,
          senderNumber: senderNumber
        });

        setActiveIntent(res.depositIntent);
        setDepositStep('SUCCESS');
        showToast(res.message);
        refreshState();
        onLedgerMutated();
      } catch (err: any) {
        setVerificationError(err.message || 'ভেরিফিকেশন সম্পন্ন করা যায়নি।');
        setDepositStep('PAYMENT');
        soundEngine.playClick(350);
      }
    }, 2200);
  };

  // --------------------------------------------------------------------------
  // Controlled Withdrawal Request Submission (Scale-4 BigInt precision)
  // --------------------------------------------------------------------------
  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawVal = withdrawAmountStr.trim();

    if (!rawVal || !/^\d+(\.\d{1,4})?$/.test(rawVal)) {
      showToast('অনুগ্রহ করে সঠিক উইথড্রয়াল পরিমাণ লিখুন');
      return;
    }

    try {
      const requestedUnits = toScale4(rawVal);
      if (requestedUnits <= 0n) {
        showToast('অনুগ্রহ করে শূন্যের চেয়ে বেশি পরিমাণ লিখুন');
        return;
      }

      const availableUnits = currentWallet ? toScale4(String(currentWallet.real_balance)) : 0n;
      if (requestedUnits > availableUnits) {
        showToast('পর্যাপ্ত ব্যালেন্স নেই!');
        soundEngine.playClick(400);
        return;
      }
    } catch (err: any) {
      showToast(err.message || 'অনুগ্রহ করে সঠিক উইথড্রয়াল পরিমাণ লিখুন');
      return;
    }

    setIsWithdrawing(true);
    soundEngine.playClick(1000);

    try {
      await paymentGatewayEngine.requestWithdrawal({
        userId: currentUser.id,
        username: currentUser.username,
        provider: selectedProvider,
        method: activeChannel.method,
        amount: rawVal,
        currency: currentUser.currency as 'BDT' | 'USD',
        recipientAccount: withdrawRecipient,
        recipientName: withdrawRecipientName,
        idempotencyKey: `WD-REQ-${Date.now()}`
      });

      showToast(`উইথড্রয়াল রিকোয়েস্ট সফল! ৳${formatExactMoneyStr(rawVal)} সংরক্ষিত হয়েছে এবং ক্যাশ-আউট প্রক্রিয়াধীন।`);
      refreshState();
      onLedgerMutated();
      setActiveMode('HISTORY');
    } catch (err: any) {
      showToast(`ত্রুটি: ${err.message}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      id="play369-cashier-root"
      className="w-full max-w-4xl mx-auto px-3 sm:px-4 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom,16px))] font-sans overflow-x-hidden text-slate-100"
    >
      {/* ========================================================================= */}
      {/* 1. CASHIER HEADER: STREAMLINED & AUTHORITATIVE */}
      {/* ========================================================================= */}
      <header
        id="play369-cashier-header"
        className="relative rounded-2xl bg-gradient-to-b from-[#042416] to-[#02180e] border border-emerald-800/60 p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.6)] mb-4"
      >
        <div className="flex items-center justify-between gap-3">
          {/* Brand & Subtitle */}
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-wide font-sans flex items-center gap-2">
              <span className="text-amber-400">PLAY369</span>
              <span>CASHIER</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-emerald-300/80 font-medium mt-0.5">
              Deposit & Withdrawal
            </p>
          </div>

          {/* Quick History Button (>=48px touch target) */}
          <button
            type="button"
            id="play369-cashier-history-toggle"
            onClick={() => {
              setActiveMode((prev) => (prev === 'HISTORY' ? 'DEPOSIT' : 'HISTORY'));
              soundEngine.playClick(900);
            }}
            className={`min-h-[48px] h-[48px] px-3.5 py-2 rounded-xl border text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'HISTORY'
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-sm'
                : 'bg-emerald-950/80 text-emerald-200 border-emerald-700/60 hover:border-amber-400/50'
            }`}
            aria-label="Transaction History"
          >
            <Receipt className="w-4 h-4" />
            <span className="hidden xs:inline">হিস্ট্রি</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/30 font-bold">
              {depositIntents.length + withdrawalRecords.length}
            </span>
          </button>
        </div>

        {/* Available Balance Card - Exact decimal preservation */}
        <div
          id="play369-authoritative-balance-card"
          className="mt-3.5 pt-3.5 border-t border-emerald-800/60 flex items-center justify-between gap-3 bg-[#02130b]/70 rounded-xl p-3 border border-emerald-900/80"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/60 border border-emerald-700/60 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-300/80 block font-mono">
                উপলব্ধ ব্যালেন্স (Available Balance)
              </span>
              <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                {currency === 'BDT' ? '৳' : '$'}
                {currentWallet
                  ? formatExactMoneyStr(currentWallet.real_balance)
                  : '0.00'}
              </span>
            </div>
          </div>

          {currentWallet && hasLockedBalance(currentWallet) && (
            <div className="border-l border-emerald-800/80 pl-3 text-right">
              <span className="text-[10px] uppercase font-bold text-amber-400/90 block font-mono flex items-center justify-end gap-1">
                <Lock className="w-3 h-3 text-amber-400" />
                সংরক্ষিত
              </span>
              <span className="text-xs sm:text-sm font-black text-amber-300 font-mono">
                {currency === 'BDT' ? '৳' : '$'}
                {formatExactMoneyStr(currentWallet.locked_balance)}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. PRIMARY TABS: DEPOSIT / WITHDRAW (>=48px touch target, warm gold / deep emerald) */}
      {/* ========================================================================= */}
      <div
        id="play369-cashier-mode-tabs"
        className="grid grid-cols-2 gap-2 mb-4"
        role="tablist"
      >
        {/* Deposit Tab */}
        <button
          type="button"
          id="play369-tab-deposit"
          role="tab"
          aria-selected={activeMode === 'DEPOSIT'}
          onClick={() => {
            setActiveMode('DEPOSIT');
            soundEngine.playClick(900);
          }}
          className={`min-h-[48px] h-[48px] rounded-xl font-mono text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeMode === 'DEPOSIT'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-[0_2px_12px_rgba(245,158,11,0.3)] border border-amber-300'
              : 'bg-[#031d12] text-emerald-300 hover:text-white border border-emerald-800/80 hover:bg-[#05281a]'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>ডিপোজিট</span>
          <span className="text-[11px] opacity-80 font-medium hidden xs:inline">Deposit</span>
        </button>

        {/* Withdraw Tab */}
        <button
          type="button"
          id="play369-tab-withdraw"
          role="tab"
          aria-selected={activeMode === 'WITHDRAWAL'}
          onClick={() => {
            setActiveMode('WITHDRAWAL');
            soundEngine.playClick(900);
          }}
          className={`min-h-[48px] h-[48px] rounded-xl font-mono text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeMode === 'WITHDRAWAL'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-[0_2px_12px_rgba(245,158,11,0.3)] border border-amber-300'
              : 'bg-[#031d12] text-emerald-300 hover:text-white border border-emerald-800/80 hover:bg-[#05281a]'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>উইথড্রয়াল</span>
          <span className="text-[11px] opacity-80 font-medium hidden xs:inline">Withdraw</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. DEPOSIT FLOW (PREMIUM MOBILE DEPOSIT EXPERIENCE) */}
      {/* ========================================================================= */}
      {activeMode === 'DEPOSIT' && (
        <div className="space-y-4">
          {/* PAYMENT METHOD SELECTOR: 2-Column Mobile Grid, Equal Height */}
          <section id="play369-payment-methods-section" aria-label="Payment Methods">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-emerald-200 font-sans">
                পেমেন্ট মেথড নির্বাচন করুন
              </span>
              <span className="text-[10px] font-mono text-amber-400">
                {activeChannel.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
              {PAYMENT_CHANNELS.map((ch) => {
                const isSelected = selectedProvider === ch.provider;
                const isMaintenance = !!ch.maintenanceMode;

                return (
                  <button
                    key={ch.provider}
                    type="button"
                    id={`play369-channel-${ch.provider}`}
                    disabled={isMaintenance}
                    onClick={() => {
                      if (isMaintenance) return;
                      setSelectedProvider(ch.provider);
                      setDepositStep('AMOUNT');
                      setActiveIntent(null);
                      soundEngine.playClick(900);
                    }}
                    className={`min-h-[84px] h-[84px] p-2.5 sm:p-3 rounded-xl border text-left flex flex-col justify-between transition-all relative overflow-hidden cursor-pointer ${
                      isSelected
                        ? 'bg-[#052c1b] border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                        : !isMaintenance
                        ? 'bg-[#031d12]/90 border-emerald-800/70 hover:border-emerald-600/90 hover:bg-[#042416]'
                        : 'bg-[#02140c]/50 border-emerald-950 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className="w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center border"
                        style={{
                          backgroundColor: `${ch.accentColor}20`,
                          borderColor: `${ch.accentColor}60`,
                          color: ch.accentColor === '#1A1F71' ? '#60A5FA' : ch.accentColor
                        }}
                      >
                        {ch.icon}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-white text-xs leading-tight font-sans">
                        {ch.name}
                      </div>
                      <div className="text-[10px] text-emerald-300/80 font-mono mt-0.5 leading-none">
                        {ch.providerConfigured && ch.providerAvailable ? 'সক্রিয়' : 'অপেক্ষমাণ'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* STEP 1: AMOUNT SELECTION & SENDER INPUT */}
          {depositStep === 'AMOUNT' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-emerald-800/70 bg-gradient-to-b from-[#042416] via-[#031d12] to-[#02180e] p-4 sm:p-5 space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
            >
              {/* Preset Chips: ৳500, ৳1,000, ৳2,500, ৳5,000, ৳10,000, ৳25,000 (>=48px touch target) */}
              <div>
                <label className="text-xs font-bold text-emerald-200 block mb-2 font-sans">
                  ডিপোজিট পরিমাণ (Deposit Amount)
                </label>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {quickPresets.map((preset) => {
                    const isSelected = depositAmountStr === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        id={`play369-preset-${preset}`}
                        onClick={() => {
                          setDepositAmountStr(preset);
                          soundEngine.playClick(850);
                        }}
                        className={`min-h-[48px] h-[48px] rounded-xl font-mono text-xs font-black transition-all flex items-center justify-center cursor-pointer border ${
                          isSelected
                            ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 border-amber-300 shadow-md scale-[1.02]'
                            : 'bg-[#02190f] border-emerald-800/80 text-emerald-200 hover:border-emerald-600/80 hover:bg-[#032014]'
                        }`}
                      >
                        {currency === 'BDT' ? '৳' : '$'}
                        {formatExactMoneyStr(preset)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Exact-String Amount Input */}
              <div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-amber-400 text-base">
                    {currency === 'BDT' ? '৳' : '$'}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    id="play369-custom-deposit-amount"
                    value={depositAmountStr}
                    onChange={(e) => {
                      // Preserve clean string numeric format
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      setDepositAmountStr(val);
                    }}
                    className="w-full bg-[#02130b] border border-emerald-700/80 focus:border-amber-400 rounded-xl py-3 pl-9 pr-3 text-white font-mono text-lg font-bold focus:outline-none transition-colors min-h-[50px]"
                    placeholder="2500"
                    aria-label="Custom Deposit Amount"
                  />
                </div>
              </div>

              {/* Sender Phone / Account Input - Initial value is empty, placeholder only */}
              <div>
                <label className="text-xs font-bold text-emerald-200 block mb-1.5 font-sans">
                  প্রেরক একাউন্ট নম্বর (Sender Phone / Account)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    id="play369-sender-account-input"
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    className="w-full bg-[#02130b] border border-emerald-700/80 focus:border-amber-400 rounded-xl py-2.5 px-3.5 text-white font-mono text-base sm:text-sm font-semibold focus:outline-none transition-colors min-h-[48px]"
                    placeholder="01XXXXXXXXX"
                    aria-label="Sender Phone Number"
                  />
                </div>
              </div>

              {/* Primary Deposit CTA: >=52px height, warm gold */}
              <button
                type="button"
                id="play369-create-deposit-cta"
                disabled={isCreatingIntent}
                onClick={handleCreateDepositIntent}
                className="w-full min-h-[52px] h-[52px] rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-mono font-black text-sm sm:text-base tracking-wide shadow-[0_4px_16px_rgba(245,158,11,0.25)] hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCreatingIntent ? (
                  <RotateCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>ডিপোজিট রিকোয়েস্ট তৈরি করুন</span>
                    <ArrowRight className="w-4 h-4 text-slate-950" />
                  </>
                )}
              </button>

              {/* Deposit Flow Status: 3-step factual progression */}
              <div
                id="play369-deposit-flow-lifecycle"
                className="pt-2 border-t border-emerald-800/60"
              >
                <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px] text-emerald-300/80">
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/40 flex items-center justify-center font-bold">
                      ১
                    </span>
                    <span>রিকোয়েস্ট</span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-900/60 text-emerald-400 border border-emerald-700/60 flex items-center justify-center font-bold">
                      ২
                    </span>
                    <span>প্রোভাইডার ভেরিফিকেশন</span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-900/60 text-emerald-400 border border-emerald-700/60 flex items-center justify-center font-bold">
                      ৩
                    </span>
                    <span>ওয়ালেট ক্রেডিট</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: PAYMENT INSTRUCTIONS & TRXID SUBMISSION */}
          {depositStep === 'PAYMENT' && activeIntent && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-emerald-800/80 bg-gradient-to-b from-[#042416] via-[#031d12] to-[#02180e] p-4 sm:p-5 space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
            >
              {/* Reference & Expiration Header */}
              <div className="flex items-center justify-between gap-2 border-b border-emerald-800/60 pb-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-amber-400 block">
                    রেফারেন্স কোড
                  </span>
                  <span className="text-sm sm:text-base font-black text-white font-mono">
                    {activeIntent.id}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-[#02130b] border border-amber-400/40 px-2.5 py-1 rounded-lg font-mono text-xs text-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{formatTimer(timeRemainingSec)}</span>
                </div>
              </div>

              {/* Assigned Destination Account Box */}
              <div className="bg-[#02130b] border border-emerald-700/80 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-emerald-300">
                  <span>নির্ধারিত {activeChannel.name} একাউন্ট ({activeIntent.destinationAccount.accountType}):</span>
                  <span className="text-[10px] font-mono text-amber-300">
                    ৳{formatExactMoneyStr(activeIntent.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 bg-[#042416] p-3 rounded-lg border border-emerald-800">
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400 truncate">
                      {activeIntent.destinationAccount.accountName}
                    </div>
                    <div className="text-lg sm:text-xl font-black text-white font-mono tracking-wider">
                      {activeIntent.destinationAccount.accountNumber}
                    </div>
                  </div>

                  <button
                    type="button"
                    id="play369-copy-account-btn"
                    onClick={() => handleCopy(activeIntent.destinationAccount.accountNumber, 'একাউন্ট নম্বর')}
                    className="min-h-[48px] px-3.5 py-2.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-mono font-black hover:bg-yellow-300 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedText === 'একাউন্ট নম্বর' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedText === 'একাউন্ট নম্বর' ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                  </button>
                </div>
              </div>

              {/* Payment Instructions */}
              <div className="bg-[#02130b]/60 border border-emerald-900 rounded-xl p-3 text-xs text-emerald-200/90 font-sans space-y-1.5">
                <div className="font-bold text-amber-300 flex items-center gap-1 text-xs">
                  <Info className="w-3.5 h-3.5" />
                  <span>পেমেন্ট নির্দেশিকা:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-300">
                  {activeIntent.destinationAccount.instructions.map((inst, i) => (
                    <li key={i}>{inst}</li>
                  ))}
                </ol>
              </div>

              {/* TrxID Input Form */}
              <form onSubmit={handleVerifyTrxId} className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-emerald-200 block mb-1 font-sans">
                    ট্রানজেকশন আইডি (TrxID) লিখুন *
                  </label>
                  <input
                    type="text"
                    required
                    id="play369-trxid-input"
                    autoCapitalize="characters"
                    value={trxIdInput}
                    onChange={(e) => setTrxIdInput(e.target.value)}
                    className="w-full bg-[#02130b] border border-emerald-700/80 focus:border-amber-400 rounded-xl py-2.5 px-3.5 text-white font-mono text-base font-bold uppercase tracking-wider focus:outline-none min-h-[48px]"
                    placeholder="e.g. BL92A81K09"
                  />
                  {verificationError && (
                    <div className="mt-1.5 text-xs text-red-400 font-mono bg-red-950/40 border border-red-800/60 p-2 rounded-lg flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{verificationError}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositStep('AMOUNT')}
                    className="min-h-[48px] h-[48px] rounded-xl bg-[#02130b] border border-emerald-800 text-emerald-300 font-mono text-xs font-bold hover:bg-[#032014] cursor-pointer"
                  >
                    ব্যাকে যান
                  </button>

                  <button
                    type="submit"
                    id="play369-submit-trxid-btn"
                    className="min-h-[48px] h-[48px] rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-mono font-black text-xs sm:text-sm shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>ভেরিফাই করুন</span>
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* STEP 3: VERIFICATION ENGINE ANIMATION */}
          {depositStep === 'VERIFYING' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-emerald-800 bg-[#02180e] p-6 text-center space-y-4 shadow-xl"
            >
              <div className="relative w-14 h-14 mx-auto">
                <div className="w-full h-full rounded-full border-3 border-emerald-800 border-t-amber-400 animate-spin" />
                <ShieldCheck className="w-6 h-6 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white font-sans">
                  পেমেন্ট যাচাই করা হচ্ছে...
                </h3>
                <p className="text-xs text-emerald-300/80 font-mono mt-0.5">
                  TrxID: {trxIdInput.toUpperCase()}
                </p>
              </div>

              <div className="max-w-xs mx-auto space-y-2 font-mono text-xs text-left">
                <div className={`p-2 rounded-lg border flex items-center justify-between ${
                  verificationProgressStep >= 1 ? 'bg-emerald-950 border-emerald-700 text-emerald-200' : 'border-emerald-900 text-slate-500'
                }`}>
                  <span>১. TrxID ফরম্যাট যাচাই</span>
                  {verificationProgressStep >= 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <RotateCw className="w-3.5 h-3.5 animate-spin text-slate-500" />}
                </div>

                <div className={`p-2 rounded-lg border flex items-center justify-between ${
                  verificationProgressStep >= 2 ? 'bg-emerald-950 border-emerald-700 text-emerald-200' : 'border-emerald-900 text-slate-500'
                }`}>
                  <span>২. ডুপ্লিকেট TrxID রোধ চেক</span>
                  {verificationProgressStep >= 2 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <RotateCw className="w-3.5 h-3.5 animate-spin text-slate-500" />}
                </div>

                <div className={`p-2 rounded-lg border flex items-center justify-between ${
                  verificationProgressStep >= 3 ? 'bg-emerald-950 border-emerald-700 text-emerald-200' : 'border-emerald-900 text-slate-500'
                }`}>
                  <span>৩. প্রোভাইডার কনফার্মেশন</span>
                  {verificationProgressStep >= 3 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <RotateCw className="w-3.5 h-3.5 animate-spin text-slate-500" />}
                </div>

                <div className={`p-2 rounded-lg border flex items-center justify-between ${
                  verificationProgressStep >= 4 ? 'bg-emerald-950 border-emerald-700 text-emerald-200' : 'border-emerald-900 text-slate-500'
                }`}>
                  <span>৪. ওয়ালেট সেটেলমেন্ট</span>
                  {verificationProgressStep >= 4 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <RotateCw className="w-3.5 h-3.5 animate-spin text-slate-500" />}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: SUCCESS RECEIPT */}
          {depositStep === 'SUCCESS' && activeIntent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-emerald-600 bg-gradient-to-b from-[#042416] via-[#031d12] to-[#02180e] p-6 text-center space-y-4 shadow-xl"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-amber-400">ডিপোজিট সফল</span>
                <h2 className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
                  ৳{formatExactMoneyStr(activeIntent.amount)} যোগ হয়েছে
                </h2>
                <p className="text-xs text-emerald-300 mt-0.5">
                  আপনার ওয়ালেটে ব্যালেন্স সফলভাবে আপডেট হয়েছে।
                </p>
              </div>

              <div className="bg-[#02130b] p-3 rounded-xl border border-emerald-800 max-w-sm mx-auto font-mono text-xs space-y-1.5 text-left">
                <div className="flex justify-between text-slate-400">
                  <span>রেফারেন্স:</span>
                  <span className="text-white font-bold">{activeIntent.id}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>TrxID:</span>
                  <span className="text-amber-300 font-bold">{activeIntent.providerTransactionId}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>মেথড:</span>
                  <span className="text-white">{activeIntent.provider.toUpperCase()}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDepositStep('AMOUNT');
                    setActiveIntent(null);
                    setTrxIdInput('');
                    soundEngine.playClick(900);
                  }}
                  className="min-h-[48px] h-[48px] px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-mono font-black text-xs hover:bg-yellow-300 cursor-pointer"
                >
                  নতুন ডিপোজিট
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('HISTORY')}
                  className="min-h-[48px] h-[48px] px-4 py-2.5 rounded-xl bg-emerald-950 border border-emerald-700 text-emerald-200 font-mono text-xs hover:bg-emerald-900 cursor-pointer"
                >
                  হিস্ট্রি
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. WITHDRAWAL FLOW */}
      {/* ========================================================================= */}
      {activeMode === 'WITHDRAWAL' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Method Selection */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            {PAYMENT_CHANNELS.slice(0, 4).map((ch) => {
              const isSelected = selectedProvider === ch.provider;
              return (
                <button
                  key={ch.provider}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(ch.provider);
                    soundEngine.playClick(900);
                  }}
                  className={`min-h-[76px] p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#052c1b] border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                      : 'bg-[#031d12]/90 border-emerald-800/70 hover:border-emerald-600/90'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-amber-300">{ch.icon}</span>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                  </div>
                  <div className="font-bold text-white text-xs font-sans">{ch.name}</div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-emerald-800/80 bg-gradient-to-b from-[#042416] via-[#031d12] to-[#02180e] p-4 sm:p-5 space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            {/* Controlled Reservation Info */}
            <div className="bg-[#02130b] border border-emerald-800/80 p-3 rounded-xl flex items-start gap-2.5 text-xs text-emerald-200/90">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-sans">ব্যালেন্স রিজার্ভেশন পলিসি</strong>
                উইথড্র রিকোয়েস্টের পর টাকা সাময়িকভাবে সংরক্ষিত থাকবে। পেআউট সফল হলে ডেবিট চূড়ান্ত হবে; ব্যর্থ হলে স্বয়ংক্রিয়ভাবে ওয়ালেটে ফেরত আসবে।
              </div>
            </div>

            <form onSubmit={handleWithdrawalSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-emerald-200 block mb-1 font-sans">
                  উইথড্রয়াল পরিমাণ (Withdraw Amount)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-amber-400 text-base">
                    {currency === 'BDT' ? '৳' : '$'}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    id="play369-withdraw-amount"
                    value={withdrawAmountStr}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      setWithdrawAmountStr(val);
                    }}
                    className="w-full bg-[#02130b] border border-emerald-700/80 focus:border-amber-400 rounded-xl py-2.5 pl-9 pr-3 text-white font-mono text-lg font-bold focus:outline-none min-h-[50px]"
                    placeholder="5000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-emerald-200 block mb-1 font-sans">
                    প্রাপকের {activeChannel.name} নম্বর *
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    id="play369-withdraw-recipient"
                    value={withdrawRecipient}
                    onChange={(e) => setWithdrawRecipient(e.target.value)}
                    className="w-full bg-[#02130b] border border-emerald-700/80 focus:border-amber-400 rounded-xl py-2.5 px-3 text-white font-mono text-sm focus:outline-none min-h-[48px]"
                    placeholder="01XXXXXXXXX"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-200 block mb-1 font-sans">
                    একাউন্টধারীর নাম
                  </label>
                  <input
                    type="text"
                    id="play369-withdraw-recipient-name"
                    value={withdrawRecipientName}
                    onChange={(e) => setWithdrawRecipientName(e.target.value)}
                    className="w-full bg-[#02130b] border border-emerald-700/80 focus:border-amber-400 rounded-xl py-2.5 px-3 text-white font-mono text-sm focus:outline-none min-h-[48px]"
                    placeholder="Player Name"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="play369-confirm-withdraw-btn"
                disabled={isWithdrawing}
                className="w-full min-h-[52px] h-[52px] rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-mono font-black text-sm shadow-[0_4px_16px_rgba(245,158,11,0.25)] hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isWithdrawing ? (
                  <RotateCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    <span>উইথড্রয়াল রিকোয়েস্ট সাবমিট করুন</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 5. HISTORY VIEW */}
      {/* ========================================================================= */}
      {activeMode === 'HISTORY' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-800/80 bg-gradient-to-b from-[#042416] via-[#031d12] to-[#02180e] p-4 sm:p-5 space-y-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center justify-between border-b border-emerald-800/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white font-sans flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-amber-400" />
                <span>ট্রানজেকশন হিস্ট্রি</span>
              </h3>
              <p className="text-[11px] text-emerald-300/80 mt-0.5">
                ডিপোজিট ও উইথড্রয়াল রেকর্ড তালিকা
              </p>
            </div>
            <button
              type="button"
              onClick={refreshEngineData}
              className="min-h-[48px] min-w-[48px] p-2.5 rounded-lg bg-[#02130b] border border-emerald-700 text-emerald-200 hover:bg-[#032014] cursor-pointer flex items-center justify-center"
              title="রিফ্রেশ করুন"
              aria-label="Refresh transaction history"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#02130b] text-emerald-300 uppercase text-[10px] border-b border-emerald-800">
                <tr>
                  <th className="p-2.5">রেফারেন্স</th>
                  <th className="p-2.5">ধরন</th>
                  <th className="p-2.5">মেথড</th>
                  <th className="p-2.5">পরিমাণ</th>
                  <th className="p-2.5">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-800/40">
                {depositIntents.length === 0 && withdrawalRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 font-sans text-xs">
                      কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি
                    </td>
                  </tr>
                ) : (
                  <>
                    {depositIntents.map((dep) => (
                      <tr key={dep.id} className="hover:bg-emerald-950/40">
                        <td className="p-2.5 text-white font-bold truncate max-w-[100px]">{dep.id}</td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            DEP
                          </span>
                        </td>
                        <td className="p-2.5 text-white">{dep.provider.toUpperCase()}</td>
                        <td className="p-2.5 text-amber-300 font-bold">
                          +৳{formatExactMoneyStr(dep.amount)}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            dep.status === 'CREDITED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {dep.status}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {withdrawalRecords.map((wth) => (
                      <tr key={wth.id} className="hover:bg-emerald-950/40">
                        <td className="p-2.5 text-white font-bold truncate max-w-[100px]">{wth.id}</td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            WTH
                          </span>
                        </td>
                        <td className="p-2.5 text-white">{wth.provider.toUpperCase()}</td>
                        <td className="p-2.5 text-red-400 font-bold">
                          -৳{formatExactMoneyStr(wth.amount)}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            wth.status === 'WITHDRAWAL_COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {wth.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 6. SUBTLE FACTUAL TRUST FOOTER */}
      {/* ========================================================================= */}
      <footer
        id="play369-cashier-trust-footer"
        className="mt-5 pt-3 border-t border-emerald-800/40 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-emerald-400/70 font-mono"
      >
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-amber-400/80" />
          <span>সুরক্ষিত সার্ভার ভেরিফিকেশন</span>
        </span>
        <span>•</span>
        <span>অপরিবর্তনযোগ্য ট্রানজেকশন ট্র্যাকিং</span>
        <span>•</span>
        <span>ভেরিফিকেশন পরবর্তী ওয়ালেট সেটেলমেন্ট</span>
      </footer>
    </div>
  );
};
