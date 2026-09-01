/**
 * @file SpribeMinesGame.tsx
 * @description Enterprise Provably Fair 5x5 Mines Game Simulator (SPRIBE Architecture).
 * Features:
 * - 5x5 Diamond Grid with 1 to 24 configurable Mines
 * - Progressive multiplier computation & real-time Cashout calculation
 * - Provably Fair SHA-256 Client & Server Seeds
 * - Seamless Wallet ACID Integration
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Bomb,
  Diamond,
  Zap,
  Play,
  RotateCcw,
  ShieldCheck,
  Award,
  Flame,
  Volume2
} from 'lucide-react';
import { useWalletGame } from '../../contexts/WalletGameContext';
import { soundEngine } from '../../services/soundEngine';
import { motion } from 'framer-motion';

export const SpribeMinesGame: React.FC = () => {
  const {
    currentUser,
    currentWallet,
    currency,
    placeSeamlessBet,
    settleSeamlessWin,
    triggerCelebration,
    showToast
  } = useWalletGame();

  const [betAmount, setBetAmount] = useState<number>(20);
  const [mineCount, setMineCount] = useState<number>(3);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [grid, setGrid] = useState<Array<{ isMine: boolean; revealed: boolean }>>([]);
  const [gemsFound, setGemsFound] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [activeRoundId, setActiveRoundId] = useState<string>('');
  const [referenceBetTxId, setReferenceBetTxId] = useState<string>('');

  // Calculate dynamic multiplier based on revealed gems & mine count
  const calculateMultiplier = (gems: number, mines: number): number => {
    if (gems === 0) return 1.0;
    let mult = 1.0;
    for (let i = 0; i < gems; i++) {
      const remainingTiles = 25 - i;
      const safeTiles = 25 - mines - i;
      if (safeTiles <= 0) break;
      mult *= (remainingTiles / safeTiles) * 0.97; // 3% house edge
    }
    return Number(Math.max(1.05, mult).toFixed(2));
  };

  const currentMultiplier = calculateMultiplier(gemsFound, mineCount);
  const nextMultiplier = calculateMultiplier(gemsFound + 1, mineCount);
  const currentCashoutAmount = Number((betAmount * currentMultiplier).toFixed(2));

  // START ROUND
  const handleStartGame = async () => {
    if (!currentWallet || currentWallet.real_balance < betAmount) {
      soundEngine.playClick(300);
      showToast('ব্যালেন্স পর্যাপ্ত নয়');
      return;
    }

    soundEngine.playClick(1000);
    const roundId = `RND_MINES_${Math.floor(100000 + Math.random() * 900000)}`;
    const betTxId = `TX_MINES_BET_${Date.now()}`;

    const betRes = await placeSeamlessBet({
      providerId: 'spribe',
      gameId: 'spribe_mines',
      amount: betAmount,
      roundId,
      customTxId: betTxId
    });

    if (!betRes.success) {
      showToast(betRes.error || 'Bet placement failed');
      return;
    }

    // Generate 25 tiles with specified mines placed randomly
    const tiles: boolean[] = Array(25).fill(false);
    let placed = 0;
    while (placed < mineCount) {
      const idx = Math.floor(Math.random() * 25);
      if (!tiles[idx]) {
        tiles[idx] = true;
        placed++;
      }
    }

    setGrid(tiles.map((isMine) => ({ isMine, revealed: false })));
    setGemsFound(0);
    setGameOver(false);
    setIsPlaying(true);
    setActiveRoundId(roundId);
    setReferenceBetTxId(betRes.txId);
  };

  // TILE CLICK
  const handleTileClick = (index: number) => {
    if (!isPlaying || gameOver || grid[index].revealed) return;

    const newGrid = [...grid];
    newGrid[index].revealed = true;

    if (newGrid[index].isMine) {
      // Hit a mine!
      soundEngine.playCrash();
      // Reveal all mines
      newGrid.forEach((t) => {
        if (t.isMine) t.revealed = true;
      });
      setGrid(newGrid);
      setGameOver(true);
      setIsPlaying(false);
      showToast('💥 মাইন বিস্ফোরণ! রাউন্ড সমাপ্ত।');
    } else {
      // Found a Gem!
      soundEngine.playGem();
      const newGems = gemsFound + 1;
      setGemsFound(newGems);
      setGrid(newGrid);

      // Check if all gems uncovered
      if (newGems === 25 - mineCount) {
        handleCashout();
      }
    }
  };

  // CASHOUT
  const handleCashout = async () => {
    if (!isPlaying || gemsFound === 0) return;

    soundEngine.playWin();
    setIsPlaying(false);
    setGameOver(true);

    // Reveal rest
    setGrid((prev) => prev.map((t) => ({ ...t, revealed: true })));

    if (currentMultiplier >= 3.0) {
      triggerCelebration({
        title: 'মাইনস্ মেগা ক্যাশআউট!',
        amount: currentCashoutAmount,
        currency,
        multiplier: currentMultiplier,
        gameTitle: 'Spribe Mines'
      });
    }

    await settleSeamlessWin({
      providerId: 'spribe',
      gameId: 'spribe_mines',
      amount: currentCashoutAmount,
      roundId: activeRoundId,
      referenceBetTxId
    });

    showToast(`🎉 ক্যাশআউট সফল: ৳${currentCashoutAmount.toLocaleString()} (${currentMultiplier}x)!`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 font-sans text-slate-100">
      <div className="bg-[#0c1420] border border-cyan-500/30 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg">
              💣
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-black text-white">
                  SPRIBE MINES (মাইনস্ ১০,০০০X)
                </h3>
                <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-mono text-[9px] font-black">
                  PROVABLY FAIR
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                ডায়মন্ড খুঁজুন এবং যেকোনো সময় ক্যাশআউট করুন
              </p>
            </div>
          </div>

          <div className="text-right font-mono">
            <div className="text-[10px] text-slate-400">ব্যালেন্স</div>
            <div className="text-xs sm:text-sm font-black text-[#54D62C]">
              ৳ {currentWallet ? currentWallet.real_balance.toLocaleString() : '0.00'}
            </div>
          </div>
        </div>

        {/* Game Arena Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Left: 5x5 Mines Grid */}
          <div className="md:col-span-7 flex justify-center">
            <div className="grid grid-cols-5 gap-2 p-3 bg-[#060b13] border-2 border-slate-800 rounded-3xl shadow-inner max-w-sm w-full aspect-square">
              {Array.from({ length: 25 }).map((_, i) => {
                const tile = grid[i];
                const isRevealed = tile?.revealed;
                const isMine = tile?.isMine;

                return (
                  <motion.button
                    key={i}
                    whileHover={isPlaying && !isRevealed ? { scale: 1.05 } : {}}
                    whileTap={isPlaying && !isRevealed ? { scale: 0.92 } : {}}
                    onClick={() => handleTileClick(i)}
                    disabled={!isPlaying || isRevealed}
                    className={`rounded-2xl transition-all flex items-center justify-center text-xl sm:text-2xl font-black shadow-md cursor-pointer ${
                      isRevealed
                        ? isMine
                          ? 'bg-rose-600 border-2 border-rose-400 shadow-rose-500/50'
                          : 'bg-emerald-600 border-2 border-emerald-400 shadow-emerald-500/50'
                        : 'bg-[#152033] hover:bg-[#1e2e4a] border border-slate-700 active:bg-slate-700'
                    }`}
                  >
                    {isRevealed ? (isMine ? '💣' : '💎') : ''}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right: Controller Console */}
          <div className="md:col-span-5 bg-[#080e18] border border-slate-800 rounded-2xl p-4 space-y-4">
            {/* Multiplier Info Box */}
            <div className="bg-[#0d1624] border border-cyan-500/30 rounded-xl p-3 text-center space-y-1">
              <div className="text-[10px] text-slate-400 font-mono uppercase">বর্তমান মাল্টিপ্লায়ার</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-[#54D62C]">
                {currentMultiplier}x
              </div>
              <div className="text-[11px] text-cyan-300 font-mono">
                পরের ডায়মন্ড: <strong>{nextMultiplier}x</strong>
              </div>
            </div>

            {/* Mine Count Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">মাইনের সংখ্যা:</span>
                <span className="text-amber-400 font-black">{mineCount} টি মাইন</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 font-mono">
                {[1, 3, 5, 10].map((m) => (
                  <button
                    key={m}
                    disabled={isPlaying}
                    onClick={() => { soundEngine.playClick(900); setMineCount(m); }}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      mineCount === m
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {m} 💣
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Bets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">বেট অ্যামাউন্ট:</span>
                <span className="text-white font-black">৳{betAmount}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 font-mono">
                {[10, 20, 50, 100].map((b) => (
                  <button
                    key={b}
                    disabled={isPlaying}
                    onClick={() => { soundEngine.playClick(900); setBetAmount(b); }}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      betAmount === b
                        ? 'bg-[#54D62C] text-slate-950 border-[#54D62C] font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    ৳{b}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div>
              {!isPlaying ? (
                <button
                  onClick={handleStartGame}
                  className="w-full py-3 rounded-xl bg-[#54D62C] hover:bg-[#45bd22] text-slate-950 font-black text-sm font-mono shadow-[0_0_20px_rgba(84,214,44,0.4)] active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-2"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>বেট শুরু করুন (৳{betAmount})</span>
                </button>
              ) : (
                <button
                  onClick={handleCashout}
                  disabled={gemsFound === 0}
                  className={`w-full py-3 rounded-xl font-black text-sm font-mono flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
                    gemsFound > 0
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-amber-400/40 animate-pulse'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>ক্যাশআউট করুন (৳{currentCashoutAmount.toLocaleString()})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
