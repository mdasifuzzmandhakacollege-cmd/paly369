/**
 * @file InstallPwaButton.tsx
 * @description PWA Installation Floating / Navbar Button & Interactive Modal.
 * Prompts native browser PWA installation in real-time for Android/Chrome/Desktop,
 * provides smooth close/dismiss functionality (X button) to avoid disturbing the user,
 * and shows clear visual guidance for iOS Safari.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  Download,
  Sparkles,
  CheckCircle2,
  X,
  Share,
  Zap,
  ShieldCheck,
  Bell,
  Layers,
  ArrowRight
} from 'lucide-react';
import { pwaService } from '../services/pwaService';
import { soundEngine } from '../services/soundEngine';
import { Play369BrandLogo } from './Play369BrandLogo';
import confetti from 'canvas-confetti';

interface InstallPwaButtonProps {
  isFloating?: boolean;
}

export const InstallPwaButton: React.FC<InstallPwaButtonProps> = ({ isFloating = false }) => {
  const [canInstall, setCanInstall] = useState<boolean>(true);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('playall_pwa_dismissed') === 'true';
    }
    return false;
  });
  const [isIOS, setIsIOS] = useState<boolean>(false);

  useEffect(() => {
    setIsIOS(pwaService.isIOS());
    const unsubscribe = pwaService.subscribe((installable, installed) => {
      setCanInstall(installable);
      setIsInstalled(installed);
    });

    return () => unsubscribe();
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('playall_pwa_dismissed', 'true');
    }
    soundEngine.playClick(600);
  };

  const handleInstallClick = async () => {
    soundEngine.playClick(900);
    const outcome = await pwaService.promptInstall();

    if (outcome === 'accepted') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#06b6d4', '#10b981']
      });
      setShowModal(false);
      setIsDismissed(true);
    } else if (outcome === 'manual_ios' || outcome === 'unavailable' || outcome === 'dismissed') {
      // Open informative installation modal
      setShowModal(true);
    }
  };

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* 1. Floating Banner / Floating Trigger Button on Mobile */}
      {isFloating ? (
        <AnimatePresence>
          {!isDismissed && (
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-5 sm:w-auto z-40 md:hidden"
            >
              <div className="bg-gradient-to-r from-[#0d1424] via-[#090d16] to-[#0d1424] border border-amber-400/60 p-2.5 rounded-2xl shadow-2xl shadow-amber-500/20 flex items-center justify-between gap-3 backdrop-blur-xl">
                {/* Left: Icon & Text */}
                <div
                  onClick={handleInstallClick}
                  className="flex items-center space-x-2.5 flex-1 min-w-0 cursor-pointer"
                >
                  <Play369BrandLogo size="xs" glow={false} />

                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-black text-white font-sans truncate">
                        PLAY369 অ্যাপ
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[9px] font-mono">
                        APP
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-200/80 font-sans truncate">
                      হোম স্ক্রিনে সেভ করুন • ফুলস্ক্রিন গেমিং
                    </p>
                  </div>
                </div>

                {/* Right: Install Action Button & Dismiss 'X' Button */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    onClick={handleInstallClick}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-[11px] font-mono shadow-md active:scale-95 transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>সেভ করুন</span>
                  </button>

                  {/* Close Cross Button */}
                  <button
                    onClick={handleDismiss}
                    className="w-7 h-7 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="বন্ধ করুন"
                    aria-label="Close Install Prompt"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        /* Desktop / Tablet Navbar Button */
        <button
          onClick={handleInstallClick}
          className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 via-slate-900 to-amber-500/20 border border-amber-500/40 hover:border-amber-400 text-slate-200 hover:text-white font-mono text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-amber-500/10 cursor-pointer"
          title="Install PLAY369 Mobile PWA App"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Install App</span>
          <span className="md:hidden">App</span>
          <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-slate-950 font-black text-[9px]">
            PWA
          </span>
        </button>
      )}

      {/* 2. Interactive PWA Installation & Experience Modal */}
      <AnimatePresence>
        {showModal && (
          <div
            onClick={() => setShowModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-sans"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-[#021b10] border border-amber-500/40 rounded-[28px] p-6 shadow-2xl space-y-5 overflow-hidden text-slate-100"
            >
              {/* Ambient Glow */}
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="flex items-center space-x-3.5">
                <Play369BrandLogo size="md" glow={true} />
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-black text-white font-sans uppercase">
                      PLAY369 Mobile App
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 font-mono">
                      PWA
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/70 font-sans mt-0.5">
                    সরাসরি আপনার মোবাইল হোম স্ক্রিনে ফুলস্ক্রিনে সেভ করুন।
                  </p>
                </div>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
                    <Zap className="w-3.5 h-3.5" />
                    <span>0% Lag Speed</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans leading-tight">
                    সুপার ফাস্ট ক্যাশিং ও লাইভ স্লট স্পিন।
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-cyan-400 font-bold">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Full Screen</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans leading-tight">
                    ১০০% ফুলস্ক্রিন নেটিভ ইন্টারফেস।
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                    <Bell className="w-3.5 h-3.5" />
                    <span>Push Alerts</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans leading-tight">
                    উইথড্রয়াল ও বোনাসের তাৎক্ষণিক অ্যালার্ট।
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-purple-400 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>1-Tap Biometric</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans leading-tight">
                    নিরাপদ ও দ্রুত অটো-লগইন।
                  </p>
                </div>
              </div>

              {/* iOS Step-by-Step Guide or One-Tap Android Button */}
              {isIOS ? (
                <div className="bg-gradient-to-r from-slate-900 to-cyan-950/30 border border-cyan-500/30 p-4 rounded-2xl space-y-3 text-xs">
                  <div className="text-white font-bold font-sans flex items-center space-x-2">
                    <Share className="w-4 h-4 text-cyan-400" />
                    <span>আইফোনে ইনস্টল করার নিয়ম (iOS Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-1.5 font-sans">
                    <li>
                      সাফারি ব্রাউজারের নিচের <strong className="text-cyan-300 font-mono">Share (শেয়ার)</strong> আইকনে চাপ দিন।
                    </li>
                    <li>
                      মেনু স্ক্রল করে <strong className="text-amber-300 font-mono">"Add to Home Screen"</strong> অপশন সিলেক্ট করুন।
                    </li>
                    <li>
                      উপরের ডানদিকের <strong className="text-emerald-300 font-mono">"Add"</strong> বাটনে ট্যাপ করলেই সম্পন্ন!
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      const res = await pwaService.promptInstall();
                      if (res === 'accepted') {
                        setShowModal(false);
                        setIsDismissed(true);
                      }
                    }}
                    className="w-full min-h-[46px] py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs font-mono uppercase tracking-wider shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>এখনই ইনস্টল করুন (Install PWA)</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400 font-sans">
                    কোন ভারী APK ফাইল ডাউনলোড করতে হবে না। সাইজ মাত্র ২ মেগাবাইট!
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
