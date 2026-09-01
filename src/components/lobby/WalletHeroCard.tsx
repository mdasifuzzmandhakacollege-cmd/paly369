/**
 * @file WalletHeroCard.tsx
 * @description Luxury Deep Emerald & Metallic Gold Balance / Wallet Hero Card for PLAY369.
 * Strictly uses existing authoritative wallet data with zero fabricated numbers.
 */

import React from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, Coins, Sparkles, RefreshCw, ShieldCheck } from 'lucide-react';
import { WalletEntity } from '../../server/types/seamless';
import { soundEngine } from '../../services/soundEngine';

export interface WalletHeroCardProps {
  currentWallet?: WalletEntity;
  formattedBalance: string;
  currency: 'BDT' | 'USD';
  balanceFlash?: 'idle' | 'deduct' | 'credit';
  onOpenCashier: () => void;
  onRefresh?: () => void;
}

export const WalletHeroCard: React.FC<WalletHeroCardProps> = ({
  currentWallet,
  formattedBalance,
  currency,
  balanceFlash = 'idle',
  onOpenCashier,
  onRefresh
}) => {
  const bonusBalance = currentWallet?.bonus_balance || 0;
  const lockedBalance = currentWallet?.locked_balance || 0;

  return (
    <section
      id="play369-wallet-hero-card"
      className="relative w-full rounded-3xl overflow-hidden border border-amber-500/30 bg-gradient-to-b from-[#063120] via-[#021b10] to-[#01120a] p-4 sm:p-5 shadow-2xl backdrop-blur-xl transition-all"
      style={{
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(245, 158, 11, 0.08)'
      }}
      aria-label="Account Balance and Wallet Actions"
    >
      {/* Background Subtle Geometric Texture & Golden Orbs */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 sm:gap-4">
        {/* Left: Total Available Balance */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-300/80 font-bold flex items-center gap-1.5">
              <span>Total Available Balance</span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {currency}
              </span>
            </span>

            {onRefresh && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick(900);
                  onRefresh();
                }}
                className="text-emerald-400/70 hover:text-amber-400 transition-colors p-1 rounded-lg cursor-pointer"
                title="Refresh Balance"
                aria-label="Refresh Balance"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-baseline space-x-2">
            <div
              className={`text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tight transition-colors duration-300 drop-shadow-md ${
                balanceFlash === 'credit'
                  ? 'text-emerald-400 animate-pulse'
                  : balanceFlash === 'deduct'
                  ? 'text-rose-400'
                  : 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-400'
              }`}
            >
              {formattedBalance}
            </div>
          </div>

          {/* Secondary Authoritative Balances (only shown if genuine data exists) */}
          {(bonusBalance > 0 || lockedBalance > 0) && (
            <div className="flex items-center space-x-3 pt-0.5 text-[11px] font-mono text-emerald-200/70">
              {bonusBalance > 0 && (
                <div className="flex items-center space-x-1">
                  <span>Bonus:</span>
                  <span className="font-bold text-amber-300">
                    {currency === 'BDT' ? '৳' : '$'}{bonusBalance.toLocaleString()}
                  </span>
                </div>
              )}
              {lockedBalance > 0 && (
                <div className="flex items-center space-x-1">
                  <span>Wager Locked:</span>
                  <span className="font-bold text-slate-300">
                    {currency === 'BDT' ? '৳' : '$'}{lockedBalance.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Golden Action Buttons (Deposit + Withdraw/Cashier) */}
        <div className="flex items-center space-x-2 sm:space-x-3 pt-1 sm:pt-0">
          {/* Cashier / Withdraw */}
          <button
            type="button"
            id="play369-wallet-withdraw-btn"
            onClick={() => {
              soundEngine.playClick(900);
              onOpenCashier();
            }}
            className="flex-1 sm:flex-initial min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#02180e] hover:bg-[#032314] border border-emerald-700/60 hover:border-amber-400/60 text-emerald-100 hover:text-white font-bold text-xs sm:text-sm font-sans flex items-center justify-center space-x-1.5 transition-all cursor-pointer select-none active:scale-[0.98] shadow-md"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">Withdraw</span>
          </button>

          {/* Golden Deposit CTA Button */}
          <button
            type="button"
            id="play369-wallet-deposit-btn"
            onClick={() => {
              soundEngine.playClick(1200);
              onOpenCashier();
            }}
            className="flex-1 sm:flex-initial min-h-[48px] px-5 sm:px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider font-sans flex items-center justify-center space-x-2 shadow-xl shadow-amber-500/25 transition-all cursor-pointer select-none active:scale-[0.98]"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[3] shrink-0" />
            <span className="whitespace-nowrap">Deposit</span>
          </button>
        </div>
      </div>
    </section>
  );
};
