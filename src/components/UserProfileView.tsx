/**
 * @file UserProfileView.tsx
 * @description Master User Profile & VIP Management Dashboard for GamePlay365.
 * Strictly themed with Asian-market Emerald & Gold design system, clean whitespace,
 * 2x2 Emerald Treasure Chest modal trigger, Unclaimed Rewards modal, VIP progression bar,
 * quick action icon-grid, live PostgreSQL transaction ledger, and KYC Document Vault.
 */

import React, { useState, useMemo } from 'react';
import {
  Crown,
  Sparkles,
  Shield,
  Award,
  Wallet,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  Zap,
  Gift,
  Coins,
  ShieldCheck,
  RotateCw,
  SlidersHorizontal,
  User,
  Phone,
  Mail,
  Calendar,
  Layers,
  ChevronRight,
  Share2,
  Send
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { useWalletGame } from '../contexts/WalletGameContext';
import { useAuth } from '../contexts/AuthContext';
import { WageringRequirements } from './WageringRequirements';
import { GoogleDrivePickerHub } from './GoogleDrivePickerHub';
import { soundEngine } from '../services/soundEngine';
import { referralService } from '../services/referralService';
import { ProfileDashboard } from './ProfileDashboard';
import { motion, AnimatePresence } from 'framer-motion';

interface UserProfileViewProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onOpenCashier: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  currentWallet,
  currency,
  onOpenCashier
}) => {
  const { transactions, refreshState, showToast, setActiveTab: setMainNavTab } = useWalletGame();
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTx, setSearchTx] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TURNOVER' | 'DOCS' | 'LEDGER'>('OVERVIEW');

  const userTransactions = transactions.filter((tx) => tx.user_id === currentUser.id);

  const filteredTxs = userTransactions.filter((tx) => {
    const matchType = filterType === 'ALL' || tx.type === filterType;
    const matchSearch =
      tx.transaction_id.toLowerCase().includes(searchTx.toLowerCase()) ||
      tx.game_id.toLowerCase().includes(searchTx.toLowerCase()) ||
      tx.provider_id.toLowerCase().includes(searchTx.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-28 font-sans text-slate-100 selection:bg-amber-400 selection:text-slate-950">
      {/* Sub-Section Navigation Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none font-mono text-xs max-w-4xl mx-auto">
        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('OVERVIEW');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
              : 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 hover:text-white'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>প্রোফাইল ড্যাশবোর্ড (Profile VIP)</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('TURNOVER');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'TURNOVER'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
              : 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 hover:text-white'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>টার্নওভার ও ওয়েজার প্রগ্রেস</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('DOCS');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'DOCS'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
              : 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>KYC ও ভেরিফিকেশন ভল্ট</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('LEDGER');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'LEDGER'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
              : 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>লেনদেন লেজার ({userTransactions.length})</span>
        </button>
      </div>

      {/* Tab 1: Clean Master Asian-Market Profile Dashboard */}
      {activeTab === 'OVERVIEW' && (
        <ProfileDashboard
          currentUser={currentUser}
          currentWallet={currentWallet}
          currency={currency}
          onOpenCashier={onOpenCashier}
          onNavigateTab={setMainNavTab}
        />
      )}

      {/* Tab 2: Turnover Requirements */}
      {activeTab === 'TURNOVER' && (
        <div className="max-w-4xl mx-auto">
          <WageringRequirements
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
            onConversionSuccess={refreshState}
          />
        </div>
      )}

      {/* Tab 3: KYC Documents Hub */}
      {activeTab === 'DOCS' && (
        <div className="max-w-4xl mx-auto">
          <GoogleDrivePickerHub
            currentUser={currentUser}
            onKycUpdated={refreshState}
          />
        </div>
      )}

      {/* Tab 4: Live Ledger View */}
      {activeTab === 'LEDGER' && (
        <div className="max-w-5xl mx-auto rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#021a10] border-2 border-emerald-600/40 p-5 sm:p-7 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800/80 pb-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>ব্যক্তিগত লেনদেন ও গেম লেজার (Live Transaction Ledger)</span>
              </h3>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                প্রতিটি বেট, উইন, ডিপোজিট ও বোনাস ট্রানজেকশনের সম্পূর্ণ ক্রিপ্টোগ্রাফিক রেকর্ড
              </p>
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-2 font-mono text-xs">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-emerald-950 border border-emerald-700/80 rounded-xl px-3 py-1.5 text-emerald-200 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="ALL">সকল ধরন (All Types)</option>
                <option value="BET">বেট (BET)</option>
                <option value="WIN">উইন (WIN)</option>
                <option value="JACKPOT">জ্যাকপট (JACKPOT)</option>
                <option value="DEPOSIT">ডিপোজিট (DEPOSIT)</option>
                <option value="WITHDRAW">উইথড্রয়াল (WITHDRAW)</option>
              </select>

              <input
                type="text"
                value={searchTx}
                onChange={(e) => setSearchTx(e.target.value)}
                placeholder="সার্চ..."
                className="bg-emerald-950 border border-emerald-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-emerald-400/50 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-emerald-950/90 text-emerald-300 uppercase text-[10px] border-b border-emerald-800">
                <tr>
                  <th className="p-3">ট্রানজেকশন আইডি</th>
                  <th className="p-3">গেম ও প্রোভাইডার</th>
                  <th className="p-3">ধরন</th>
                  <th className="p-3">পরিমাণ</th>
                  <th className="p-3">ব্যালেন্স লেজার</th>
                  <th className="p-3">স্ট্যাটাস</th>
                  <th className="p-3">সময়</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/60">
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-emerald-300/60 font-sans">
                      কোনো ট্রানজেকশন রেকর্ড পাওয়া যায়নি
                    </td>
                  </tr>
                ) : (
                  filteredTxs.map((tx) => (
                    <tr key={tx.id} className="hover:bg-emerald-900/40 transition-colors">
                      <td className="p-3 text-emerald-200 font-semibold truncate max-w-[140px]">
                        {tx.transaction_id}
                      </td>
                      <td className="p-3">
                        <div className="text-white font-bold">{tx.game_id}</div>
                        <div className="text-[10px] text-emerald-300/70">{tx.provider_id}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.type === 'BET'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : tx.type === 'WIN' || tx.type === 'JACKPOT'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="p-3 font-bold">
                        <span className={tx.type === 'BET' || tx.type === 'TIP' ? 'text-rose-400' : 'text-emerald-400'}>
                          {tx.type === 'BET' || tx.type === 'TIP' ? '-' : '+'}
                          {tx.currency === 'BDT' ? '৳' : '$'} {tx.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-3 text-emerald-200/80">
                        <span>{tx.currency === 'BDT' ? '৳' : '$'}{tx.before_balance.toFixed(2)}</span>
                        <span className="mx-1 text-emerald-500">&rarr;</span>
                        <span className="text-white font-semibold">{tx.currency === 'BDT' ? '৳' : '$'}{tx.after_balance.toFixed(2)}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                          {tx.status}
                        </span>
                      </td>
                      <td className="p-3 text-emerald-300/70 text-[11px]">
                        {new Date(tx.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
