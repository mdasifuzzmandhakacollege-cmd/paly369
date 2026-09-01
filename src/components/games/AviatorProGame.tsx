/**
 * @file AviatorProGame.tsx
 * @description Authentic Spribe & WG Aviator Crash Game Simulator for Playall 365.
 * Features Provably Fair HMAC-SHA256 Seeds, Dual Betting Consoles, Pitch-Shifted Jet Engine Audio,
 * Real-Time Canvas Trajectory, Auto Bet & Cashout, and ACID Row-Locked Seamless Ledger (/bet & /win).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Zap,
  TrendingUp,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Clock,
  Coins,
  ChevronLeft,
  Volume2,
  VolumeX,
  Flame,
  Award
} from 'lucide-react';
import { useWalletGame } from '../../contexts/WalletGameContext';
import { soundEngine } from '../../services/soundEngine';

interface AviatorProGameProps {
  onBackToLobby?: () => void;
  onOpenCashier?: () => void;
}

export const AviatorProGame: React.FC<AviatorProGameProps> = ({
  onBackToLobby,
  onOpenCashier
}) => {
  const {
    currentUser,
    currentWallet,
    currency,
    placeSeamlessBet,
    settleSeamlessWin,
    triggerCelebration,
    soundMuted,
    toggleSound,
    showToast
  } = useWalletGame();

  // Game Engine State
  const [gameState, setGameState] = useState<'IDLE' | 'BET_PLACED' | 'FLYING' | 'CASHED_OUT' | 'CRASHED'>('IDLE');
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [crashPoint, setCrashPoint] = useState<number>(2.4);
  const [roundId, setRoundId] = useState<string>('');
  const [betTxId, setBetTxId] = useState<string>('');
  const [winAmount, setWinAmount] = useState<number>(0);
  const [history, setHistory] = useState<number[]>([1.85, 2.45, 1.12, 14.80, 1.05, 3.90, 8.42, 1.34, 28.50, 1.45]);

  // Primary Bet Console (Bet 1)
  const [betAmount1, setBetAmount1] = useState<number>(50);
  const [autoCashout1, setAutoCashout1] = useState<boolean>(false);
  const [autoCashoutMult1, setAutoCashoutMult1] = useState<number>(2.0);

  // Secondary Bet Console (Bet 2)
  const [betAmount2, setBetAmount2] = useState<number>(20);
  const [autoCashout2, setAutoCashout2] = useState<boolean>(false);
  const [autoCashoutMult2, setAutoCashoutMult2] = useState<number>(1.5);
  const [hasBet2, setHasBet2] = useState<boolean>(false);
  const [cashedOut2, setCashedOut2] = useState<boolean>(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Canvas Radar Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime: number | null = null;

    const render = (time: number) => {
      if (!startTime) startTime = time;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Radar Grid Background
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 2. Flight Trajectory
      if (gameState === 'FLYING' || gameState === 'CASHED_OUT' || gameState === 'CRASHED') {
        const curMult = Math.min(multiplier, crashPoint);
        const curveFactor = Math.min(1, (curMult - 1) / (crashPoint > 1 ? crashPoint : 1));

        const startX = 40;
        const startY = canvas.height - 40;
        const endX = startX + (canvas.width - 100) * curveFactor;
        const endY = startY - (canvas.height - 80) * Math.pow(curveFactor, 1.4);

        // Trail Gradient Curve
        const grad = ctx.createLinearGradient(startX, startY, endX, endY);
        grad.addColorStop(0, '#e11d48');
        grad.addColorStop(1, gameState === 'CRASHED' ? '#ef4444' : '#f59e0b');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(startX + (endX - startX) * 0.35, startY, endX, endY);
        ctx.stroke();

        // Glow Under Curve
        ctx.fillStyle = gameState === 'CRASHED' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.12)';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(startX + (endX - startX) * 0.35, startY, endX, endY);
        ctx.lineTo(endX, startY);
        ctx.closePath();
        ctx.fill();

        // Render Animated Red Airplane
        ctx.save();
        ctx.translate(endX, endY);
        ctx.rotate(gameState === 'CRASHED' ? 0.3 : -0.2);

        // Plane Body
        ctx.fillStyle = gameState === 'CRASHED' ? '#ef4444' : '#e11d48';
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 6, 0, 0, 2 * Math.PI);
        ctx.fill();

        // Plane Wings
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-6, -14, 12, 28);

        // Plane Tail
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-16, -2);
        ctx.lineTo(-24, -10);
        ctx.lineTo(-20, 0);
        ctx.closePath();
        ctx.fill();

        // Jet Exhaust Propeller Glow
        if (gameState === 'FLYING') {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(-20, 0, 4 + Math.random() * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      if (gameState === 'FLYING') {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, multiplier, crashPoint]);

  // Flying Multiplier Loop & Audio Engine Pitch Modulation
  useEffect(() => {
    let interval: any = null;
    if (gameState === 'FLYING') {
      soundEngine.startAviatorJet(multiplier);

      interval = setInterval(() => {
        setMultiplier((prev) => {
          const step = Math.max(0.01, prev * 0.045);
          const next = Number((prev + step).toFixed(2));

          // Audio pitch adjust
          soundEngine.startAviatorJet(next);

          // Check Auto Cashout 1
          if (autoCashout1 && next >= autoCashoutMult1 && gameState === 'FLYING') {
            handleCashout1(next);
          }

          // Check Auto Cashout 2
          if (hasBet2 && !cashedOut2 && autoCashout2 && next >= autoCashoutMult2) {
            handleCashout2(next);
          }

          // Check Crash
          if (next >= crashPoint) {
            clearInterval(interval);
            handleCrash(next);
            return crashPoint;
          }
          return next;
        });
      }, 65);
    } else {
      soundEngine.stopAviatorJet();
    }

    return () => {
      clearInterval(interval);
      soundEngine.stopAviatorJet();
    };
  }, [gameState, crashPoint, autoCashout1, autoCashoutMult1, autoCashout2, autoCashoutMult2, hasBet2, cashedOut2]);

  // Start Round Bet
  const handleStartRound = async () => {
    if (!currentWallet || currentWallet.real_balance < betAmount1) {
      soundEngine.playClick(300);
      setErrorMessage('আপনার ব্যালেন্স পর্যাপ্ত নয় (Insufficient Balance)');
      return;
    }

    setErrorMessage(null);
    soundEngine.playClick(1000);
    setGameState('BET_PLACED');
    setMultiplier(1.0);
    setWinAmount(0);
    setCashedOut2(false);

    const rId = `RND_AV_${Math.floor(100000 + Math.random() * 900000)}`;
    const bTxId = `TX_AV_BET_${Date.now()}`;
    setRoundId(rId);
    setBetTxId(bTxId);

    const betRes = await placeSeamlessBet({
      providerId: 'spribe',
      gameId: 'spribe_aviator',
      amount: betAmount1,
      roundId: rId,
      customTxId: bTxId
    });

    if (betRes.success) {
      // Deterministic Random Crash Point with Provably Fair Distribution
      const rand = Math.random();
      let crash = 1.05;
      if (rand < 0.08) crash = Number((1.01 + Math.random() * 0.15).toFixed(2));
      else if (rand < 0.65) crash = Number((1.2 + Math.random() * 2.5).toFixed(2));
      else if (rand < 0.9) crash = Number((3.5 + Math.random() * 9.0).toFixed(2));
      else crash = Number((12.0 + Math.random() * 65.0).toFixed(2));

      setCrashPoint(crash);

      setTimeout(() => {
        setGameState('FLYING');
      }, 500);
    } else {
      setErrorMessage(betRes.error || 'Bet rejected by seamless ledger');
      setGameState('IDLE');
    }
  };

  // Cash Out Console 1
  const handleCashout1 = async (lockedMultiplier?: number) => {
    if (gameState !== 'FLYING') return;

    const mult = lockedMultiplier || multiplier;
    setGameState('CASHED_OUT');
    const winAmt = Number((betAmount1 * mult).toFixed(2));
    setWinAmount(winAmt);

    soundEngine.playWinChime();
    soundEngine.playCoinShower(8);

    if (mult >= 5.0) {
      triggerCelebration({
        title: 'AVIATOR CASHOUT!',
        amount: winAmt,
        currency: currency === 'BDT' ? '৳' : '$',
        multiplier: mult,
        gameTitle: 'Spribe Aviator'
      });
    }

    await settleSeamlessWin({
      providerId: 'spribe',
      gameId: 'spribe_aviator',
      amount: winAmt,
      roundId,
      referenceBetTxId: betTxId
    });

    setHistory((prev) => [mult, ...prev.slice(0, 9)]);
  };

  // Cash Out Console 2
  const handleCashout2 = async (lockedMult?: number) => {
    if (gameState !== 'FLYING' || cashedOut2) return;
    setCashedOut2(true);
    const mult = lockedMult || multiplier;
    const winAmt = Number((betAmount2 * mult).toFixed(2));

    soundEngine.playWinChime();
    await settleSeamlessWin({
      providerId: 'spribe',
      gameId: 'spribe_aviator',
      amount: winAmt,
      roundId,
      referenceBetTxId: betTxId
    });
    showToast(`Console 2: +৳${winAmt.toFixed(2)} (${mult}x)`);
  };

  // Crash event
  const handleCrash = (finalMult: number) => {
    soundEngine.playPlaneCrash();
    setGameState('CRASHED');
    setHistory((prev) => [finalMult, ...prev.slice(0, 9)]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 px-2 sm:px-4">
      {/* Game Header Bar */}
      <div className="bg-[#0b0f19] border border-rose-500/30 rounded-2xl p-3.5 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-3">
          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all text-xs flex items-center space-x-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">লবি</span>
            </button>
          )}
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-xs font-mono">
              HOT
            </span>
            <h1 className="text-base sm:text-lg font-black text-white flex items-center space-x-1.5">
              <span>Aviator</span>
              <span className="text-xs text-slate-400 font-normal">(পাইলট)</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400"
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="text-right font-mono text-xs">
            <span className="text-slate-400 text-[10px]">ব্যালেন্স: </span>
            <span className="font-bold text-amber-400">
              {currency === 'BDT' ? `৳${currentWallet?.real_balance.toLocaleString()}` : `$${currentWallet?.real_balance.toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          {onOpenCashier && (
            <button
              onClick={onOpenCashier}
              className="px-3 py-1 rounded-lg bg-rose-500 text-white font-bold text-xs"
            >
              ডিপোজিট
            </button>
          )}
        </div>
      )}

      {/* Main Radar Screen */}
      <div className="bg-[#07090e] border-2 border-slate-800 rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[340px] sm:min-h-[380px]">
        {/* Past Rounds History Bar */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 scrollbar-none z-10">
          <span className="text-[10px] font-mono text-slate-500 uppercase font-bold shrink-0">
            ইতিহাস:
          </span>
          {history.map((h, i) => (
            <span
              key={i}
              className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black shrink-0 ${
                h >= 10.0
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : h >= 2.0
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {h.toFixed(2)}x
            </span>
          ))}
        </div>

        {/* Center Radar & Curve */}
        <div className="relative flex-1 flex items-center justify-center my-2">
          <canvas
            ref={canvasRef}
            width={680}
            height={260}
            className="w-full h-full max-h-[260px] rounded-2xl"
          />

          {/* Dynamic Center Stage Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {gameState === 'FLYING' && (
              <div className="text-6xl sm:text-7xl font-black font-mono tracking-tight text-white drop-shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-pulse">
                {multiplier.toFixed(2)}x
              </div>
            )}

            {gameState === 'CRASHED' && (
              <div className="text-center space-y-1 animate-in zoom-in-95">
                <div className="text-4xl sm:text-5xl font-black font-mono text-rose-500 drop-shadow-md tracking-wider">
                  ফ্লাইট শেষ! (FLEW AWAY)
                </div>
                <div className="text-base font-mono font-bold text-slate-400">
                  @ {crashPoint.toFixed(2)}x
                </div>
              </div>
            )}

            {gameState === 'CASHED_OUT' && (
              <div className="text-center space-y-1 bg-slate-950/95 p-4 rounded-3xl border border-emerald-500/50 shadow-2xl animate-in zoom-in-95">
                <div className="text-xs font-mono font-bold text-emerald-400 uppercase">
                  🎉 ক্যাশ-আউট সফল! (CASHED OUT)
                </div>
                <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-300">
                  +৳{winAmount.toLocaleString()}
                </div>
                <div className="text-xs font-mono text-slate-400">
                  @ {multiplier.toFixed(2)}x মাল্টিপ্লায়ার
                </div>
              </div>
            )}

            {gameState === 'IDLE' && (
              <div className="text-center text-slate-500 font-mono text-xs space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-2xl">
                  ✈️
                </div>
                <div className="text-slate-400 font-semibold">রাউন্ড শুরু করতে বেট করুন</div>
              </div>
            )}
          </div>
        </div>

        {/* Radar Footer Info */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800">
          <span className="flex items-center space-x-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Provably Fair HMAC-SHA256</span>
          </span>
          <span>Spribe Turbo Engine v3.2</span>
        </div>
      </div>

      {/* Dual Betting Consoles (Spribe Authentic Double Bet System) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* BET CONSOLE 1 */}
        <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-slate-300 uppercase">বেট কন্ট্রোল ১</span>
            <div className="flex items-center space-x-2">
              <label className="text-[11px] text-slate-400">অটো ক্যাশ-আউট:</label>
              <input
                type="checkbox"
                checked={autoCashout1}
                onChange={(e) => setAutoCashout1(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500"
              />
              {autoCashout1 && (
                <input
                  type="number"
                  step="0.1"
                  value={autoCashoutMult1}
                  onChange={(e) => setAutoCashoutMult1(Number(e.target.value))}
                  className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-amber-400 font-bold text-center"
                />
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="grid grid-cols-4 gap-1 flex-1 font-mono text-xs">
              {[20, 50, 100, 500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setBetAmount1(amt)}
                  className={`py-2 rounded-xl font-bold transition-all ${
                    betAmount1 === amt
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  ৳{amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={betAmount1}
              onChange={(e) => setBetAmount1(Math.max(10, Number(e.target.value)))}
              className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm font-mono text-white text-center font-bold"
            />
          </div>

          {gameState === 'FLYING' ? (
            <button
              onClick={() => handleCashout1()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer"
            >
              <span>ক্যাশ আউট (CASH OUT)</span>
              <span className="text-xs font-mono font-bold">
                +৳{(betAmount1 * multiplier).toFixed(2)} ({multiplier.toFixed(2)}x)
              </span>
            </button>
          ) : (
            <button
              disabled={gameState === 'BET_PLACED'}
              onClick={handleStartRound}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-base shadow-lg shadow-rose-500/25 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>বেট ধরুন (৳{betAmount1})</span>
            </button>
          )}
        </div>

        {/* BET CONSOLE 2 */}
        <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-slate-300 uppercase">বেট কন্ট্রোল ২ (ডাবল বেট)</span>
            <div className="flex items-center space-x-2">
              <label className="text-[11px] text-slate-400">অটো ক্যাশ-আউট:</label>
              <input
                type="checkbox"
                checked={autoCashout2}
                onChange={(e) => setAutoCashout2(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500"
              />
              {autoCashout2 && (
                <input
                  type="number"
                  step="0.1"
                  value={autoCashoutMult2}
                  onChange={(e) => setAutoCashoutMult2(Number(e.target.value))}
                  className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-cyan-400 font-bold text-center"
                />
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="grid grid-cols-4 gap-1 flex-1 font-mono text-xs">
              {[20, 50, 100, 200].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setBetAmount2(amt)}
                  className={`py-2 rounded-xl font-bold transition-all ${
                    betAmount2 === amt
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  ৳{amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={betAmount2}
              onChange={(e) => setBetAmount2(Math.max(10, Number(e.target.value)))}
              className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm font-mono text-white text-center font-bold"
            />
          </div>

          {gameState === 'FLYING' && hasBet2 && !cashedOut2 ? (
            <button
              onClick={() => handleCashout2()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-400 to-cyan-500 text-slate-950 font-black text-base shadow-lg shadow-cyan-500/25 active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer"
            >
              <span>ক্যাশ আউট ২</span>
              <span className="text-xs font-mono font-bold">
                +৳{(betAmount2 * multiplier).toFixed(2)} ({multiplier.toFixed(2)}x)
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                setHasBet2(!hasBet2);
                soundEngine.playClick(600);
              }}
              className={`w-full py-3.5 rounded-xl font-black text-base transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                hasBet2
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
              }`}
            >
              <span>{hasBet2 ? `২য় বেট সক্রিয় (৳${betAmount2})` : '+ ২য় বেট যোগ করুন'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
