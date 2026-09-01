/**
 * @file assetLoader.ts
 * @description Enterprise iGaming High-Fidelity Asset Loader & Media Registry.
 * Maps game IDs, provider ecosystems, and game themes to curated authentic artwork,
 * studio badges, and audio-visual metadata.
 */

import { CASINO_ART } from './casinoArtRegistry';

export interface GameAsset {
  gameId: string;
  name: string;
  nameBn: string;
  provider: string;
  providerId: string;
  category: 'hot' | 'slots' | 'minigames' | 'sports' | 'casino' | 'fishing';
  thumbnailUrl: string;
  animatedPreviewUrl: string;
  bannerUrl: string;
  logoUrl?: string;
  demoUrl?: string;
  icon: string;
  themeColor: {
    primary: string;
    glow: string;
    border: string;
    gradient: string;
  };
  rtp: string;
  volatility: 'Low' | 'Medium' | 'High' | 'Extreme';
  maxMultiplier: string;
  minBet: number;
  maxBet: number;
  badge?: string;
  features: string[];
  description: string;
}

export interface ProviderAsset {
  id: string;
  name: string;
  logoUrl: string;
  badgeBg: string;
  color: string;
}

export const PROVIDER_ASSETS: Record<string, ProviderAsset> = {
  pgsoft: {
    id: 'pgsoft',
    name: 'PG Soft',
    logoUrl: CASINO_ART.pgsoft_mahjong_ways2,
    badgeBg: 'from-emerald-600 to-teal-500',
    color: '#10b981'
  },
  jili: {
    id: 'jili',
    name: 'JILI Games',
    logoUrl: CASINO_ART.jili_super_ace,
    badgeBg: 'from-amber-600 to-yellow-500',
    color: '#f59e0b'
  },
  spribe: {
    id: 'spribe',
    name: 'SPRIBE',
    logoUrl: CASINO_ART.spribe_aviator,
    badgeBg: 'from-rose-600 to-red-500',
    color: '#f43f5e'
  },
  pragmatic: {
    id: 'pragmatic',
    name: 'Pragmatic Play',
    logoUrl: CASINO_ART.gates_of_olympus,
    badgeBg: 'from-blue-600 to-indigo-500',
    color: '#3b82f6'
  },
  evolution: {
    id: 'evolution',
    name: 'Evolution Gaming',
    logoUrl: CASINO_ART.speed_baccarat_live,
    badgeBg: 'from-rose-600 to-red-600',
    color: '#e11d48'
  },
  sports: {
    id: 'sports',
    name: 'BetPro Sports',
    logoUrl: CASINO_ART.sports_cricket,
    badgeBg: 'from-emerald-700 to-green-600',
    color: '#10b981'
  }
};

export const GAME_ASSETS: Record<string, GameAsset> = {
  spribe_aviator: {
    gameId: 'spribe_aviator',
    name: 'Aviator',
    nameBn: 'পাইলট (SPRIBE ✈️)',
    provider: 'SPRIBE',
    providerId: 'spribe',
    category: 'minigames',
    thumbnailUrl: CASINO_ART.spribe_aviator,
    animatedPreviewUrl: CASINO_ART.spribe_aviator,
    bannerUrl: CASINO_ART.spribe_aviator,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20olympgate&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '✈️',
    themeColor: {
      primary: '#e11d48',
      glow: 'rgba(225, 29, 72, 0.4)',
      border: 'border-rose-500/50',
      gradient: 'from-rose-600 via-red-500 to-amber-500'
    },
    rtp: '97.00%',
    volatility: 'High',
    maxMultiplier: '1,000x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: 'HOT 🔥',
    features: ['Real-time Curve', 'Dual Bets', 'Auto Cashout', 'Provably Fair SHA-256'],
    description: 'The world famous multiplayer crash game with high frequency multiplier rounds.'
  },
  wg_aviator: {
    gameId: 'wg_aviator',
    name: 'WG Aviator',
    nameBn: 'পাইলট (WG Turbo)',
    provider: 'WG Games',
    providerId: 'spribe',
    category: 'minigames',
    thumbnailUrl: CASINO_ART.wg_aviator,
    animatedPreviewUrl: CASINO_ART.wg_aviator,
    bannerUrl: CASINO_ART.wg_aviator,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20olympgate&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '🚀',
    themeColor: {
      primary: '#9333ea',
      glow: 'rgba(147, 51, 234, 0.4)',
      border: 'border-purple-500/50',
      gradient: 'from-purple-600 via-indigo-500 to-rose-500'
    },
    rtp: '97.20%',
    volatility: 'High',
    maxMultiplier: '2,500x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: '2500X',
    features: ['Turbo Engine', 'Multi-level Cashout', 'Instant Payout'],
    description: 'High-speed Aviator variant featuring extended ceiling multipliers up to 2500x.'
  },
  flyx_crash: {
    gameId: 'flyx_crash',
    name: 'FlyX',
    nameBn: 'ফ্লাইএক্স (FlyX 10000X)',
    provider: 'Buck Stakes',
    providerId: 'spribe',
    category: 'minigames',
    thumbnailUrl: CASINO_ART.flyx_crash,
    animatedPreviewUrl: CASINO_ART.flyx_crash,
    bannerUrl: CASINO_ART.flyx_crash,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20sweetbonanza&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '⚡',
    themeColor: {
      primary: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.4)',
      border: 'border-cyan-500/50',
      gradient: 'from-cyan-600 via-blue-500 to-indigo-500'
    },
    rtp: '97.00%',
    volatility: 'Extreme',
    maxMultiplier: '10,000x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: '10,000X',
    features: ['10,000x Max Cap', 'Superhero Flight', 'Instant Multi-Bet'],
    description: 'Futuristic superhero rocket crash simulator with supreme 10,000x jackpot potential.'
  },
  jili_super_ace: {
    gameId: 'jili_super_ace',
    name: 'Super Ace',
    nameBn: 'সুপার এস (1500X)',
    provider: 'JILI',
    providerId: 'jili',
    category: 'slots',
    thumbnailUrl: CASINO_ART.jili_super_ace,
    animatedPreviewUrl: CASINO_ART.jili_super_ace,
    bannerUrl: CASINO_ART.jili_super_ace,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20sweetbonanza&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '🃏',
    themeColor: {
      primary: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.4)',
      border: 'border-amber-500/50',
      gradient: 'from-amber-500 via-yellow-500 to-orange-600'
    },
    rtp: '97.00%',
    volatility: 'High',
    maxMultiplier: '1,500x',
    minBet: 20.0,
    maxBet: 25000.0,
    badge: 'HOT 🔥',
    features: ['Golden Cards', 'Elimination Multiplier', 'Free Game 5x Mult', 'Joker Transformations'],
    description: 'The signature Asian blockbuster slot featuring poker suits, Golden Aces, and tumbling multi-combo multipliers.'
  },
  jili_super_ace_deluxe: {
    gameId: 'jili_super_ace_deluxe',
    name: 'Super Ace Deluxe',
    nameBn: 'সুপার এস ডিলাক্স (1500X)',
    provider: 'JILI',
    providerId: 'jili',
    category: 'slots',
    thumbnailUrl: CASINO_ART.jili_super_ace_deluxe,
    animatedPreviewUrl: CASINO_ART.jili_super_ace_deluxe,
    bannerUrl: CASINO_ART.jili_super_ace_deluxe,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20olympgate&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '👑',
    themeColor: {
      primary: '#eab308',
      glow: 'rgba(234, 179, 8, 0.4)',
      border: 'border-yellow-500/50',
      gradient: 'from-yellow-500 via-amber-500 to-red-600'
    },
    rtp: '97.10%',
    volatility: 'High',
    maxMultiplier: '1,500x',
    minBet: 20.0,
    maxBet: 25000.0,
    badge: 'DELUXE',
    features: ['Enhanced Golden Aces', 'Continuous Combo Multipliers', 'Deluxe Jackpot'],
    description: 'Upgraded version of Super Ace with richer card physics and boosted bonus round triggers.'
  },
  pgsoft_mahjong_ways2: {
    gameId: 'pgsoft_mahjong_ways2',
    name: 'Mahjong Ways 2',
    nameBn: 'মাহজং ওয়েজ ২',
    provider: 'PG Soft',
    providerId: 'pgsoft',
    category: 'slots',
    thumbnailUrl: CASINO_ART.pgsoft_mahjong_ways2,
    animatedPreviewUrl: CASINO_ART.pgsoft_mahjong_ways2,
    bannerUrl: CASINO_ART.pgsoft_mahjong_ways2,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20sweetbonanza&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '🀄',
    themeColor: {
      primary: '#10b981',
      glow: 'rgba(16, 185, 129, 0.4)',
      border: 'border-emerald-500/50',
      gradient: 'from-emerald-600 via-teal-500 to-amber-500'
    },
    rtp: '96.95%',
    volatility: 'Medium',
    maxMultiplier: '100,000x',
    minBet: 10.0,
    maxBet: 30000.0,
    badge: 'LEGENDARY',
    features: ['Gold Plated Mahjong Tiles', 'Cascading 10x Free Spins', '2000 Ways to Win'],
    description: 'PG Soft’s all-time flagship game. Transform golden tiles into wilds and multiply your payouts during tumble spins.'
  },
  fortune_tiger_88: {
    gameId: 'fortune_tiger_88',
    name: 'Fortune Tiger',
    nameBn: 'ফরচুন টাইগার (PG)',
    provider: 'PG Soft',
    providerId: 'pgsoft',
    category: 'slots',
    thumbnailUrl: CASINO_ART.fortune_tiger,
    animatedPreviewUrl: CASINO_ART.fortune_tiger,
    bannerUrl: CASINO_ART.fortune_tiger,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20olympgate&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '🐯',
    themeColor: {
      primary: '#f97316',
      glow: 'rgba(249, 115, 22, 0.4)',
      border: 'border-orange-500/50',
      gradient: 'from-orange-500 via-amber-500 to-yellow-400'
    },
    rtp: '96.81%',
    volatility: 'Medium',
    maxMultiplier: '2,500x',
    minBet: 10.0,
    maxBet: 25000.0,
    badge: 'HOT 🔥',
    features: ['10x Full Screen Multiplier', 'Fortune Tiger Respin Feature', '3x3 Classic Grid'],
    description: 'Hear the roar of the golden tiger! Complete full screen symbol alignments to trigger instant 10x total payouts.'
  },
  vs20olympgate: {
    gameId: 'vs20olympgate',
    name: 'Gates of Olympus',
    nameBn: 'গেটস্ অফ অলিম্পাস (Zeus)',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'slots',
    thumbnailUrl: CASINO_ART.gates_of_olympus,
    animatedPreviewUrl: CASINO_ART.gates_of_olympus,
    bannerUrl: CASINO_ART.gates_of_olympus,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20olympgate&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '⚡',
    themeColor: {
      primary: '#3b82f6',
      glow: 'rgba(59, 130, 246, 0.4)',
      border: 'border-blue-500/50',
      gradient: 'from-blue-600 via-indigo-500 to-amber-400'
    },
    rtp: '96.50%',
    volatility: 'Extreme',
    maxMultiplier: '5,000x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: 'ZEUS 500X',
    features: ['Zeus Lightning Multipliers (up to 500x)', 'Free Spins Global Multiplier', 'Pay Anywhere Tumble'],
    description: 'The legendary Greek mythology slot where Zeus hurls lightning multipliers up to 500x during cascading tumbling spins.'
  },
  vs20sweetbonanza: {
    gameId: 'vs20sweetbonanza',
    name: 'Sweet Bonanza 1000',
    nameBn: 'সুইট বোনানজা ১০০০',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'slots',
    thumbnailUrl: CASINO_ART.sweet_bonanza,
    animatedPreviewUrl: CASINO_ART.sweet_bonanza,
    bannerUrl: CASINO_ART.sweet_bonanza,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20sweetbonanza&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '🍬',
    themeColor: {
      primary: '#ec4899',
      glow: 'rgba(236, 72, 153, 0.4)',
      border: 'border-pink-500/50',
      gradient: 'from-pink-500 via-rose-500 to-yellow-400'
    },
    rtp: '96.53%',
    volatility: 'High',
    maxMultiplier: '25,000x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: '1000X BOMBS',
    features: ['Tumble Feature', 'Multiplier Rainbow Bombs (up to 1000x)', 'Scatter Pays Anywhere'],
    description: 'Pragmatic Play candy wonderland with all-ways pays mechanics and explosive candy bomb multipliers.'
  },
  vs20sugarush: {
    gameId: 'vs20sugarush',
    name: 'Sugar Rush 1000',
    nameBn: 'সুগার রাশ ১০০০',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'slots',
    thumbnailUrl: CASINO_ART.sugar_rush,
    animatedPreviewUrl: CASINO_ART.sugar_rush,
    bannerUrl: CASINO_ART.sugar_rush,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20sugarush&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '🍭',
    themeColor: {
      primary: '#d946ef',
      glow: 'rgba(217, 70, 239, 0.4)',
      border: 'border-fuchsia-500/50',
      gradient: 'from-fuchsia-600 via-pink-500 to-amber-400'
    },
    rtp: '96.53%',
    volatility: 'Extreme',
    maxMultiplier: '25,000x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: '1024X SPOTS',
    features: ['Sticky Multiplier Spots (up to 1024x)', 'Cluster Pays Grid 7x7', 'Free Spins Retrigger'],
    description: 'Explosive gummy cluster slot with persistent multiplier spots that double up to 1024x on every explosion.'
  },
  vs20starlight: {
    gameId: 'vs20starlight',
    name: 'Starlight Princess 1000',
    nameBn: 'স্টারলাইট প্রিন্সেস ১০০০',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'slots',
    thumbnailUrl: CASINO_ART.starlight_princess,
    animatedPreviewUrl: CASINO_ART.starlight_princess,
    bannerUrl: CASINO_ART.starlight_princess,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20starlight&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '✨',
    themeColor: {
      primary: '#ec4899',
      glow: 'rgba(236, 72, 153, 0.4)',
      border: 'border-pink-500/50',
      gradient: 'from-pink-500 via-purple-500 to-yellow-400'
    },
    rtp: '96.50%',
    volatility: 'Extreme',
    maxMultiplier: '15,000x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: '1000X MULT',
    features: ['Starlight Heart Multipliers up to 1000x', 'Global Free Spin Bank', 'Anime Fantasy Theme'],
    description: 'Anime celestial princess grants random glowing heart multipliers up to 1000x on every spin.'
  },
  vswaysdoghouse: {
    gameId: 'vswaysdoghouse',
    name: 'The Dog House Megaways',
    nameBn: 'দ্য ডগ হাউজ মেগাওয়েজ',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'slots',
    thumbnailUrl: CASINO_ART.dog_house,
    animatedPreviewUrl: CASINO_ART.dog_house,
    bannerUrl: CASINO_ART.dog_house,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vswaysdoghouse&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '🐶',
    themeColor: {
      primary: '#3b82f6',
      glow: 'rgba(59, 130, 246, 0.4)',
      border: 'border-blue-500/50',
      gradient: 'from-blue-600 via-sky-500 to-amber-400'
    },
    rtp: '96.55%',
    volatility: 'High',
    maxMultiplier: '12,305x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: '117,649 WAYS',
    features: ['117,649 Megaways', 'Sticky Wilds & Raining Wilds Free Spins', 'Multiplier Kennels'],
    description: 'The lovable canine pack returns with up to 117,649 Megaways and multiplier kennel wilds.'
  },
  vs10bbbonanza: {
    gameId: 'vs10bbbonanza',
    name: 'Big Bass Bonanza',
    nameBn: 'বিগ ব্যাস বোনানজা',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'fishing',
    thumbnailUrl: CASINO_ART.jackpot_fishing,
    animatedPreviewUrl: CASINO_ART.jackpot_fishing,
    bannerUrl: CASINO_ART.jackpot_fishing,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs10bbbonanza&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '🎣',
    themeColor: {
      primary: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.4)',
      border: 'border-cyan-500/50',
      gradient: 'from-cyan-500 via-teal-500 to-amber-400'
    },
    rtp: '96.71%',
    volatility: 'Medium',
    maxMultiplier: '2,100x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: 'FISH CASH',
    features: ['Fisherman Cash Collector Wilds', '10x Multiplier Progression', 'Free Spins Catch'],
    description: 'Hook the biggest fish in the lake! Fisherman collects all cash fish values during the bonus round.'
  },
  vs25wolfgold: {
    gameId: 'vs25wolfgold',
    name: 'Wolf Gold',
    nameBn: 'উলফ গোল্ড (Pragmatic)',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'slots',
    thumbnailUrl: CASINO_ART.gates_of_olympus,
    animatedPreviewUrl: CASINO_ART.gates_of_olympus,
    bannerUrl: CASINO_ART.gates_of_olympus,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs25wolfgold&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '🐺',
    themeColor: {
      primary: '#eab308',
      glow: 'rgba(234, 179, 8, 0.4)',
      border: 'border-yellow-500/50',
      gradient: 'from-amber-500 via-orange-500 to-yellow-300'
    },
    rtp: '96.01%',
    volatility: 'Medium',
    maxMultiplier: '2,500x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: 'JACKPOT',
    features: ['Money Respin Feature', 'Giant 3x3 Mega Symbols', 'Mini, Major, Mega Jackpots'],
    description: 'Venture into Native American wilderness with full moon money respins and giant mega symbol reels.'
  },
  evolution_lightning_roulette: {
    gameId: 'evolution_lightning_roulette',
    name: 'Lightning Roulette',
    nameBn: 'লাইটনিং রুলেট লাইভ',
    provider: 'Evolution',
    providerId: 'evolution',
    category: 'casino',
    thumbnailUrl: CASINO_ART.dragon_tiger_live,
    animatedPreviewUrl: CASINO_ART.dragon_tiger_live,
    bannerUrl: CASINO_ART.dragon_tiger_live,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20olympgate&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '⚡',
    themeColor: {
      primary: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.4)',
      border: 'border-cyan-500/50',
      gradient: 'from-cyan-500 via-blue-600 to-yellow-400'
    },
    rtp: '97.30%',
    volatility: 'High',
    maxMultiplier: '500x',
    minBet: 25.0,
    maxBet: 100000.0,
    badge: '500X STRIKE',
    features: ['Live Studio Stream', 'RNG Lucky Numbers', 'High Definition Multi-Cam'],
    description: 'Revolutionary live casino game with electrified Lucky Numbers struck by RNG lightning for up to 500x payouts.'
  },
  evolution_crazy_time: {
    gameId: 'evolution_crazy_time',
    name: 'Crazy Time Live',
    nameBn: 'ক্রেজি টাইম লাইভ',
    provider: 'Evolution',
    providerId: 'evolution',
    category: 'casino',
    thumbnailUrl: CASINO_ART.speed_baccarat_live,
    animatedPreviewUrl: CASINO_ART.speed_baccarat_live,
    bannerUrl: CASINO_ART.speed_baccarat_live,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs20sweetbonanza&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '🎡',
    themeColor: {
      primary: '#8b5cf6',
      glow: 'rgba(139, 92, 246, 0.4)',
      border: 'border-purple-500/50',
      gradient: 'from-purple-600 via-pink-500 to-yellow-400'
    },
    rtp: '96.08%',
    volatility: 'High',
    maxMultiplier: '20,000x',
    minBet: 20.0,
    maxBet: 50000.0,
    badge: 'TOP LIVE',
    features: ['4 Bonus Rounds (Pachinko, Cash Hunt, Coin Flip, Crazy Time)', 'Top Slot Multiplier Wheel'],
    description: 'The world’s most popular game show with four thrilling bonus rounds and dynamic wheel multipliers.'
  },
  mega_fishing_jili: {
    gameId: 'mega_fishing_jili',
    name: 'Mega Fishing',
    nameBn: 'মেগা ফিশিং (JILI)',
    provider: 'JILI',
    providerId: 'jili',
    category: 'fishing',
    thumbnailUrl: CASINO_ART.jackpot_fishing,
    animatedPreviewUrl: CASINO_ART.jackpot_fishing,
    bannerUrl: CASINO_ART.jackpot_fishing,
    demoUrl: 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=BDT&gameSymbol=vs10bbbonanza&websiteUrl=https%3A%2F%2Fdemogamesfree.pragmaticplay.net&lobbyURL=https%3A%2F%2Fwww.pragmaticplay.com',
    icon: '🐟',
    themeColor: {
      primary: '#0ea5e9',
      glow: 'rgba(14, 165, 233, 0.4)',
      border: 'border-sky-500/50',
      gradient: 'from-sky-500 via-cyan-500 to-emerald-400'
    },
    rtp: '97.00%',
    volatility: 'Medium',
    maxMultiplier: '950x',
    minBet: 5.0,
    maxBet: 20000.0,
    badge: 'FISHING',
    features: ['Torpedo Cannons', 'Mega Boss Awakening', 'Free Electric Net'],
    description: 'Ocean arcade shooting game where laser cannons and torpedoes capture giant sea bosses for massive coins.'
  },
  evolution_baccarat_live: {
    gameId: 'evolution_baccarat_live',
    name: 'Speed Baccarat Live',
    nameBn: 'স্পিড ব্যাকারাত লাইভ',
    provider: 'Evolution',
    providerId: 'evolution',
    category: 'casino',
    thumbnailUrl: CASINO_ART.speed_baccarat_live,
    animatedPreviewUrl: CASINO_ART.speed_baccarat_live,
    bannerUrl: CASINO_ART.speed_baccarat_live,
    icon: '🎴',
    themeColor: {
      primary: '#e11d48',
      glow: 'rgba(225, 29, 72, 0.4)',
      border: 'border-rose-500/50',
      gradient: 'from-rose-600 via-red-600 to-amber-500'
    },
    rtp: '98.94%',
    volatility: 'Low',
    maxMultiplier: '11x',
    minBet: 50.0,
    maxBet: 200000.0,
    badge: 'LIVE DEALER 🔴',
    features: ['Real-time Asian Roadmaps', 'Live HD Dealer Video', 'Player & Banker Pairs (11:1)', 'Instant Squeeze Option'],
    description: 'Authentic high-roller live baccarat with real-time video stream, Bead Plate & Big Road trend tracking.'
  },
  evolution_dragontiger_live: {
    gameId: 'evolution_dragontiger_live',
    name: 'Dragon Tiger Live',
    nameBn: 'ড্রাগন টাইগার লাইভ',
    provider: 'Evolution',
    providerId: 'evolution',
    category: 'casino',
    thumbnailUrl: CASINO_ART.dragon_tiger_live,
    animatedPreviewUrl: CASINO_ART.dragon_tiger_live,
    bannerUrl: CASINO_ART.dragon_tiger_live,
    icon: '🐉',
    themeColor: {
      primary: '#f97316',
      glow: 'rgba(249, 115, 22, 0.4)',
      border: 'border-orange-500/50',
      gradient: 'from-orange-600 via-amber-500 to-red-600'
    },
    rtp: '96.27%',
    volatility: 'Low',
    maxMultiplier: '50x',
    minBet: 25.0,
    maxBet: 100000.0,
    badge: 'LIVE 25S 🔴',
    features: ['Fast 25-Second Rounds', 'Dragon vs Tiger Single Card', 'Suited Tie 50:1'],
    description: 'Fast two-card baccarat popular in Asia. Bet on Dragon or Tiger with lightning payout resolutions.'
  },
  evolution_teen_patti: {
    gameId: 'evolution_teen_patti',
    name: 'Teen Patti 20-20 Live',
    nameBn: 'তিন পাত্তি লাইভ',
    provider: 'Evolution',
    providerId: 'evolution',
    category: 'casino',
    thumbnailUrl: CASINO_ART.teen_patti_live,
    animatedPreviewUrl: CASINO_ART.teen_patti_live,
    bannerUrl: CASINO_ART.teen_patti_live,
    icon: '🃏',
    themeColor: {
      primary: '#10b981',
      glow: 'rgba(16, 185, 129, 0.4)',
      border: 'border-emerald-500/50',
      gradient: 'from-emerald-600 via-teal-500 to-amber-500'
    },
    rtp: '97.50%',
    volatility: 'Medium',
    maxMultiplier: '100x',
    minBet: 20.0,
    maxBet: 50000.0,
    badge: 'DESI LIVE 🔴',
    features: ['3 Card Indian Poker', 'Pair Plus Side Bet', '6 Card Bonus'],
    description: 'Classic Desi 3-card table game live streamed with authentic dealers and side bet bonuses.'
  },
  spribe_mines: {
    gameId: 'spribe_mines',
    name: 'Mines',
    nameBn: 'মাইনস্ (SPRIBE 💎)',
    provider: 'SPRIBE',
    providerId: 'spribe',
    category: 'minigames',
    thumbnailUrl: CASINO_ART.spribe_mines,
    animatedPreviewUrl: CASINO_ART.spribe_mines,
    bannerUrl: CASINO_ART.spribe_mines,
    icon: '💣',
    themeColor: {
      primary: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.4)',
      border: 'border-cyan-500/50',
      gradient: 'from-cyan-500 via-blue-500 to-indigo-600'
    },
    rtp: '97.00%',
    volatility: 'Medium',
    maxMultiplier: '10,000x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: 'HOT 🔥',
    features: ['5x5 Dynamic Grid', '1 to 24 Mines Customizer', 'Instant Cashout Anytime', 'Provably Fair Seed'],
    description: 'The world-renowned minesweeper casino game. Uncover diamonds and cashout before clicking a bomb.'
  },
  spribe_plinko: {
    gameId: 'spribe_plinko',
    name: 'Plinko',
    nameBn: 'প্লিঙ্কো (SPRIBE 🔴)',
    provider: 'SPRIBE',
    providerId: 'spribe',
    category: 'minigames',
    thumbnailUrl: CASINO_ART.spribe_mines,
    animatedPreviewUrl: CASINO_ART.spribe_mines,
    bannerUrl: CASINO_ART.spribe_mines,
    icon: '🔴',
    themeColor: {
      primary: '#ec4899',
      glow: 'rgba(236, 72, 153, 0.4)',
      border: 'border-pink-500/50',
      gradient: 'from-pink-500 via-rose-500 to-yellow-400'
    },
    rtp: '97.00%',
    volatility: 'High',
    maxMultiplier: '1,000x',
    minBet: 10.0,
    maxBet: 50000.0,
    badge: '1000X PIN',
    features: ['12 to 16 Rows Pin Pyramid', 'Green/Yellow/Red Risk Modes', 'Rapid Fire Multiball'],
    description: 'Drop glowing balls through a pyramid of pins into high-multiplier buckets up to 1000x.'
  },
  jili_fortune_gems: {
    gameId: 'jili_fortune_gems',
    name: 'Fortune Gems 2',
    nameBn: 'ফরচুন জেমস ২',
    provider: 'JILI',
    providerId: 'jili',
    category: 'slots',
    thumbnailUrl: CASINO_ART.fortune_gems,
    animatedPreviewUrl: CASINO_ART.fortune_gems,
    bannerUrl: CASINO_ART.fortune_gems,
    icon: '💎',
    themeColor: {
      primary: '#eab308',
      glow: 'rgba(234, 179, 8, 0.4)',
      border: 'border-yellow-500/50',
      gradient: 'from-yellow-500 via-amber-500 to-orange-600'
    },
    rtp: '97.00%',
    volatility: 'Medium',
    maxMultiplier: '10,000x',
    minBet: 10.0,
    maxBet: 30000.0,
    badge: 'HOT 🔥',
    features: ['4th Multiplier Wheel Reel', 'Lucky Wheel Bonus', 'Instant Golden Garuda'],
    description: 'Ancient Mayan gemstone slot with a dedicated 4th multiplier wheel boosting payouts up to 15x on every spin.'
  },
  jili_boxing_king: {
    gameId: 'jili_boxing_king',
    name: 'Boxing King',
    nameBn: 'বক্সিং কিং (JILI)',
    provider: 'JILI',
    providerId: 'jili',
    category: 'slots',
    thumbnailUrl: CASINO_ART.boxing_king,
    animatedPreviewUrl: CASINO_ART.boxing_king,
    bannerUrl: CASINO_ART.boxing_king,
    icon: '🥊',
    themeColor: {
      primary: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.4)',
      border: 'border-red-500/50',
      gradient: 'from-red-600 via-rose-600 to-amber-500'
    },
    rtp: '97.00%',
    volatility: 'High',
    maxMultiplier: '2,000x',
    minBet: 10.0,
    maxBet: 25000.0,
    badge: 'KNOCKOUT',
    features: ['Free Spins Combo Ring', 'Wild Boxing Gloves', 'Cascading Knockout Multipliers'],
    description: 'Heavyweight arcade boxing slot with continuous combo cascades and golden knockout championship belts.'
  },
  sports_cricket_live: {
    gameId: 'sports_cricket_live',
    name: 'Live Cricket BPL / IPL',
    nameBn: 'লাইভ ক্রিকেট এক্সচেঞ্জ (BPL/IPL)',
    provider: 'BetPro Sports',
    providerId: 'sports',
    category: 'sports',
    thumbnailUrl: CASINO_ART.sports_cricket,
    animatedPreviewUrl: CASINO_ART.sports_cricket,
    bannerUrl: CASINO_ART.sports_cricket,
    icon: '🏏',
    themeColor: {
      primary: '#10b981',
      glow: 'rgba(16, 185, 129, 0.4)',
      border: 'border-emerald-500/50',
      gradient: 'from-emerald-600 via-green-600 to-yellow-400'
    },
    rtp: '97.50%',
    volatility: 'Low',
    maxMultiplier: '500x',
    minBet: 50.0,
    maxBet: 500000.0,
    badge: 'LIVE ODDS ⚡',
    features: ['Ball-by-Ball Live Radar', 'Over/Under Runs Markets', 'Instant Cashout Feature', 'Match Winner Exchange'],
    description: 'Comprehensive Asian cricket live match odds exchange covering BPL, IPL, ICC World Cup & T20 leagues.'
  },
  sports_football_live: {
    gameId: 'sports_football_live',
    name: 'Live Football / Soccer',
    nameBn: 'লাইভ ফুটবল প্রিমিয়ার লিগ',
    provider: 'BetPro Sports',
    providerId: 'sports',
    category: 'sports',
    thumbnailUrl: CASINO_ART.sports_football,
    animatedPreviewUrl: CASINO_ART.sports_football,
    bannerUrl: CASINO_ART.sports_football,
    icon: '⚽',
    themeColor: {
      primary: '#3b82f6',
      glow: 'rgba(59, 130, 246, 0.4)',
      border: 'border-blue-500/50',
      gradient: 'from-blue-600 via-indigo-600 to-teal-400'
    },
    rtp: '97.80%',
    volatility: 'Low',
    maxMultiplier: '1,000x',
    minBet: 50.0,
    maxBet: 500000.0,
    badge: 'IN-PLAY ⚽',
    features: ['UEFA / Premier League In-play', 'Asian Handicap', 'Next Goal Live Bet', 'Real-time Pitch Tracker'],
    description: 'World-class in-play football betting with real-time match events, corners, goals, and fast cashout.'
  },
  jili_jackpot_fishing: {
    gameId: 'jili_jackpot_fishing',
    name: 'Jackpot Fishing',
    nameBn: 'জ্যাকপট ফিশিং (JILI)',
    provider: 'JILI',
    providerId: 'jili',
    category: 'fishing',
    thumbnailUrl: CASINO_ART.jackpot_fishing,
    animatedPreviewUrl: CASINO_ART.jackpot_fishing,
    bannerUrl: CASINO_ART.jackpot_fishing,
    icon: '🔱',
    themeColor: {
      primary: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.4)',
      border: 'border-cyan-500/50',
      gradient: 'from-cyan-600 via-teal-500 to-amber-400'
    },
    rtp: '97.00%',
    volatility: 'High',
    maxMultiplier: '1,200x',
    minBet: 10.0,
    maxBet: 30000.0,
    badge: 'MEGA JACKPOT',
    features: ['Grand Jackpot Wheel', 'Poseidon Thunder Spear', 'Frozen Ocean Free Lock'],
    description: 'Hunt mythical sea creatures and trigger the Grand Jackpot Wheel with explosive laser torpedoes.'
  }
};

class AssetLoaderService {
  private cache: Map<string, HTMLImageElement> = new Map();
  private loadedCount: number = 0;

  /**
   * Retrieves high-fidelity asset pack for a given game ID with fallback.
   */
  public getGameAsset(gameId: string): GameAsset {
    if (GAME_ASSETS[gameId]) {
      return GAME_ASSETS[gameId];
    }

    // Heuristic mapping
    const lower = gameId.toLowerCase();
    if (lower.includes('aviator') || lower.includes('spribe') || lower.includes('crash')) {
      return {
        ...GAME_ASSETS['spribe_aviator'],
        gameId,
        name: gameId.replace(/_/g, ' ').toUpperCase()
      };
    }
    if (lower.includes('baccarat') || lower.includes('dealer')) {
      return {
        ...GAME_ASSETS['evolution_baccarat_live'],
        gameId,
        name: gameId.replace(/_/g, ' ').toUpperCase()
      };
    }
    if (lower.includes('dragon') || lower.includes('tiger')) {
      return {
        ...GAME_ASSETS['evolution_dragontiger_live'],
        gameId,
        name: gameId.replace(/_/g, ' ').toUpperCase()
      };
    }
    if (lower.includes('mines')) {
      return {
        ...GAME_ASSETS['spribe_mines'],
        gameId,
        name: gameId.replace(/_/g, ' ').toUpperCase()
      };
    }
    if (lower.includes('ace') || lower.includes('jili')) {
      return {
        ...GAME_ASSETS['jili_super_ace'],
        gameId,
        name: gameId.replace(/_/g, ' ').toUpperCase()
      };
    }
    if (lower.includes('mahjong') || lower.includes('pgsoft')) {
      return {
        ...GAME_ASSETS['pgsoft_mahjong_ways2'],
        gameId,
        name: gameId.replace(/_/g, ' ').toUpperCase()
      };
    }
    if (lower.includes('bonanza') || lower.includes('sweet')) {
      return {
        ...GAME_ASSETS['vs20sweetbonanza'],
        gameId,
        name: gameId.replace(/_/g, ' ').toUpperCase()
      };
    }

    // Default
    return {
      gameId,
      name: gameId.replace(/_/g, ' ').toUpperCase(),
      nameBn: 'গেমপ্লে ৩৬৫ স্লট',
      provider: 'Playall 365 Aggregator',
      providerId: 'generic',
      category: 'slots',
      thumbnailUrl: CASINO_ART.jili_super_ace,
      animatedPreviewUrl: CASINO_ART.jili_super_ace,
      bannerUrl: CASINO_ART.jili_super_ace,
      icon: '🎰',
      themeColor: {
        primary: '#f59e0b',
        glow: 'rgba(245, 158, 11, 0.4)',
        border: 'border-amber-500/50',
        gradient: 'from-amber-500 to-yellow-600'
      },
      rtp: '96.50%',
      volatility: 'High',
      maxMultiplier: '5,000x',
      minBet: 10.0,
      maxBet: 50000.0,
      features: ['Seamless Wallet 4s SLA', 'ACID Concurrency', 'Instant Cashout'],
      description: 'Enterprise aggregator game fully integrated into the primary seamless ledger.'
    };
  }

  /**
   * Returns provider asset details.
   */
  public getProviderAsset(providerId: string): ProviderAsset {
    return (
      PROVIDER_ASSETS[providerId.toLowerCase()] || {
        id: providerId,
        name: providerId.toUpperCase(),
        logoUrl: CASINO_ART.jili_super_ace,
        badgeBg: 'from-slate-700 to-slate-900',
        color: '#94a3b8'
      }
    );
  }

  /**
   * Preloads game assets in background.
   */
  public preloadAssets(gameIds?: string[]) {
    if (typeof window === 'undefined') return;

    const idsToLoad = gameIds || Object.keys(GAME_ASSETS);
    idsToLoad.forEach((id) => {
      const asset = this.getGameAsset(id);
      [asset.thumbnailUrl, asset.bannerUrl].forEach((url) => {
        if (url && !this.cache.has(url)) {
          const img = new Image();
          img.src = url;
          img.onload = () => {
            this.loadedCount++;
          };
          this.cache.set(url, img);
        }
      });
    });
  }

  /**
   * Returns all registered game assets.
   */
  public getAllAssets(): GameAsset[] {
    return Object.values(GAME_ASSETS);
  }
}

export const assetLoader = new AssetLoaderService();
