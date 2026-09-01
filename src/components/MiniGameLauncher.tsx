/**
 * @file MiniGameLauncher.tsx
 * @description Enterprise Multi-Engine Casino Simulator & Real Demo Hub for Playall 365.
 * Features Official Certified Provider Live Demos (Pragmatic Play, PG Soft, JILI, Spribe, Evolution),
 * Provably Fair Canvas Aviator, JILI Super Ace, PG Soft Mahjong Ways 2, and Lightning Roulette.
 */

import React, { useState, useEffect } from 'react';
import {
  Zap,
  Play,
  RotateCcw,
  Sparkles,
  Award,
  TrendingUp,
  AlertCircle,
  Coins,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Flame,
  Volume2,
  VolumeX,
  History,
  ShieldCheck,
  ChevronLeft,
  Globe,
  Layers,
  Gamepad2,
  Tv,
  Crown
} from 'lucide-react';
import { useWalletGame } from '../contexts/WalletGameContext';
import { soundEngine } from '../services/soundEngine';
import { assetLoader, GameAsset } from '../services/assetLoader';
import { PgSoftMahjongWays } from './games/PgSoftMahjongWays';
import { JiliSuperAce } from './games/JiliSuperAce';
import { AviatorProGame } from './games/AviatorProGame';
import { DemoIframe, OFFICIAL_DEMO_GAMES } from './games/DemoIframe';
import { LiveCasinoStudio } from './games/LiveCasinoStudio';
import { SpribeMinesGame } from './games/SpribeMinesGame';

interface MiniGameLauncherProps {
  onBackToLobby: () => void;
  onOpenCashier: () => void;
  defaultGameId?: string;
}

export const MiniGameLauncher: React.FC<MiniGameLauncherProps> = ({
  onBackToLobby,
  onOpenCashier,
  defaultGameId = 'vs20olympgate'
}) => {
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

  type GameType = 'real_demo' | 'live_casino' | 'mines' | 'pgsoft' | 'jili' | 'aviator' | 'bonanza' | 'roulette';

  const [activeGame, setActiveGame] = useState<GameType>(() => {
    if (defaultGameId.includes('baccarat') || defaultGameId.includes('dragon') || defaultGameId.includes('teen') || defaultGameId.includes('casino')) {
      return 'live_casino';
    }
    if (defaultGameId.includes('mines')) {
      return 'mines';
    }
    if (defaultGameId.startsWith('vs') || defaultGameId.includes('pragmatic') || defaultGameId.includes('olympus') || defaultGameId.includes('sugar') || defaultGameId.includes('doghouse') || defaultGameId.includes('starlight')) {
      return 'real_demo';
    }
    if (defaultGameId.includes('mahjong') || defaultGameId.includes('pgsoft') || defaultGameId.includes('tiger')) return 'pgsoft';
    if (defaultGameId.includes('jili') || defaultGameId.includes('ace') || defaultGameId.includes('boxing') || defaultGameId.includes('gems')) return 'jili';
    if (defaultGameId.includes('aviator') || defaultGameId.includes('spribe') || defaultGameId.includes('crash') || defaultGameId.includes('flyx')) return 'aviator';
    if (defaultGameId.includes('bonanza')) return 'real_demo';
    if (defaultGameId.includes('roulette')) return 'live_casino';
    return 'real_demo';
  });

  const [selectedDemoGameId, setSelectedDemoGameId] = useState<string>(() => {
    const matched = OFFICIAL_DEMO_GAMES.find((g) => g.id === defaultGameId || defaultGameId.includes(g.symbol));
    return matched ? matched.id : 'vs20olympgate';
  });

  // --------------------------------------------------------------------------
  // SWEET BONANZA SLOT REEL ENGINE (SEAMLESS MODE)
  // --------------------------------------------------------------------------
  const [slotBetAmount, setSlotBetAmount] = useState<number>(10);
  const [slotSpinning, setSlotSpinning] = useState<boolean>(false);
  const [slotGrid, setSlotGrid] = useState<string[][]>([
    ['🍓', '🍇', '🍉', '🍌', '🍬'],
    ['🍉', '🍬', '⭐', '🍇', '🍓'],
    ['🍬', '🍓', '🍌', '🍉', '💎']
  ]);
  const [slotLastWin, setSlotLastWin] = useState<number>(0);
  const [slotWinMultiplier, setSlotWinMultiplier] = useState<number>(0);

  // --------------------------------------------------------------------------
  // LIGHTNING ROULETTE ENGINE
  // --------------------------------------------------------------------------
  const [rouletteBetAmount, setRouletteBetAmount] = useState<number>(25);
  const [rouletteSelectedBet, setRouletteSelectedBet] = useState<'RED' | 'BLACK' | 'GREEN_ZERO' | '1-18' | '19-36' | '7'>('RED');
  const [rouletteSpinning, setRouletteSpinning] = useState<boolean>(false);
  const [rouletteResultNumber, setRouletteResultNumber] = useState<number | null>(null);
  const [rouletteLightningStrikes, setRouletteLightningStrikes] = useState<Array<{ num: number; mult: number }>>([]);
  const [rouletteLastWin, setRouletteLastWin] = useState<number>(0);

  const [message, setMessage] = useState<string | null>(null);

  // Clean Audio on switch
  useEffect(() => {
    return () => {
      soundEngine.stopAll();
    };
  }, [activeGame]);

  // Handle Slot Machine Spin
  const handleSpinSlot = async () => {
    if (!currentWallet || currentWallet.real_balance < slotBetAmount) {
      soundEngine.playClick(300);
      setMessage('ব্যালেন্স পর্যাপ্ত নয় (Insufficient balance)');
      return;
    }

    soundEngine.playSpin();
    setMessage(null);
    setSlotSpinning(true);
    setSlotLastWin(0);

    const roundId = `RND_SB_${Math.floor(100000 + Math.random() * 900000)}`;
    const betTxId = `TX_SB_BET_${Date.now()}`;

    const betRes = await placeSeamlessBet({
      providerId: 'pragmatic',
      gameId: 'vs20sweetbonanza',
      amount: slotBetAmount,
      roundId: roundId,
      customTxId: betTxId
    });

    if (!betRes.success) {
      setSlotSpinning(false);
      setMessage(betRes.error || 'Bet failed');
      return;
    }

    const symbols = ['🍓', '🍇', '🍉', '🍌', '🍬', '⭐', '💎', '💣'];
    let spinCount = 0;
    const interval = setInterval(() => {
      setSlotGrid([
        [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]],
        [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]],
        [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]]
      ]);
      spinCount++;
      if (spinCount > 10) {
        clearInterval(interval);
        finalizeSlotSpin(betRes.txId, roundId);
      }
    }, 90);
  };

  const finalizeSlotSpin = async (referenceBetTxId: string, roundId: string) => {
    const isWin = Math.random() > 0.42;
    let multiplier = 0;
    let finalSymbols: string[][];

    if (isWin) {
      const luckyMults = [1.5, 2.0, 3.5, 5.0, 10.0, 25.0, 100.0];
      multiplier = luckyMults[Math.floor(Math.random() * luckyMults.length)];
      finalSymbols = [
        ['🍬', '🍬', '🍬', '🍬', '🍉'],
        ['💎', '⭐', '🍬', '🍇', '🍓'],
        ['🍓', '🍌', '🍬', '💣', '💎']
      ];
    } else {
      multiplier = 0;
      finalSymbols = [
        ['🍓', '🍇', '🍉', '🍌', '🍬'],
        ['🍉', '🍬', '⭐', '🍇', '🍓'],
        ['🍬', '🍓', '🍌', '🍉', '💎']
      ];
    }

    setSlotGrid(finalSymbols);
    setSlotSpinning(false);

    if (multiplier > 0) {
      const winAmount = Number((slotBetAmount * multiplier).toFixed(2));
      setSlotLastWin(winAmount);
      setSlotWinMultiplier(multiplier);

      soundEngine.playWin();
      if (multiplier >= 10) {
        triggerCelebration({
          title: 'সুইট বোনানজা বিগ উইন!',
          amount: winAmount,
          currency: currency,
          multiplier: multiplier,
          gameTitle: 'Sweet Bonanza'
        });
      }

      await settleSeamlessWin({
        providerId: 'pragmatic',
        gameId: 'vs20sweetbonanza',
        amount: winAmount,
        roundId: roundId,
        referenceBetTxId: referenceBetTxId
      });
    }
  };

  // Handle Lightning Roulette Spin
  const handleSpinRoulette = async () => {
    if (!currentWallet || currentWallet.real_balance < rouletteBetAmount) {
      soundEngine.playClick(300);
      setMessage('ব্যালেন্স পর্যাপ্ত নয়');
      return;
    }

    soundEngine.playSpin();
    setMessage(null);
    setRouletteSpinning(true);
    setRouletteLastWin(0);
    setRouletteResultNumber(null);

    const roundId = `RND_RL_${Math.floor(100000 + Math.random() * 900000)}`;
    const betTxId = `TX_RL_BET_${Date.now()}`;

    const betRes = await placeSeamlessBet({
      providerId: 'evolution',
      gameId: 'evolution_lightning_roulette',
      amount: rouletteBetAmount,
      roundId: roundId,
      customTxId: betTxId
    });

    if (!betRes.success) {
      setRouletteSpinning(false);
      setMessage(betRes.error || 'Bet failed');
      return;
    }

    const strikes = [
      { num: Math.floor(Math.random() * 37), mult: [50, 100, 200, 500][Math.floor(Math.random() * 4)] },
      { num: Math.floor(Math.random() * 37), mult: [50, 100, 200][Math.floor(Math.random() * 3)] }
    ];
    setRouletteLightningStrikes(strikes);
    soundEngine.playLightning();

    setTimeout(async () => {
      const drawn = Math.floor(Math.random() * 37);
      setRouletteResultNumber(drawn);

      let isWin = false;
      let mult = 0;

      if (rouletteSelectedBet === 'RED' && [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(drawn)) {
        isWin = true;
        mult = 2;
      } else if (rouletteSelectedBet === 'BLACK' && [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35].includes(drawn)) {
        isWin = true;
        mult = 2;
      } else if (rouletteSelectedBet === 'GREEN_ZERO' && drawn === 0) {
        isWin = true;
        mult = 36;
      } else if (rouletteSelectedBet === '7' && drawn === 7) {
        isWin = true;
        const struck = strikes.find((s) => s.num === 7);
        mult = struck ? struck.mult : 36;
      }

      if (isWin) {
        const winAmount = Number((rouletteBetAmount * mult).toFixed(2));
        setRouletteLastWin(winAmount);
        soundEngine.playWin();
        if (mult >= 10) {
          triggerCelebration({
            title: 'লাইটনিং রুলেট বিগ উইন!',
            amount: winAmount,
            currency: currency,
            multiplier: mult,
            gameTitle: 'Lightning Roulette'
          });
        }

        await settleSeamlessWin({
          providerId: 'evolution',
          gameId: 'evolution_lightning_roulette',
          amount: winAmount,
          roundId: roundId,
          referenceBetTxId: betRes.txId
        });
      }

      setRouletteSpinning(false);
    }, 1200);
  };

  const GAME_ID_MAP: Record<GameType, string> = {
    real_demo: selectedDemoGameId,
    live_casino: defaultGameId.includes('dragon') ? 'evolution_dragontiger_live' : 'evolution_baccarat_live',
    mines: 'spribe_mines',
    pgsoft: 'pgsoft_mahjong_ways2',
    jili: 'jili_super_ace',
    aviator: 'spribe_aviator',
    bonanza: 'vs20sweetbonanza',
    roulette: 'evolution_lightning_roulette'
  };

  const currentAsset = assetLoader.getGameAsset(GAME_ID_MAP[activeGame]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-5 font-sans">
      {/* 1. TOP DYNAMIC AUTHENTIC GAME SHOWCASE BANNER */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-[#080c16] shadow-2xl">
        {/* Background Ambient Backdrop Art */}
        <div className="absolute inset-0 z-0">
          <img
            src={currentAsset.bannerUrl || currentAsset.thumbnailUrl}
            alt={currentAsset.name}
            className="w-full h-full object-cover opacity-20 filter blur-[2px] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080c16] via-[#080c16]/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c16] via-transparent to-transparent" />
        </div>

        {/* Banner Content */}
        <div className="relative z-10 p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
            {/* Back Button */}
            <button
              onClick={() => {
                soundEngine.playClick(800);
                onBackToLobby();
              }}
              className="p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all flex items-center space-x-1.5 text-xs font-mono shrink-0 shadow-lg active:scale-95 cursor-pointer"
              title="লবিতে ফিরে যান"
            >
              <ChevronLeft className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">লবি (LOBBY)</span>
            </button>

            {/* Thumbnail Asset Icon Frame */}
            <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-xl shrink-0 bg-slate-950">
              <img
                src={currentAsset.thumbnailUrl}
                alt={currentAsset.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 right-1 px-1 py-0.2 rounded bg-black/70 text-[9px] font-mono font-bold text-amber-300">
                {currentAsset.icon}
              </div>
            </div>

            {/* Title & Metadata */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>{currentAsset.name}</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] sm:text-xs font-mono font-black uppercase">
                  {currentAsset.provider}
                </span>
                {currentAsset.badge && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600/90 text-white text-[10px] font-mono font-bold">
                    {currentAsset.badge}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 font-sans max-w-xl line-clamp-1 sm:line-clamp-2">
                {currentAsset.description}
              </p>

              {/* Feature Chips */}
              <div className="hidden sm:flex flex-wrap items-center gap-1.5 pt-0.5">
                {currentAsset.features.slice(0, 3).map((feat, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-700 text-slate-300 text-[10px] font-mono"
                  >
                    ✦ {feat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Metrics Strip */}
          <div className="flex items-center space-x-2 sm:space-x-4 bg-slate-950/80 border border-slate-800/80 p-2 sm:p-2.5 rounded-2xl shrink-0 font-mono self-start md:self-auto">
            <div className="px-2 text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold">RTP</div>
              <div className="text-xs sm:text-sm font-black text-emerald-400">{currentAsset.rtp}</div>
            </div>
            <div className="h-6 w-[1px] bg-slate-800" />
            <div className="px-2 text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold">MAX MULT</div>
              <div className="text-xs sm:text-sm font-black text-amber-400">{currentAsset.maxMultiplier}</div>
            </div>
            <div className="h-6 w-[1px] bg-slate-800" />
            <div className="px-2 text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold">VOLATILITY</div>
              <div className="text-xs sm:text-sm font-black text-rose-400">{currentAsset.volatility}</div>
            </div>
          </div>
        </div>

        {/* Multi-Game Studio Selector Pills */}
        <div className="relative z-10 px-3 sm:px-6 py-2.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center space-x-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline flex items-center gap-1">
            <Crown className="w-3 h-3 text-amber-400" />
            <span>গেম হাব:</span>
          </span>

          {/* 1. Official Real Demo Mode Button */}
          <button
            onClick={() => {
              soundEngine.playClick(1000);
              setActiveGame('real_demo');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeGame === 'real_demo'
                ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 font-black scale-105 border border-amber-300'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span>👑</span>
            <span>অফিসিয়াল রিয়েল ডেমো</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-600 text-white font-mono">
              HOT 🔥
            </span>
          </button>

          {/* 2. Live Casino Dealer Studio */}
          <button
            onClick={() => {
              soundEngine.playClick(900);
              setActiveGame('live_casino');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeGame === 'live_casino'
                ? 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 text-white shadow-lg shadow-rose-500/25 font-black scale-105 border border-rose-400'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span>🎴</span>
            <span>লাইভ ক্যাসিনো স্টুডিও (Baccarat / Dragon)</span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
          </button>

          {/* 3. Spribe Mines */}
          <button
            onClick={() => {
              soundEngine.playClick(900);
              setActiveGame('mines');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeGame === 'mines'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/25 font-black scale-105 border border-cyan-300'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>💣</span>
            <span>Spribe Mines 10000X</span>
          </button>

          {/* 4. Aviator Pro */}
          <button
            onClick={() => {
              soundEngine.playClick(900);
              setActiveGame('aviator');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeGame === 'aviator'
                ? 'bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-lg shadow-rose-500/25 font-black scale-105 border border-rose-400'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>✈️</span>
            <span>Spribe Aviator Pro</span>
          </button>

          {/* 5. PG Soft Mahjong 2 */}
          <button
            onClick={() => {
              soundEngine.playClick(850);
              setActiveGame('pgsoft');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeGame === 'pgsoft'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25 font-black scale-105 border border-emerald-300'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>🀄</span>
            <span>PG Mahjong 2</span>
          </button>

          {/* 6. JILI Super Ace */}
          <button
            onClick={() => {
              soundEngine.playClick(850);
              setActiveGame('jili');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 ${
              activeGame === 'jili'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 font-black scale-105 border border-purple-400'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>🃏</span>
            <span>JILI Super Ace</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{message}</span>
          </div>
          <button
            onClick={onOpenCashier}
            className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[10px]"
          >
            Deposit Now
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. LIVE CASINO DEALER STUDIO VIEW */}
      {/* ========================================================================= */}
      {activeGame === 'live_casino' && (
        <LiveCasinoStudio
          initialGame={defaultGameId.includes('dragon') ? 'dragontiger' : defaultGameId.includes('roulette') ? 'roulette' : 'baccarat'}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. SPRIBE MINES PROVABLY FAIR 10000X VIEW */}
      {/* ========================================================================= */}
      {activeGame === 'mines' && <SpribeMinesGame />}

      {/* ========================================================================= */}
      {/* 3. OFFICIAL REAL DEMO AGGREGATOR IFRAME PLAYER */}
      {/* ========================================================================= */}
      {activeGame === 'real_demo' && (
        <DemoIframe
          gameId={selectedDemoGameId}
          onSelectGame={(gId) => setSelectedDemoGameId(gId)}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. AVIATOR PRO CRASH GAME VIEW */}
      {/* ========================================================================= */}
      {activeGame === 'aviator' && (
        <AviatorProGame
          onBackToLobby={onBackToLobby}
          onOpenCashier={onOpenCashier}
        />
      )}

      {/* ========================================================================= */}
      {/* 5. PG SOFT MAHJONG WAYS 2 SIMULATOR */}
      {/* ========================================================================= */}
      {activeGame === 'pgsoft' && <PgSoftMahjongWays onOpenCashier={onOpenCashier} />}

      {/* ========================================================================= */}
      {/* 6. JILI SUPER ACE CARD SIMULATOR */}
      {/* ========================================================================= */}
      {activeGame === 'jili' && <JiliSuperAce onOpenCashier={onOpenCashier} />}

      {/* ========================================================================= */}
      {/* 5. LIGHTNING ROULETTE VIEW */}
      {/* ========================================================================= */}
      {activeGame === 'roulette' && (
        <div className="relative overflow-hidden bg-[#060b13] border-2 border-cyan-500/40 rounded-3xl p-4 sm:p-8 shadow-2xl space-y-6">
          <div className="absolute inset-0 z-0 opacity-15 pointer-events-none">
            <img
              src="https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=1200&q=80"
              alt="Lightning Studio"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between border-b border-cyan-900/40 pb-4 gap-2">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-400 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-2xl">
                  ⚡
                </div>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white flex items-center space-x-2">
                  <span>Lightning Roulette Live</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                    500x STRIKE
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                    97.30% RTP
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Evolution Gaming Electrified Studio with RNG Multipliers
                </p>
              </div>
            </div>

            <div className="text-right font-mono bg-slate-950/80 border border-cyan-500/30 px-3 py-1.5 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Roulette Result</div>
              <div className="text-base sm:text-lg font-black text-cyan-300">
                {rouletteResultNumber !== null ? `Number #${rouletteResultNumber}` : 'Awaiting Spin'}
              </div>
            </div>
          </div>

          {rouletteLightningStrikes.length > 0 && (
            <div className="relative z-10 grid grid-cols-2 gap-4">
              {rouletteLightningStrikes.map((s, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-r from-cyan-950/80 via-slate-900 to-slate-950 border border-cyan-400/60 p-3.5 rounded-2xl flex items-center justify-between font-mono animate-pulse shadow-lg shadow-cyan-500/20"
                >
                  <span className="text-xs text-slate-300 font-black">⚡ LUCKY #{s.num}</span>
                  <span className="text-base sm:text-lg font-black text-yellow-400">{s.mult}X STRIKE</span>
                </div>
              ))}
            </div>
          )}

          {/* Betting Grid */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            {[
              { id: 'RED', label: 'RED (2x)', bg: 'bg-red-600' },
              { id: 'BLACK', label: 'BLACK (2x)', bg: 'bg-slate-900' },
              { id: 'GREEN_ZERO', label: 'ZERO 0 (36x)', bg: 'bg-emerald-600' },
              { id: '1-18', label: 'LOW 1-18 (2x)', bg: 'bg-slate-800' },
              { id: '19-36', label: 'HIGH 19-36 (2x)', bg: 'bg-slate-800' },
              { id: '7', label: 'LUCKY 7 (500x)', bg: 'bg-gradient-to-r from-amber-600 to-yellow-600' }
            ].map((bet) => (
              <button
                key={bet.id}
                onClick={() => setRouletteSelectedBet(bet.id as any)}
                className={`p-4 rounded-2xl border text-xs font-mono font-bold transition-all cursor-pointer ${bet.bg} ${
                  rouletteSelectedBet === bet.id
                    ? 'border-cyan-400 ring-2 ring-cyan-400/60 scale-105 shadow-xl shadow-cyan-500/30'
                    : 'border-slate-800 text-slate-300 hover:border-cyan-500/40'
                }`}
              >
                {bet.label}
              </button>
            ))}
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/90 p-4 rounded-2xl border border-cyan-500/20">
            <div className="flex items-center space-x-2 font-mono text-xs text-slate-300">
              <span>Bet: <strong>${rouletteBetAmount}</strong> on <strong className="text-cyan-400">{rouletteSelectedBet}</strong></span>
            </div>

            <button
              disabled={rouletteSpinning}
              onClick={handleSpinRoulette}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white font-black text-sm shadow-xl shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Zap className={`w-5 h-5 ${rouletteSpinning ? 'animate-spin' : ''}`} />
              <span>SPIN WHEEL (${rouletteBetAmount})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
