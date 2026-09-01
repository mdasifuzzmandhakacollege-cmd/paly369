import React, { useState } from 'react';
import {
  Zap,
  RotateCcw,
  PlusCircle,
  Cpu,
  Database,
  Code2,
  Terminal,
  Layers,
  Key,
  LogIn,
  LogOut,
  User as UserIcon,
  Crown,
  Wallet,
  Sun,
  Moon
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Play369BrandLogo } from './Play369BrandLogo';

interface HeaderProps {
  activeTab: 'simulator' | 'concurrency' | 'ledger' | 'code' | 'architecture' | 'hmac';
  setActiveTab: (tab: 'simulator' | 'concurrency' | 'ledger' | 'code' | 'architecture' | 'hmac') => void;
  users: UserEntity[];
  wallets: WalletEntity[];
  selectedUserId: string;
  setSelectedUserId: (id: string) => void;
  onResetDb: () => void;
  onTopUp: (amount: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  users,
  wallets,
  selectedUserId,
  setSelectedUserId,
  onResetDb,
  onTopUp
}) => {
  const { user: authUser, signInWithGoogle, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(500);

  const currentUser = users.find((u) => u.id === selectedUserId) || users[0];
  const currentWallet = wallets.find(
    (w) => w.user_id === currentUser?.id && w.currency === 'USD'
  );

  return (
    <header className="bg-[#07090e]/95 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-3.5">
          <Play369BrandLogo size="md" variant="horizontal" glow={true} />
          <span className="hidden md:inline-block px-2 py-0.5 text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md">
            ACID Core
          </span>
        </div>

        {/* Player & Wallet Quick Actions */}
        <div className="flex items-center flex-wrap gap-3">
          {currentUser && currentWallet && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-1.5 px-4 shadow-lg min-h-[48px]">
              <div className="mr-4">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer pr-2 min-h-[40px]"
                >
                  {users.map((u) => {
                    const w = wallets.find((wal) => wal.user_id === u.id);
                    return (
                      <option key={u.id} value={u.id} className="bg-slate-900 text-slate-200">
                        {u.username} (${w?.real_balance.toFixed(2) || '0.00'})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="border-l border-slate-800 pl-4 flex items-center space-x-3">
                <div>
                  <div className="text-base font-black text-amber-300">
                    ${currentWallet.real_balance.toFixed(2)}
                  </div>
                </div>

                <button
                  onClick={() => setTopUpOpen(true)}
                  title="Top-up balance"
                  className="min-h-[40px] px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs transition-colors flex items-center space-x-1"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Top-up</span>
                </button>
              </div>
            </div>
          )}

          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light Platinum' : 'Obsidian Gold'} theme`}
            className="min-h-[48px] px-3.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all flex items-center justify-center"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700" />
            )}
          </button>

          <button
            onClick={onResetDb}
            title="Reset Database to clean state"
            className="min-h-[48px] px-4 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all flex items-center space-x-2"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span>Reset DB</span>
          </button>

          {/* Auth Action */}
          {authUser ? (
            <div className="flex items-center space-x-2.5 bg-slate-900 border border-slate-800 rounded-xl py-1.5 px-3 min-h-[48px]">
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt={authUser.displayName || 'User'}
                  className="w-7 h-7 rounded-full ring-2 ring-amber-500/50"
                />
              ) : (
                <UserIcon className="w-5 h-5 text-amber-400" />
              )}
              <span className="text-sm font-semibold text-slate-200 hidden md:inline max-w-[120px] truncate">
                {authUser.displayName || authUser.email?.split('@')[0]}
              </span>
              <button
                onClick={logout}
                title="Sign out"
                className="text-slate-400 hover:text-rose-400 transition-colors p-1.5"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="min-h-[48px] px-5 rounded-xl text-sm font-extrabold bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 transition-all shadow-lg shadow-amber-500/20 flex items-center space-x-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Top-up Modal */}
      {topUpOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-extrabold text-white mb-2">Top-Up Player Balance</h3>
            <p className="text-sm text-slate-400 mb-6">
              Directly inject funds into <span className="text-amber-400 font-bold">{currentUser?.username}</span>'s wallet.
            </p>
            <div className="mb-6 space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[100, 500, 1000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopUpAmount(amt)}
                    className={`min-h-[44px] text-sm font-bold rounded-xl border transition-all ${
                      topUpAmount === amt
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    +${amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(Math.max(1, Number(e.target.value)))}
                className="w-full min-h-[48px] bg-slate-900 border border-slate-800 rounded-2xl px-4 text-base text-white font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTopUpOpen(false)}
                className="min-h-[48px] px-5 text-sm font-bold rounded-2xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onTopUp(topUpAmount);
                  setTopUpOpen(false);
                }}
                className="min-h-[48px] px-6 text-sm font-black rounded-2xl text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 shadow-lg shadow-amber-500/25"
              >
                Confirm Deposit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto no-scrollbar border-t border-slate-800/80">
        {[
          { id: 'simulator', label: 'API Simulator', icon: Terminal },
          { id: 'concurrency', label: 'Concurrency Stress', icon: Cpu },
          { id: 'ledger', label: 'PostgreSQL Ledger', icon: Database },
          { id: 'code', label: 'Boilerplate & Schema', icon: Code2 },
          { id: 'architecture', label: 'System Architecture', icon: Layers },
          { id: 'hmac', label: 'HMAC Signer', icon: Key }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 min-h-[48px] py-3 px-5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                isSelected
                  ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
