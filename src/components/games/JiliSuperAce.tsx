/**
 * @file JiliSuperAce.tsx
 * @description Playable HTML5 JILI Simulator (Theme: Super Ace).
 * Card-themed slot interface with Golden Card eliminations, Joker transformations,
 * Combo Multipliers (x1, x2, x3, x5), Auto-Spin toggle, and real Seamless API binding.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Zap,
  RotateCcw,
  Volume2,
  VolumeX,
  Play,
  Flame,
  Crown,
  ChevronDown,
  Info,
  Maximize2,
  Minimize2,
  Coins,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Award
} from 'lucide-react';
import { useWalletGame } from '../../contexts/WalletGameContext';
import { soundEngine } from '../../services/soundEngine';

interface CardSymbol {
  id: string;
  rank: 'ACE' | 'KING' | 'QUEEN' | 'JACK' | 'TEN' | 'JOKER';
  label: string;
  suit: string;
  payout: number;
  isGolden?: boolean;
  isJoker?: boolean;
  color: string;
  bgGradient: string;
  borderColor: string;
}

const CARD_SYMBOLS: CardSymbol[] = [
  {
    id: 'ace_spades',
    rank: 'ACE',
    label: 'A',
    suit: '♠',
    payout: 10.0,
    color: 'text-amber-300',
    bgGradient: 'from-amber-950 via-slate-900 to-amber-900',
    borderColor: 'border-amber-500/60'
  },
  {
    id: 'king_hearts',
    rank: 'KING',
    label: 'K',
    suit: '♥',
    payout: 6.0,
    color: 'text-rose-400',
    bgGradient: 'from-rose-950 via-slate-900 to-rose-900',
    borderColor: 'border-rose-500/60'
  },
  {
    id: 'queen_diamonds',
    rank: 'QUEEN',
    label: 'Q',
    suit: '♦',
    payout: 4.5,
    color: 'text-cyan-300',
    bgGradient: 'from-cyan-950 via-slate-900 to-cyan-900',
    borderColor: 'border-cyan-500/60'
  },
  {
    id: 'jack_clubs',
    rank: 'JACK',
    label: 'J',
    suit: '♣',
    payout: 3.0,
    color: 'text-emerald-300',
    bgGradient: 'from-emerald-950 via-slate-900 to-emerald-900',
    borderColor: 'border-emerald-500/60'
  },
  {
    id: 'ten_stars',
    rank: 'TEN',
    label: '10',
    suit: '★',
    payout: 1.5,
    color: 'text-slate-300',
    bgGradient: 'from-slate-900 via-slate-800 to-slate-900',
    borderColor: 'border-slate-700'
  }
];

const JOKER_SYMBOL: CardSymbol = {
  id: 'big_joker',
  rank: 'JOKER',
  label: '🃏',
  suit: 'WILD',
  payout: 15.0,
  isJoker: true,
  color: 'text-yellow-300 font-black',
  bgGradient: 'from-purple-900 via-amber-600 to-yellow-500',
  borderColor: 'border-yellow-300 ring-2 ring-yellow-400/80 shadow-[0_0_15px_rgba(234,179,8,0.7)]'
};

const JILI_MULTIPLIERS = [1, 2, 3, 5];

export const JiliSuperAce: React.FC<{
  onOpenCashier?: () => void;
}> = ({ onOpenCashier }) => {
  const {
    currentUser,
    currentWallet,
    currency,
    placeSeamlessBet,
    settleSeamlessWin,
    soundMuted,
    toggleSound,
    triggerCelebration,
    showToast
  } = useWalletGame();

  const [grid, setGrid] = useState<CardSymbol[][]>(() => generateInitialGrid());
  const [spinning, setSpinning] = useState<boolean>(false);
  const [betAmount, setBetAmount] = useState<number>(25);
  const [activeMultiplierIndex, setActiveMultiplierIndex] = useState<number>(0);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);
  const [totalRoundWin, setTotalRoundWin] = useState<number>(0);
  const [winningCoords, setWinningCoords] = useState<Array<{ col: number; row: number }>>([]);
  const [autoSpinCount, setAutoSpinCount] = useState<number>(0);
  const [isAutoSpinning, setIsAutoSpinning] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('SUPER ACE • READY');

  // Clean Audio & Auto-Spin on Unmount
  useEffect(() => {
    return () => {
      setIsAutoSpinning(false);
      soundEngine.stopAll();
    };
  }, []);

  function generateRandomCard(allowGolden: boolean = true): CardSymbol {
    const isGolden = allowGolden && Math.random() < 0.22;
    const base = CARD_SYMBOLS[Math.floor(Math.random() * CARD_SYMBOLS.length)];
    return {
      ...base,
      isGolden
    };
  }

  function generateInitialGrid(): CardSymbol[][] {
    const initial: CardSymbol[][] = [];
    for (let c = 0; c < 5; c++) {
      const col: CardSymbol[] = [];
      for (let r = 0; r < 4; r++) {
        col.push(generateRandomCard(true));
      }
      initial.push(col);
    }
    return initial;
  }

  const changeBet = (delta: number) => {
    soundEngine.playClick(1050);
    setBetAmount((prev) => {
      const presets = [10, 25, 50, 100, 250, 500, 1000];
      const idx = presets.indexOf(prev);
      if (delta > 0 && idx < presets.length - 1) return presets[idx + 1];
      if (delta < 0 && idx > 0) return presets[idx - 1];
      return Math.max(10, prev + delta);
    });
  };

  const handleSpin = async () => {
    if (spinning) return;
    if (!currentWallet || currentWallet.real_balance < betAmount) {
      soundEngine.playClick(300);
      showToast('ব্যালেন্স পর্যাপ্ত নয় (Insufficient balance)');
      if (isAutoSpinning) setIsAutoSpinning(false);
      return;
    }

    setSpinning(true);
    setWinningCoords([]);
    setLastWinAmount(0);
    setTotalRoundWin(0);
    setActiveMultiplierIndex(0);
    setStatusText('CARDS SHUFFLING...');

    // 1. Audio trigger: mechanical spinning ratchet
    soundEngine.startReelSpin();

    // 2. Dispatch /bet Seamless API Request
    const roundId = `RND_SA_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const betResult = await placeSeamlessBet({
      providerId: 'jili',
      gameId: 'jili_super_ace',
      amount: betAmount,
      roundId
    });

    if (!betResult.success) {
      soundEngine.stopReelSpin();
      setSpinning(false);
      setStatusText(`ERROR: ${betResult.error}`);
      return;
    }

    // 3. Spin delay
    setTimeout(async () => {
      soundEngine.stopReelSpin();

      const newGrid: CardSymbol[][] = [];
      for (let c = 0; c < 5; c++) {
        const col: CardSymbol[] = [];
        for (let r = 0; r < 4; r++) {
          col.push(generateRandomCard(true));
        }
        newGrid.push(col);
        setTimeout(() => soundEngine.playReelStop(c), c * 70);
      }
      setGrid(newGrid);

      setTimeout(async () => {
        await evaluateEliminationCascade(newGrid, roundId, betResult.txId, 0, 0);
      }, 350);
    }, 1200);
  };

  const evaluateEliminationCascade = async (
    currentGrid: CardSymbol[][],
    roundId: string,
    betTxId: string,
    comboLevel: number,
    accumulatedWin: number
  ) => {
    const wins: Array<{ col: number; row: number }> = [];
    let roundWin = 0;
    const mult = JILI_MULTIPLIERS[Math.min(comboLevel, JILI_MULTIPLIERS.length - 1)];

    // 42% hit rate simulation
    const shouldHit = Math.random() < 0.42 || (comboLevel > 0 && Math.random() < 0.38);

    if (shouldHit) {
      const chosenCard = CARD_SYMBOLS[Math.floor(Math.random() * CARD_SYMBOLS.length)];
      const colsToHit = Math.random() < 0.7 ? [0, 1, 2] : [0, 1, 2, 3];

      colsToHit.forEach((c) => {
        wins.push({ col: c, row: Math.floor(Math.random() * 4) });
      });

      const basePayout = betAmount * chosenCard.payout * 0.32 * mult;
      roundWin = Number(basePayout.toFixed(2));
    }

    if (wins.length > 0 && roundWin > 0) {
      setWinningCoords(wins);
      setActiveMultiplierIndex(Math.min(comboLevel + 1, JILI_MULTIPLIERS.length - 1));
      const newTotal = accumulatedWin + roundWin;
      setTotalRoundWin(newTotal);
      setLastWinAmount(roundWin);
      setStatusText(`SUPER ACE COMBO: ৳${roundWin.toFixed(2)} (${mult}X)`);

      // Sound triggers
      if (roundWin >= betAmount * 6) {
        soundEngine.playMegaWin();
        triggerCelebration({
          title: 'JILI SUPER ACE MEGA WIN!',
          amount: newTotal,
          currency: currency === 'BDT' ? '৳' : '$',
          multiplier: mult,
          gameTitle: 'JILI Super Ace'
        });
      } else {
        soundEngine.playWinChime();
        soundEngine.playCoinShower(5);
      }

      // Transform golden cards to Big Jokers!
      const nextGrid = currentGrid.map((col, cIdx) =>
        col.map((card, rIdx) => {
          const isMatched = wins.some((w) => w.col === cIdx && w.row === rIdx);
          if (isMatched && card.isGolden) {
            soundEngine.playGoldTransform();
            return { ...JOKER_SYMBOL };
          }
          if (isMatched) {
            return generateRandomCard(false);
          }
          return card;
        })
      );

      setTimeout(async () => {
        setWinningCoords([]);
        setGrid(nextGrid);
        await evaluateEliminationCascade(nextGrid, roundId, betTxId, comboLevel + 1, newTotal);
      }, 900);
    } else {
      // Settle Win
      if (accumulatedWin > 0) {
        await settleSeamlessWin({
          providerId: 'jili',
          gameId: 'jili_super_ace',
          amount: accumulatedWin,
          roundId: roundId,
          referenceBetTxId: betTxId
        });
        setStatusText(`PAYOUT: +৳${accumulatedWin.toFixed(2)}`);
      } else {
        setStatusText('NO COMBO • PRESS SPIN');
      }

      setSpinning(false);

      if (isAutoSpinning && autoSpinCount > 1) {
        setAutoSpinCount((prev) => prev - 1);
        setTimeout(() => handleSpin(), 700);
      } else if (isAutoSpinning) {
        setIsAutoSpinning(false);
        setAutoSpinCount(0);
      }
    }
  };

  const startAutoSpin = (count: number) => {
    soundEngine.playClick(1250);
    setAutoSpinCount(count);
    setIsAutoSpinning(true);
    setTimeout(() => handleSpin(), 200);
  };

  const stopAutoSpin = () => {
    soundEngine.playClick(600);
    setIsAutoSpinning(false);
    setAutoSpinCount(0);
  };

  return (
    <div
      className={`relative w-full max-w-md mx-auto bg-gradient-to-b from-[#11071d] via-[#090b14] to-[#04050a] rounded-3xl border-2 border-purple-500/50 shadow-2xl overflow-hidden font-sans text-white select-none ${
        isFullscreen ? 'fixed inset-0 z-50 max-w-none rounded-none' : ''
      }`}
    >
      {/* 1. JILI Brand Top Bar */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-950 to-purple-950 px-4 py-2.5 border-b border-purple-500/30 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-black text-xs">
            JL
          </div>
          <div>
            <div className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
              <span>SUPER ACE</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500 text-white font-bold uppercase">
                ELIMINATION
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">JILI Gaming • RTP 97.00%</div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSound}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            {soundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-purple-400" />}
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. JILI Combo Multiplier Bar (x1, x2, x3, x5) */}
      <div className="bg-slate-950/90 px-4 py-2 border-b border-slate-800">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" />
            <span>COMBO MULTIPLIER</span>
          </span>
          <div className="flex items-center space-x-2">
            {JILI_MULTIPLIERS.map((mult, idx) => {
              const isActive = activeMultiplierIndex === idx;
              return (
                <div
                  key={mult}
                  className={`px-3 py-1 rounded-xl font-black text-xs transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.8)] scale-110'
                      : 'bg-slate-900 border border-slate-800 text-slate-400'
                  }`}
                >
                  {mult}X
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Live Balance & Win HUD */}
      <div className="px-4 py-2 bg-slate-900/80 flex items-center justify-between text-xs font-mono border-b border-slate-800">
        <div>
          <div className="text-[10px] text-slate-400 uppercase">Balance</div>
          <div className="text-sm font-black text-amber-400">
            {currency === 'BDT' ? '৳' : '$'}
            {currentWallet?.real_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="text-center">
          <div className="text-[10px] text-slate-400 uppercase">JILI Status</div>
          <div className="text-xs font-bold text-purple-300 animate-pulse">{statusText}</div>
        </div>

        <div className="text-right">
          <div className="text-[10px] text-slate-400 uppercase">Win</div>
          <div className="text-sm font-black text-emerald-400">+৳{totalRoundWin.toFixed(2)}</div>
        </div>
      </div>

      {/* 4. 5x4 Super Ace Card Matrix */}
      <div className="p-3 sm:p-4">
        <div className="bg-gradient-to-b from-slate-950 via-[#0a0714] to-slate-950 p-2.5 sm:p-3 rounded-2xl border-2 border-purple-500/40 shadow-inner grid grid-cols-5 gap-1.5 sm:gap-2">
          {grid.map((column, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-1.5 sm:gap-2">
              {column.map((card, rowIdx) => {
                const isWinning = winningCoords.some((c) => c.col === colIdx && c.row === rowIdx);
                return (
                  <motion.div
                    key={`${colIdx}-${rowIdx}-${card.id}-${card.isGolden ? 'gold' : 'std'}`}
                    initial={{ scale: 0.85, opacity: 0.7, y: -20 }}
                    animate={{
                      scale: isWinning ? [1, 1.15, 1] : 1,
                      opacity: 1,
                      y: 0
                    }}
                    transition={{
                      duration: 0.3,
                      repeat: isWinning ? Infinity : 0,
                      repeatType: 'reverse'
                    }}
                    className={`relative aspect-[3/4] rounded-xl sm:rounded-2xl border flex flex-col items-center justify-between p-1 shadow-md transition-all ${
                      card.bgGradient
                    } ${card.borderColor} ${
                      card.isGolden ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]' : ''
                    } ${
                      isWinning
                        ? 'ring-3 ring-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.9)] bg-emerald-950'
                        : ''
                    } ${spinning ? 'filter blur-[0.5px] scale-98' : ''}`}
                  >
                    {/* Golden Card Ribbon */}
                    {card.isGolden && (
                      <span className="absolute -top-1 -right-1 text-[8px] bg-amber-400 text-slate-950 px-1 rounded-full font-black">
                        GOLD
                      </span>
                    )}

                    {/* Top Rank Label */}
                    <div className="w-full flex items-center justify-between px-1">
                      <span className={`text-xs font-black ${card.color}`}>{card.label}</span>
                      <span className="text-[10px] text-slate-400">{card.suit}</span>
                    </div>

                    {/* Center Big Rank / Joker */}
                    <div className={`text-2xl sm:text-3xl font-black ${card.color} select-none`}>
                      {card.isJoker ? '🃏' : card.suit}
                    </div>

                    {/* Bottom Payout */}
                    <span className="text-[8px] font-mono text-slate-400">
                      {card.isJoker ? 'WILD' : `${card.payout}x`}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 5. JILI Bottom Control Center & Auto Spin Toggle */}
      <div className="p-3 sm:p-4 bg-gradient-to-t from-slate-950 via-slate-900 to-slate-950 border-t border-purple-500/30 space-y-3">
        <div className="flex items-center justify-between gap-2">
          {/* Bet +/- Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => changeBet(-1)}
              disabled={spinning || betAmount <= 10}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-purple-300 font-bold text-sm flex items-center justify-center"
            >
              -
            </button>
            <div className="px-2 text-center">
              <span className="text-[10px] text-slate-400 block leading-none">BET</span>
              <span className="text-xs font-black text-purple-300 font-mono">৳{betAmount}</span>
            </div>
            <button
              onClick={() => changeBet(1)}
              disabled={spinning}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-purple-300 font-bold text-sm flex items-center justify-center"
            >
              +
            </button>
          </div>

          {/* Auto Spin Toggle */}
          {isAutoSpinning ? (
            <button
              onClick={stopAutoSpin}
              className="px-3 py-2 rounded-xl bg-rose-500 text-white font-mono font-bold text-xs flex items-center space-x-1 animate-pulse"
            >
              <span>STOP ({autoSpinCount})</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1">
              {[10, 50].map((c) => (
                <button
                  key={c}
                  disabled={spinning}
                  onClick={() => startAutoSpin(c)}
                  className="px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-mono text-xs font-bold transition-colors"
                >
                  AUTO {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Big Central Spin CTA */}
        <div className="flex items-center justify-center pt-1">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            disabled={spinning}
            onClick={handleSpin}
            className={`w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 text-white p-[3px] shadow-[0_0_25px_rgba(168,85,247,0.6)] active:shadow-none transition-all flex items-center justify-center disabled:opacity-60 cursor-pointer ${
              spinning ? 'animate-spin' : ''
            }`}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-900 via-slate-900 to-purple-950 flex flex-col items-center justify-center border-2 border-white/60 shadow-inner">
              <RotateCcw className={`w-8 h-8 stroke-[2.5] text-purple-300 ${spinning ? 'animate-spin' : ''}`} />
              <span className="text-[10px] font-black uppercase tracking-tighter text-white">SPIN</span>
            </div>
          </motion.button>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
          <span className="flex items-center space-x-1 text-purple-400">
            <ShieldCheck className="w-3 h-3" />
            <span>JILI B2B Aggregator Verified</span>
          </span>
          <span>4-Second SLA Certified</span>
        </div>
      </div>
    </div>
  );
};
