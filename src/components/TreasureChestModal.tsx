/**
 * @file TreasureChestModal.tsx
 * @description Gamified 2x2 Emerald Treasure Chest Modal for GamePlay365.
 * Features ultra-clean Emerald & Gold Asian iGaming aesthetic, Framer Motion opening
 * animations, mystery reward reveals, sound effects, and direct seamless wallet crediting.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Gift,
  Coins,
  Crown,
  CheckCircle2,
  Lock,
  Unlock,
  RotateCcw,
  Zap,
  ArrowRight
} from 'lucide-react';
import { soundEngine } from '../services/soundEngine';
import { useWalletGame } from '../contexts/WalletGameContext';

interface TreasureChestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: 'BDT' | 'USD';
}

interface ChestItem {
  id: number;
  name: string;
  nameBn: string;
  tier: string;
  minBonus: number;
  maxBonus: number;
  icon: string;
  revealedReward?: {
    amount: number;
    title: string;
    description: string;
    type: 'CASH' | 'SPINS' | 'MULTIPLIER';
  };
}

const INITIAL_CHESTS: ChestItem[] = [
  {
    id: 1,
    name: 'Royal Emerald Chest',
    nameBn: 'রয়্যাল এমেরাল্ড চেস্ট',
    tier: 'VIP 1+',
    minBonus: 500,
    maxBonus: 2500,
    icon: '💎'
  },
  {
    id: 2,
    name: 'Imperial Dragon Box',
    nameBn: 'ইম্পেরিয়াল ড্রাগন বক্স',
    tier: 'DAILY',
    minBonus: 300,
    maxBonus: 1800,
    icon: '🐉'
  },
  {
    id: 3,
    name: 'Golden Fortune Vault',
    nameBn: 'গোল্ডেন ফরচুন ভল্ট',
    tier: 'LUCKY',
    minBonus: 800,
    maxBonus: 5000,
    icon: '🏆'
  },
  {
    id: 4,
    name: 'Mystery Phoenix Cache',
    nameBn: 'মিস্ট্রি ফিনিক্স ক্যাশ',
    tier: 'SUPER',
    minBonus: 400,
    maxBonus: 3000,
    icon: '🔥'
  }
];

export const TreasureChestModal: React.FC<TreasureChestModalProps> = ({
  isOpen,
  onClose,
  currency
}) => {
  const { topUpWallet, showToast, refreshState } = useWalletGame();

  const [chests, setChests] = useState<ChestItem[]>(INITIAL_CHESTS);
  const [openedChestId, setOpenedChestId] = useState<number | null>(null);
  const [isOpening, setIsOpening] = useState<boolean>(false);
  const [activeReward, setActiveReward] = useState<{
    chestId: number;
    amount: number;
    title: string;
    description: string;
    type: 'CASH' | 'SPINS' | 'MULTIPLIER';
  } | null>(null);

  if (!isOpen) return null;

  const handleOpenChest = (chest: ChestItem) => {
    if (openedChestId !== null || isOpening) return;

    setIsOpening(true);
    soundEngine.playClick(1200);

    // Calculate dynamic reward
    const rateMultiplier = currency === 'BDT' ? 1 : 1 / 120;
    const baseAmount = Math.floor(
      Math.random() * (chest.maxBonus - chest.minBonus + 1) + chest.minBonus
    );
    const finalAmount = Math.round(baseAmount * rateMultiplier);

    setTimeout(() => {
      const reward = {
        chestId: chest.id,
        amount: finalAmount,
        title: `${chest.nameBn} আনলকড!`,
        description: `অভিনন্দন! আপনার ওয়ালেটে ${currency === 'BDT' ? '৳' : '$'}${finalAmount.toLocaleString()} যোগ হয়েছে।`,
        type: 'CASH' as const
      };

      setChests((prev) =>
        prev.map((c) => (c.id === chest.id ? { ...c, revealedReward: reward } : c))
      );

      setOpenedChestId(chest.id);
      setActiveReward(reward);
      setIsOpening(false);

      // Sound & Wallet credit
      soundEngine.playBigWinCelebration();
      topUpWallet(finalAmount);
      refreshState();
      showToast(`🎉 ট্রেজার বক্স থেকে ${currency === 'BDT' ? '৳' : '$'}${finalAmount.toLocaleString()} ক্যাশ রিওয়ার্ড পেয়েছেন!`);
    }, 900);
  };

  const handleResetChests = () => {
    soundEngine.playClick(900);
    setChests(INITIAL_CHESTS);
    setOpenedChestId(null);
    setActiveReward(null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-emerald-900 via-emerald-950 to-[#021a10] border-2 border-amber-400/50 shadow-[0_0_50px_rgba(16,185,129,0.25)] overflow-hidden text-white font-sans"
        >
          {/* Top Emerald & Gold Header Ribbon */}
          <div className="relative px-6 py-4 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 border-b border-amber-400/30 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <div className="w-full h-full bg-emerald-950 rounded-[10px] flex items-center justify-center">
                  <Gift className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                  <span>এমেরাল্ড ট্রেজার চেস্ট</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30 uppercase">
                    2x2 MYSTERY
                  </span>
                </h3>
                <p className="text-xs text-emerald-200/80">
                  যেকোনো একটি ট্রেজার বক্স নির্বাচন করে সারপ্রাইজ বোনাস আনলক করুন
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                soundEngine.playClick(800);
                onClose();
              }}
              className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 hover:text-white hover:border-amber-400 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-6">
            {/* 2x2 Treasure Chest Grid */}
            <div className="grid grid-cols-2 gap-4">
              {chests.map((chest) => {
                const isOpened = chest.id === openedChestId;
                const isOtherOpened = openedChestId !== null && !isOpened;

                return (
                  <motion.div
                    key={chest.id}
                    whileHover={!openedChestId && !isOpening ? { scale: 1.03 } : {}}
                    whileTap={!openedChestId && !isOpening ? { scale: 0.97 } : {}}
                    onClick={() => handleOpenChest(chest)}
                    className={`relative rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all border-2 overflow-hidden min-h-[160px] ${
                      isOpened
                        ? 'bg-gradient-to-b from-amber-500/20 via-emerald-900 to-emerald-950 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.35)]'
                        : isOtherOpened
                        ? 'bg-emerald-950/40 border-emerald-800/40 opacity-50 cursor-not-allowed'
                        : 'bg-emerald-900/60 hover:bg-emerald-800/80 border-emerald-600/50 hover:border-amber-400 shadow-md'
                    }`}
                  >
                    {/* Badge */}
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-950/80 text-amber-300 text-[10px] font-black border border-amber-400/30">
                      {chest.tier}
                    </div>

                    {/* Chest Graphic / Animated Icon */}
                    <div className="my-2 relative">
                      <motion.div
                        animate={
                          isOpening && openedChestId === null
                            ? { rotate: [-4, 4, -4, 4, 0], scale: [1, 1.1, 1] }
                            : isOpened
                            ? { scale: [1, 1.25, 1.1], y: [-5, 0] }
                            : {}
                        }
                        transition={{ duration: 0.5, repeat: isOpening ? Infinity : 0 }}
                        className="text-4xl filter drop-shadow-md select-none"
                      >
                        {isOpened ? '✨🎁' : chest.icon}
                      </motion.div>

                      {isOpened && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="absolute -top-3 -right-3"
                        >
                          <Sparkles className="w-6 h-6 text-yellow-300 animate-spin-slow" />
                        </motion.div>
                      )}
                    </div>

                    {/* Chest Title / Reward Display */}
                    {isOpened && chest.revealedReward ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-1 mt-1"
                      >
                        <div className="text-xs font-black text-amber-300">
                          {chest.revealedReward.title}
                        </div>
                        <div className="text-lg font-black text-white font-mono bg-amber-400/20 px-2.5 py-0.5 rounded-lg border border-amber-400/40">
                          +{currency === 'BDT' ? '৳' : '$'}{chest.revealedReward.amount.toLocaleString()}
                        </div>
                      </motion.div>
                    ) : (
                      <div className="space-y-1 mt-1">
                        <div className="text-xs font-bold text-white tracking-tight">
                          {chest.nameBn}
                        </div>
                        <div className="text-[11px] text-emerald-300/80 font-mono">
                          {currency === 'BDT' ? '৳' : '$'}{chest.minBonus} - {currency === 'BDT' ? '৳' : '$'}{chest.maxBonus}
                        </div>
                        <div className="text-[10px] text-amber-400 font-bold flex items-center justify-center gap-1 mt-1">
                          <Unlock className="w-3 h-3" />
                          <span>খুলতে ক্লিক করুন</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Active Reward Congratulations Box */}
            {activeReward && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-emerald-900 to-amber-500/20 border-2 border-amber-400/60 text-center space-y-2"
              >
                <div className="flex items-center justify-center gap-1.5 text-amber-300 font-black text-sm">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>{activeReward.title}</span>
                </div>
                <p className="text-xs text-emerald-100/90">{activeReward.description}</p>
                <div className="text-xl font-black font-mono text-amber-300">
                  +{currency === 'BDT' ? '৳' : '$'}{activeReward.amount.toLocaleString()} ক্যাশ
                </div>
              </motion.div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-emerald-800/60">
              {openedChestId ? (
                <button
                  onClick={handleResetChests}
                  className="px-4 py-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>আবার খেলুন</span>
                </button>
              ) : (
                <div className="text-xs text-emerald-300/70 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>প্রতিদিন ১টি ফ্রি ট্রেজার চেস্ট আনলক করার সুযোগ</span>
                </div>
              )}

              <button
                onClick={() => {
                  soundEngine.playClick(1000);
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                {openedChestId ? 'কালেক্ট ও বন্ধ করুন' : 'বন্ধ করুন'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
