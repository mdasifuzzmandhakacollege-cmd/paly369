/**
 * @file ShareWheelModal.tsx
 * @description Lucky Wheel & Referral Reward Share Modal.
 * Matches the "পুরস্কার শেয়ার" action in the mobile top status bar.
 * Uses real-time server referral link and 1-click social sharing.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  X,
  Share2,
  Copy,
  Check,
  Gift,
  Coins,
  Crown,
  RotateCcw,
  MessageCircle,
  Send,
  Facebook
} from 'lucide-react';
import { useWalletGame } from '../contexts/WalletGameContext';
import { useAuth } from '../contexts/AuthContext';
import { soundEngine } from '../services/soundEngine';
import { referralService } from '../services/referralService';

interface ShareWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareWheelModal: React.FC<ShareWheelModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useWalletGame();
  const { user } = useAuth();

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState<boolean>(true);

  // Authoritative server referralCode fetch
  useEffect(() => {
    if (!isOpen || !user) {
      setLoadingCode(false);
      return;
    }

    let isMounted = true;
    (async () => {
      setLoadingCode(true);
      try {
        const token = await user.getIdToken();
        const res = await referralService.fetchAffiliateSummary(token);
        if (isMounted && res.success && res.data?.node?.referralCode) {
          setReferralCode(res.data.node.referralCode);
        }
      } catch (e) {
        console.error('Failed to load referral code for ShareWheelModal:', e);
      } finally {
        if (isMounted) setLoadingCode(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  // Dynamic real referral link (derived strictly from authoritative server referralCode)
  const referralUrl = useMemo(() => {
    return referralCode ? referralService.generateReferralLink(referralCode) : '';
  }, [referralCode]);

  const shareLinks = useMemo(() => {
    return (referralUrl && referralCode)
      ? referralService.getShareLinks(referralUrl, referralCode)
      : null;
  }, [referralUrl, referralCode]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!referralUrl || !referralCode) return;
    navigator.clipboard.writeText(referralUrl);
    setCopiedLink(true);
    soundEngine.playClick(1100);
    showToast('রেফারেল লিংক কপি করা হয়েছে!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSpinWheel = () => {
    if (spinning) return;
    setSpinning(true);
    setWonPrize(null);
    soundEngine.playClick(800);

    const extraRounds = 5 + Math.floor(Math.random() * 5);
    const targetDegree = Math.floor(Math.random() * 360);
    const totalRotation = rotation + extraRounds * 360 + targetDegree;
    setRotation(totalRotation);

    let tickCount = 0;
    const tickInt = setInterval(() => {
      soundEngine.playWheelTick();
      tickCount++;
      if (tickCount > 25) clearInterval(tickInt);
    }, 120);

    setTimeout(() => {
      setSpinning(false);
      // Purely decorative encouraging message; never claims fake tier boosts, VIP boosts, or server money
      const greetings = ['ধন্যবাদ!', 'রেফারেল লিংক শেয়ারের জন্য প্রস্তুত!', 'বন্ধুদের আমন্ত্রণ জানান!', 'আজীবন ৩-লেভেল কমিশন নেটওয়ার্ক'];
      const prize = greetings[Math.floor(Math.random() * greetings.length)];
      setWonPrize(prize);

      soundEngine.playMegaWin();
      showToast('রেফারেল লিংক বন্ধুদের সাথে শেয়ার করুন!');
    }, 3500);
  };

  const displayReferralValue = loadingCode
    ? 'সার্ভার থেকে লোড হচ্ছে...'
    : (referralUrl || 'রেফারেল লিংক অনুপলব্ধ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0b0f19] border-2 border-amber-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
            <h2 className="text-base font-black text-white">রেফারেল হুইল ও ইনভাইট হাব</h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wheel Canvas Graphic */}
        <div className="flex flex-col items-center justify-center py-2 relative">
          <div className="relative w-48 h-48 sm:w-56 sm:h-56">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[18px] border-t-amber-400 drop-shadow-md" />

            {/* Rotating Disc */}
            <div
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 3.5s cubic-bezier(0.15, 0.9, 0.2, 1)' : 'none'
              }}
              className="w-full h-full rounded-full border-4 border-amber-400/80 shadow-[0_0_30px_rgba(245,158,11,0.3)] bg-gradient-to-tr from-amber-600 via-slate-900 to-yellow-500 flex items-center justify-center relative overflow-hidden"
            >
              <div className="absolute inset-2 rounded-full border border-amber-300/30 flex items-center justify-center">
                <span className="text-xs font-mono font-black text-white text-center">
                  ✨ SHARE <br /> WHEEL
                </span>
              </div>
            </div>
          </div>

          {wonPrize && (
            <div className="mt-3 p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs animate-bounce font-mono text-center">
              {wonPrize}
            </div>
          )}

          <button
            disabled={spinning}
            onClick={handleSpinWheel}
            className="mt-4 px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 active:scale-95 disabled:opacity-50 transition-all flex items-center space-x-2 cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
            <span>{spinning ? 'ঘুরছে...' : 'লাকি স্পিন করুন'}</span>
          </button>
        </div>

        {/* Real-Time Referral Share Box */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 font-bold flex items-center space-x-1">
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>আপনার আসল রেফারেল লিংক:</span>
            </span>
            <span className="text-amber-400 text-[10px] font-bold">আজীবন ০.৮০% কমিশন</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <input
              type="text"
              readOnly
              value={displayReferralValue}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-[11px] font-mono text-slate-200 truncate focus:outline-none"
            />
            <button
              onClick={handleCopy}
              disabled={!referralCode || loadingCode}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-yellow-400 disabled:opacity-50 text-slate-950 font-bold text-xs active:scale-95 transition-all flex items-center space-x-1 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-950" />}
              <span>{copiedLink ? 'কপি!' : 'কপি'}</span>
            </button>
          </div>

          {/* Social Share Buttons */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <a
              href={shareLinks?.whatsapp || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold flex items-center justify-center space-x-1 ${
                !shareLinks ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
            <a
              href={shareLinks?.telegram || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold flex items-center justify-center space-x-1 ${
                !shareLinks ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram</span>
            </a>
            <a
              href={shareLinks?.facebook || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-[11px] font-mono font-bold flex items-center justify-center space-x-1 ${
                !shareLinks ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <Facebook className="w-3.5 h-3.5" />
              <span>Facebook</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
