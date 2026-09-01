/**
 * @file Navbar.tsx
 * @description Luxury Dark Emerald & Metallic Gold Navigation Header for PLAY369.
 * Features Real-Time Balance Display, Web Audio Sound Toggle, Notification Bell,
 * User Profile Entry with Safe-Area Inset Support and 48px+ Touch Targets.
 */

import React, { useState } from 'react';
import {
  Crown,
  Wallet,
  ArrowUpRight,
  ChevronDown,
  Gamepad2,
  Zap,
  Award,
  Share2,
  Gift,
  CreditCard,
  Terminal,
  LogOut,
  Coins,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Fingerprint,
  User as UserIcon,
  Sun,
  Moon,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useWalletGame, MainNavTab } from '../contexts/WalletGameContext';
import { NotificationBell } from './NotificationBell';
import { Play369BrandLogo } from './Play369BrandLogo';

interface NavbarProps {
  onOpenCashier: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCashier,
  onOpenProfile
}) => {
  const { user: firebaseUser, logout: firebaseLogout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    currentUser,
    currentWallet,
    isAdmin,
    userRole,
    users,
    currency,
    toggleCurrency,
    switchUser,
    logoutUser,
    refreshState,
    formattedBalance,
    balanceFlash,
    activeTab,
    setActiveTab,
    soundMuted,
    toggleSound,
    audioEngine
  } = useWalletGame();

  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#02180e]/95 backdrop-blur-xl border-b border-emerald-800/80 shadow-2xl transition-all w-full max-w-full pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[56px] sm:min-h-[72px] py-1.5 gap-2 sm:gap-4 w-full">
          
          {/* Left: Brand Logo (PLAY369) */}
          <div className="flex items-center space-x-2 sm:space-x-6 shrink-0 min-w-0">
            <button
              id="play369-navbar-brand-btn"
              onClick={() => {
                audioEngine.playClick();
                setActiveTab('lobby');
              }}
              className="flex items-center group text-left focus:outline-none min-h-[48px] min-w-[48px] cursor-pointer shrink-0 rounded-xl px-1"
              aria-label="PLAY369 Home"
            >
              <Play369BrandLogo size="sm" variant="horizontal" glow={true} />
            </button>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden xl:flex items-center space-x-1.5 bg-[#032315]/80 p-1.5 rounded-2xl border border-emerald-800/70 text-sm font-semibold">
              <button
                id="play369-nav-lobby"
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('lobby');
                }}
                className={`min-h-[48px] px-4 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'lobby'
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-900/60'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Lobby</span>
              </button>

              <button
                id="play369-nav-games"
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('games');
                }}
                className={`min-h-[48px] px-4 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'games'
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-900/60'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>Slots &amp; Games</span>
              </button>

              <button
                id="play369-nav-vip"
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('vip');
                }}
                className={`min-h-[48px] px-4 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'vip'
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-900/60'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>VIP Club</span>
              </button>

              <button
                id="play369-nav-affiliate"
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('affiliate');
                }}
                className={`min-h-[48px] px-4 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'affiliate'
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-900/60'
                }`}
              >
                <Share2 className="w-4 h-4" />
                <span>Affiliate</span>
              </button>

              <button
                id="play369-nav-promo"
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('promo');
                }}
                className={`min-h-[48px] px-4 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'promo'
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-900/60'
                }`}
              >
                <Gift className="w-4 h-4" />
                <span>Offers</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    id="play369-nav-admin"
                    onClick={() => {
                      audioEngine.playClick();
                      setActiveTab('admin');
                    }}
                    className={`min-h-[48px] px-3.5 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer ${
                      activeTab === 'admin'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                        : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Admin</span>
                  </button>

                  <button
                    id="play369-nav-audit"
                    onClick={() => {
                      audioEngine.playClick();
                      setActiveTab('audit');
                    }}
                    className={`min-h-[48px] px-3.5 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer ${
                      activeTab === 'audit'
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                        : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20'
                    }`}
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span>Audit</span>
                  </button>

                  <button
                    id="play369-nav-workbench"
                    onClick={() => {
                      audioEngine.playClick();
                      setActiveTab('workbench');
                    }}
                    className={`min-h-[48px] px-3.5 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer ${
                      ['workbench', 'latency', 'stress', 'hmac', 'ledger', 'architecture', 'code', 'deadlock'].includes(activeTab)
                        ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Terminal className="w-4 h-4" />
                    <span>Workbench</span>
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* Right: Sound, Theme, Notification, Balance Pill + User Profile Entry */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            
            {/* Web Audio API Sound Toggle (Desktop/Tablet) */}
            <button
              id="play369-sound-toggle-btn"
              onClick={toggleSound}
              className={`hidden md:flex items-center justify-center min-w-[48px] min-h-[48px] rounded-xl border transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 ${
                soundMuted
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20'
                  : 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20 shadow-amber-500/10'
              }`}
              title={soundMuted ? 'সাউন্ড চালু করুন (Unmute Audio)' : 'সাউন্ড বন্ধ করুন (Mute Audio)'}
              aria-label="Toggle Sound"
            >
              {soundMuted ? (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              )}
            </button>

            {/* Color Theme Toggle (Desktop/Tablet) */}
            <button
              id="play369-theme-toggle-btn"
              onClick={toggleTheme}
              className="hidden md:flex items-center justify-center min-w-[48px] min-h-[48px] rounded-xl bg-[#042013] border border-emerald-800/80 hover:border-amber-500/40 text-emerald-200 hover:text-amber-400 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label="Toggle Color Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400 hover:-rotate-12 transition-transform" />
              )}
            </button>

            {/* Currency Switcher (Desktop) */}
            <button
              id="play369-currency-toggle-btn"
              onClick={toggleCurrency}
              className="hidden lg:flex items-center space-x-1.5 min-h-[48px] px-3.5 rounded-xl bg-[#042013] border border-emerald-800/80 hover:border-amber-500/40 text-amber-300 text-xs font-semibold transition-all cursor-pointer"
              title="Switch currency (BDT / USD)"
            >
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="font-mono font-bold">{currency}</span>
            </button>

            {/* Notification Entry (48px Touch Target) */}
            <div className="flex items-center shrink-0">
              <NotificationBell
                currentUser={currentUser}
                onNavigateTab={setActiveTab}
                currency={currency}
              />
            </div>

            {/* Wallet Balance Display UI & Cashier Entry (Desktop/Tablet md+ only) */}
            <div
              className={`hidden md:flex items-center bg-[#02180e] border rounded-xl sm:rounded-2xl p-1 shadow-md transition-all duration-300 shrink-0 ${
                balanceFlash === 'credit'
                  ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-emerald-500/25 scale-[1.02]'
                  : balanceFlash === 'deduct'
                  ? 'border-rose-400 ring-2 ring-rose-400/30'
                  : 'border-amber-500/40 shadow-amber-500/10'
              }`}
            >
              {/* Balance Display */}
              <div
                id="play369-wallet-balance-box"
                className="flex px-2 sm:px-3 py-1 text-right cursor-pointer min-h-[44px] flex-col justify-center"
                onClick={() => {
                  audioEngine.playClick();
                  onOpenCashier();
                }}
                title="ওয়ালেট ব্যালেন্স (ক্যাশিয়ারে যান)"
              >
                <div className="flex items-center justify-end space-x-1 text-[9px] text-emerald-300/70 uppercase font-bold">
                  <Wallet className="w-3 h-3 text-amber-400" />
                  <span>ব্যালেন্স</span>
                </div>
                <div
                  className={`text-xs sm:text-sm font-black font-mono leading-tight transition-colors truncate max-w-[120px] ${
                    balanceFlash === 'credit'
                      ? 'text-emerald-400 animate-pulse'
                      : balanceFlash === 'deduct'
                      ? 'text-rose-400'
                      : 'text-amber-300'
                  }`}
                >
                  {formattedBalance}
                </div>
              </div>

              {/* Deposit Action Button (48px Touch Target on Desktop) */}
              <button
                id="play369-deposit-btn"
                onClick={() => {
                  audioEngine.playClick(1200);
                  onOpenCashier();
                }}
                className="min-h-[44px] px-3 sm:px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs tracking-wide flex items-center space-x-1 shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
              >
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                <span>ডিপোজিট</span>
              </button>
            </div>

            {/* Profile Avatar / User Switcher Entry (48px Touch Target) */}
            <div className="relative shrink-0">
              <button
                id="play369-user-profile-btn"
                onClick={() => {
                  audioEngine.playClick();
                  setShowUserDropdown(!showUserDropdown);
                }}
                className="flex items-center space-x-1 min-h-[48px] min-w-[48px] p-1 sm:px-2 rounded-xl bg-[#042013] border border-emerald-800/80 hover:border-amber-500/40 text-slate-200 transition-all focus:outline-none cursor-pointer"
                title="প্রোফাইল মেনু"
                aria-label="User Profile"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-400 to-emerald-400 flex items-center justify-center text-slate-950 font-black text-xs shadow-md">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-emerald-300 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Backdrop for easy dismiss on tap */}
              {showUserDropdown && (
                <div
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] sm:bg-transparent"
                  onClick={() => setShowUserDropdown(false)}
                />
              )}

              {showUserDropdown && (
                <div className="fixed sm:absolute top-16 sm:top-full right-2 sm:right-0 mt-1 sm:mt-2 w-[calc(100vw-1rem)] sm:w-80 max-w-xs rounded-2xl bg-[#02180e]/98 border-2 border-amber-400/40 shadow-2xl p-4 z-50 text-sm animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
                  {/* Header info with Top Sign Out */}
                  <div className="px-2 py-2 text-xs text-emerald-200/80 font-bold uppercase tracking-wider border-b border-emerald-800/80 flex items-center justify-between">
                    <span className="text-amber-300 font-mono flex items-center space-x-1.5 truncate">
                      <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="truncate">{currentUser.username}</span>
                    </span>
                    <button
                      id="play369-dropdown-logout-top"
                      onClick={() => {
                        if (firebaseUser) firebaseLogout();
                        logoutUser();
                        setShowUserDropdown(false);
                      }}
                      className="text-[10px] min-h-[32px] px-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-lg transition-colors flex items-center space-x-1 cursor-pointer shrink-0 shadow"
                    >
                      <LogOut className="w-3 h-3 stroke-[2.5]" />
                      <span>লগআউট</span>
                    </button>
                  </div>

                  {/* Active User's Profile Summary Card */}
                  <div className="py-2.5 px-3 my-2.5 rounded-xl bg-[#042013] border border-emerald-800/70 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-200/70">ব্যালেন্স:</span>
                      <span className="text-amber-400 font-black font-mono">
                        {formattedBalance}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-200/70">একাউন্ট স্ট্যাটাস:</span>
                      <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-400 font-bold flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>{currentUser.status === 'ACTIVE' ? 'সক্রিয় (Active)' : currentUser.status}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-200/70">ইউজার রোল:</span>
                      <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${
                        isAdmin
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {isAdmin ? 'অ্যাডমিন / অপারেটর' : 'প্লেয়ার একাউন্ট'}
                      </span>
                    </div>

                    {firebaseUser?.email && (
                      <div className="text-[10px] text-emerald-200/60 truncate pt-1 border-t border-emerald-800/60 font-mono">
                        ইমেইল: <span className="text-emerald-200">{firebaseUser.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Links */}
                  <div className="border-t border-emerald-800/80 pt-2 space-y-2">
                    <button
                      id="play369-dropdown-profile-btn"
                      onClick={() => {
                        setActiveTab('profile');
                        setShowUserDropdown(false);
                        audioEngine.playClick(1000);
                      }}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#042013] hover:bg-emerald-900/60 text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer border border-emerald-800/80"
                    >
                      <span className="flex items-center space-x-2">
                        <UserIcon className="w-4 h-4 text-amber-400" />
                        <span>প্রোফাইল ড্যাশবোর্ড (Profile)</span>
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                    </button>

                    {/* ONLY VISIBLE IF USER HAS ADMIN ROLE IN FIRESTORE */}
                    {isAdmin && (
                      <button
                        id="play369-dropdown-admin-btn"
                        onClick={() => {
                          setActiveTab('admin');
                          setShowUserDropdown(false);
                          audioEngine.playClick(1000);
                        }}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-between transition-all cursor-pointer border border-amber-500/30"
                      >
                        <span className="flex items-center space-x-2">
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                          <span>অ্যাডমিন প্যানেল (Admin Panel)</span>
                        </span>
                        <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-black">
                          ADMIN
                        </span>
                      </button>
                    )}

                    <button
                      id="play369-dropdown-sync-btn"
                      onClick={() => {
                        refreshState();
                        setShowUserDropdown(false);
                        audioEngine.playClick(1000);
                      }}
                      className="w-full min-h-[44px] px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 flex items-center justify-center space-x-1.5 font-bold text-xs cursor-pointer transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ওয়ালেট ও ব্যালেন্স সিঙ্ক (Sync)</span>
                    </button>

                    {/* Front-Facing Logout Button */}
                    <button
                      id="play369-dropdown-logout-bottom"
                      onClick={() => {
                        if (firebaseUser) firebaseLogout();
                        logoutUser();
                        setShowUserDropdown(false);
                      }}
                      className="w-full min-h-[48px] px-3 py-2.5 rounded-xl bg-rose-600/25 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/60 shadow-lg shadow-rose-600/20 flex items-center justify-center space-x-2 font-black cursor-pointer text-xs transition-all active:scale-95"
                    >
                      <LogOut className="w-4 h-4 stroke-[2.5]" />
                      <span>লগ আউট (Sign Out)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </header>
  );
};

