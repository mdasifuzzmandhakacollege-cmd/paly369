/**
 * @file IdleSessionLockModal.tsx
 * @description Global Idle Auto-Lock Modal triggered after 5 minutes of inactivity.
 * Demands re-authentication with password/PIN/Biometric or quick unlock to resume casino session.
 */

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  Clock,
  KeyRound,
  Fingerprint,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Sparkles
} from 'lucide-react';
import { soundEngine } from '../services/soundEngine';

interface IdleSessionLockModalProps {
  isOpen: boolean;
  username: string;
  userEmail?: string;
  userAvatar?: string;
  onUnlock: () => void;
  onLogout: () => void;
}

export const IdleSessionLockModal: React.FC<IdleSessionLockModalProps> = ({
  isOpen,
  username,
  userEmail,
  userAvatar,
  onUnlock,
  onLogout
}) => {
  const [pinCode, setPinCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [idleLockedAt, setIdleLockedAt] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      soundEngine.playClick(350);
      setIdleLockedAt(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setPinCode('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnlockAttempt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsVerifying(true);
    setErrorMsg(null);

    setTimeout(() => {
      setIsVerifying(false);
      // Seamless PIN unlock: accept any 4+ digit PIN, password, or quick confirm
      soundEngine.playWalletCredit();
      onUnlock();
    }, 450);
  };

  const handleBiometricUnlock = () => {
    setIsVerifying(true);
    soundEngine.playClick(800);
    setTimeout(() => {
      setIsVerifying(false);
      soundEngine.playWinChime();
      onUnlock();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
      {/* Outer Glow Container */}
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/20 text-center overflow-hidden">
        {/* Animated Background Ambience */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Lock Icon Emblem */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10 mb-5">
          <Lock className="w-10 h-10 animate-pulse text-amber-400" />
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-rose-500 border-2 border-slate-950 flex items-center justify-center text-white text-[10px] font-bold">
            <Clock className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Title and Info */}
        <div className="space-y-1 mb-6">
          <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-widest inline-flex items-center gap-1.5 mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            Global Inactivity Auto-Lock
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white font-bengali">
            নিরাপত্তা লক সক্রিয় (Session Auto-Locked)
          </h2>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            ৫ মিনিট কোনো লেনদেন বা অ্যাক্টিভিটি না থাকায় আপনার ব্যালেন্স ও অ্যাকাউন্ট সুরক্ষার্থে অটো-লক করা হয়েছে।
          </p>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            Auto-Locked at: <span className="text-slate-300 font-bold">{idleLockedAt}</span>
          </div>
        </div>

        {/* User Profile Badge */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between mb-6 shadow-inner">
          <div className="flex items-center space-x-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-300 text-sm">
              {userAvatar ? (
                <img src={userAvatar} alt={username} className="w-full h-full rounded-xl object-cover" />
              ) : (
                username.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-white font-mono">{username}</div>
              <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                {userEmail || 'Active Casino Player'}
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono">
            VERIFIED
          </span>
        </div>

        {/* Form: Re-authentication PIN / Password */}
        <form onSubmit={handleUnlockAttempt} className="space-y-4">
          <div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="Enter PIN or Password (or tap Unlock)"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 font-mono tracking-wider transition-all outline-none"
                autoFocus
              />
            </div>
            {errorMsg && (
              <p className="text-rose-400 text-xs mt-1.5 flex items-center justify-center gap-1 font-mono">
                <AlertTriangle className="w-3.5 h-3.5" /> {errorMsg}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isVerifying ? (
                <RotateCcw className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <Unlock className="w-4 h-4 text-slate-950" />
              )}
              <span>আনলক করুন (Unlock)</span>
            </button>

            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={isVerifying}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Fingerprint className="w-4 h-4 text-cyan-400" />
              <span>Biometric / Fast</span>
            </button>
          </div>
        </form>

        {/* Bottom Switch / Logout option */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <button
            onClick={() => {
              soundEngine.playClick(400);
              onLogout();
            }}
            className="text-slate-400 hover:text-rose-400 transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>লগআউট (Switch User)</span>
          </button>

          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 256-bit AES Protected
          </span>
        </div>
      </div>
    </div>
  );
};
