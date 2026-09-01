/**
 * @file soundEngine.ts
 * @description Pure HTML5 Web Audio API Synthesizer for "Playall 365" & "G777" Casino.
 * Generates realistic acoustic sound effects for Aviator jet engine, slot mechanical reels,
 * card flips, winning fanfare, cash drops, wheel ticks, and level up chimes.
 */

class CasinoSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private spinInterval: any = null;
  private jetOsc: OscillatorNode | null = null;
  private jetGain: GainNode | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gp365_sound_muted');
      this.isMuted = stored === 'true';
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gp365_sound_muted', String(this.isMuted));
    }
    if (this.isMuted) {
      this.stopReelSpin();
      this.stopAviatorJet();
    }
    return !this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gp365_sound_muted', String(muted));
    }
    if (muted) {
      this.stopReelSpin();
      this.stopAviatorJet();
    }
  }

  /**
   * Crisp UI Click & Navigation Tones
   */
  public playClick(freq: number = 880) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.045);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Cashier / Security Error Buzzer
   */
  public playCashierError() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.setValueAtTime(120, now + 0.1);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Navigation Tab Switch Tone (Smooth dual-chime)
   */
  public playNavClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(700, now);
    osc1.frequency.exponentialRampToValueAtTime(950, now + 0.06);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.065);
  }

  /**
   * Wallet Deposit / Credit Sound (Rising cheerful harmonic chime)
   */
  public playWalletCredit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.05;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    });

    setTimeout(() => {
      this.playCoinShower(6);
    }, 150);
  }

  /**
   * Wallet Bet Deduction (Soft mechanical click / coin flip)
   */
  public playWalletDeduct() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.07);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Standard Win Sound with tiered feedback
   */
  public playWin(amount: number = 0, multiplier: number = 1.0) {
    if (this.isMuted) return;
    if (multiplier >= 20.0 || amount >= 5000) {
      this.playMegaWin();
    } else if (multiplier >= 5.0 || amount >= 1000) {
      this.playWinChime();
      this.playCoinShower(10);
    } else {
      this.playWinChime();
      this.playCoinShower(4);
    }
  }

  /**
   * Continuous Mechanical Reel Spinning Sound (Ratchet Whir)
   */
  public startReelSpin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    this.stopReelSpin();

    this.spinInterval = setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260 + Math.random() * 90, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.035);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    }, 65);
  }

  public stopReelSpin() {
    if (this.spinInterval) {
      clearInterval(this.spinInterval);
      this.spinInterval = null;
    }
  }

  /**
   * Complete Audio Engine Shutdown / Kill Switch
   */
  public stopAll() {
    this.stopReelSpin();
    this.stopAviatorJet();
  }

  /**
   * Reel Stop "Thud/Clack" per column
   */
  public playReelStop(reelIndex: number = 0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    const baseFreq = 190 + reelIndex * 35;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Aviator Jet Engine Pitch Acceleration
   */
  public startAviatorJet(multiplier: number = 1.0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const freq = Math.min(900, 140 + multiplier * 60);

    if (!this.jetOsc) {
      this.jetOsc = this.ctx.createOscillator();
      this.jetGain = this.ctx.createGain();

      this.jetOsc.type = 'sawtooth';
      this.jetOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      // Low pass filter for engine warmth
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);

      this.jetGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.jetOsc.connect(filter);
      filter.connect(this.jetGain);
      this.jetGain.connect(this.ctx.destination);

      this.jetOsc.start();
    } else {
      this.jetOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    }
  }

  public stopAviatorJet() {
    if (this.jetOsc && this.ctx) {
      try {
        if (this.jetGain) {
          this.jetGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        this.jetOsc.stop();
        this.jetOsc.disconnect();
      } catch (e) {
        // ignore
      }
      this.jetOsc = null;
      this.jetGain = null;
    }
  }

  /**
   * Plane Crashed / Flew Away Sound
   */
  public playPlaneCrash() {
    this.stopAviatorJet();
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.38);
  }

  /**
   * Card Flip & Card Snap (for Jili Super Ace)
   */
  public playCardFlip() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Standard Win Chime (Arpeggio notes)
   */
  public playWinChime() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.28);
    });
  }

  /**
   * Metallic Coin Cascade (Fast coins dropping)
   */
  public playCoinShower(count: number = 8) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    for (let i = 0; i < count; i++) {
      const delay = i * 0.045 + Math.random() * 0.02;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + delay;

      const freqs = [1200, 1480, 1820, 2100, 2450];
      const freq = freqs[Math.floor(Math.random() * freqs.length)];

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.06);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    }
  }

  /**
   * Lucky Wheel Tick Sound
   */
  public playWheelTick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.025);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  }

  /**
   * Mega Win Fanfare & Celebratory Crescendo Chords
   */
  public playMegaWin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const chords = [
      { notes: [261.63, 329.63, 392.0], start: 0, dur: 0.2 },
      { notes: [349.23, 440.0, 523.25], start: 0.22, dur: 0.2 },
      { notes: [392.0, 493.88, 587.33], start: 0.44, dur: 0.25 },
      { notes: [523.25, 659.25, 783.99, 1046.5], start: 0.7, dur: 0.8 }
    ];

    chords.forEach((chord) => {
      chord.notes.forEach((freq) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime + chord.start;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + chord.dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + chord.dur + 0.05);
      });
    });

    setTimeout(() => {
      this.playCoinShower(16);
    }, 600);
  }

  public playBigWinCelebration() {
    this.playMegaWin();
  }

  /**
   * Golden Tile Transform / Scatter Mystical Shimmer
   */
  public playGoldTransform() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const freqs = [800, 1100, 1400, 1750, 2200];
    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.04;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.12);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    });
  }
  /**
   * Quick Slot Spin sound (convenience method)
   */
  public playSpin() {
    this.startReelSpin();
    setTimeout(() => {
      this.stopReelSpin();
    }, 600);
  }

  /**
   * Cashout Sound
   */
  public playCashout(amount: number = 0) {
    this.playWalletCredit();
  }

  /**
   * Lightning Strike Electric Arc Sound
   */
  public playLightning() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Card Dealing / Table Felt Sound
   */
  public playDealCard() {
    this.playCardFlip();
  }

  /**
   * Spribe Crash / Explosion Sound
   */
  public playCrash() {
    this.playPlaneCrash();
  }

  /**
   * Gem / Diamond Reveal Sound
   */
  public playGem() {
    this.playGoldTransform();
  }
}

export const soundEngine = new CasinoSoundEngine();
