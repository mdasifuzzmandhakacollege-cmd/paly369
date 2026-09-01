/**
 * @file mockGamesData.ts
 * @description Dedicated mock dataset for PLAY369 Game Lobby UI.
 * 
 * [ARCHITECTURAL NOTE - MOCK DATA ISOLATION]:
 * This mock dataset is completely separated from future production provider adapters 
 * and API integrations. When a real game provider adapter (e.g., Seamless Wallet API, 
 * Slot Aggregator, Live Casino feed) is plugged in, it replaces this mock layer with zero 
 * impact on the UI component hierarchy.
 */

export interface MockGameItem {
  id: string;
  name: string;
  nameBn?: string;
  provider: string;
  providerId: string;
  category: 'hot' | 'slots' | 'crash' | 'casino' | 'table' | 'sports' | 'fishing' | 'arcade';
  rtp: string;
  volatility: 'Low' | 'Medium' | 'High' | 'Extreme';
  maxMultiplier: string;
  minBet: number;
  maxBet: number;
  imageUrl: string;
  isFeatured?: boolean;
  isHot?: boolean;
  isNew?: boolean;
  badge?: string;
  activePlayersCount?: number;
  tags?: string[];
}

export interface MockCategory {
  id: string;
  label: string;
  labelBn: string;
  icon: string;
  count: number;
}

export interface MockProvider {
  id: string;
  name: string;
  code: string;
  icon: string;
  gameCount: number;
  featured?: boolean;
}

export interface MockFeaturedHeroSlide {
  id: string;
  tag: string;
  title: string;
  titleBn: string;
  subtitle: string;
  btnText: string;
  targetGameId?: string;
  targetAction?: 'game' | 'rewards' | 'cashier' | 'vip';
  bgGradient: string;
  borderColor: string;
  accentColor: string;
  iconEmoji: string;
  multiplierText?: string;
  rtpText?: string;
}

// 1. Categories for Navigation
export const MOCK_CATEGORIES: MockCategory[] = [
  { id: 'all', label: 'All Games', labelBn: 'সব গেম', icon: '🎲', count: 48 },
  { id: 'hot', label: 'Hot & Popular', labelBn: 'জনপ্রিয়', icon: '🔥', count: 16 },
  { id: 'slots', label: 'Video Slots', labelBn: 'স্লটস', icon: '🎰', count: 24 },
  { id: 'crash', label: 'Crash & Fast', labelBn: 'ক্র্যাশ গেম', icon: '🚀', count: 8 },
  { id: 'casino', label: 'Live Casino', labelBn: 'লাইভ ক্যাসিনো', icon: '♠️', count: 12 },
  { id: 'table', label: 'Table Games', labelBn: 'টেবিল গেম', icon: '🃏', count: 6 },
  { id: 'fishing', label: 'Fish Hunter', labelBn: 'ফিশিং গেম', icon: '🎣', count: 6 },
  { id: 'sports', label: 'Sportsbook', labelBn: 'স্পোর্টস', icon: '⚽', count: 4 }
];

// 2. Providers for Filtering
export const MOCK_PROVIDERS: MockProvider[] = [
  { id: 'all', name: 'All Providers', code: 'ALL', icon: '🌐', gameCount: 48, featured: true },
  { id: 'pragmatic', name: 'Pragmatic Play', code: 'PRAGMATIC', icon: '👑', gameCount: 16, featured: true },
  { id: 'pgsoft', name: 'PG Soft', code: 'PGSOFT', icon: '💎', gameCount: 12, featured: true },
  { id: 'jili', name: 'JILI Games', code: 'JILI', icon: '⚡', gameCount: 10, featured: true },
  { id: 'spribe', name: 'Spribe', code: 'SPRIBE', icon: '🚀', gameCount: 4, featured: true },
  { id: 'evolution', name: 'Evolution Gaming', code: 'EVOLUTION', icon: '♠️', gameCount: 6, featured: true },
  { id: 'fachai', name: 'Fa Chai', code: 'FACHAI', icon: '🔥', gameCount: 5 },
  { id: 'nolimit', name: 'Nolimit City', code: 'NOLIMIT', icon: '💀', gameCount: 4 },
  { id: 'hacksaw', name: 'Hacksaw Gaming', code: 'HACKSAW', icon: '🪓', gameCount: 4 }
];

// 3. Featured Hero Slides
export const MOCK_FEATURED_SLIDES: MockFeaturedHeroSlide[] = [
  {
    id: 'hero-aviator',
    tag: 'GLOBAL CRASH PHENOMENON',
    title: 'Spribe Aviator • 1,000x Multiplier',
    titleBn: 'স্প্রাইব এভিয়েটর - ১০০০x ক্যাশ মাল্টিপ্লায়ার',
    subtitle: 'Cash out before the plane flies away. Instant provably-fair multiplier curves.',
    btnText: 'Launch Aviator 🚀',
    targetGameId: 'spribe_aviator',
    targetAction: 'game',
    bgGradient: 'from-rose-950/90 via-[#260a12] to-[#02180e]',
    borderColor: 'border-rose-500/60',
    accentColor: '#f43f5e',
    iconEmoji: '✈️',
    multiplierText: '10,000x',
    rtpText: '97.0%'
  },
  {
    id: 'hero-olympus',
    tag: 'PRAGMATIC MEGA HIT',
    title: 'Gates of Olympus 1000 • Zeus Wrath',
    titleBn: 'গেটস অফ অলিম্পাস ১০০০ - মেগা মাল্টিপ্লায়ার',
    subtitle: 'Tumble cascades and 1000x lightning orbs in high-volatility Olympian reels.',
    btnText: 'Spin Now ⚡',
    targetGameId: 'vs20olympgate',
    targetAction: 'game',
    bgGradient: 'from-amber-950/90 via-[#2a1d06] to-[#02180e]',
    borderColor: 'border-amber-400/60',
    accentColor: '#f59e0b',
    iconEmoji: '⚡',
    multiplierText: '15,000x',
    rtpText: '98.5%'
  },
  {
    id: 'hero-super-ace',
    tag: 'JILI ASIAN CLASSIC',
    title: 'Super Ace • Golden Card Cascades',
    titleBn: 'সুপার এস - গোল্ডেন কম্বো মাল্টিপ্লায়ার',
    subtitle: 'Eliminate golden cards for wild jokers and escalating multiplier free games.',
    btnText: 'Play Super Ace 🃏',
    targetGameId: 'jili_super_ace',
    targetAction: 'game',
    bgGradient: 'from-emerald-950/90 via-[#072417] to-[#02180e]',
    borderColor: 'border-emerald-500/60',
    accentColor: '#10b981',
    iconEmoji: '👑',
    multiplierText: '1,500x',
    rtpText: '97.9%'
  },
  {
    id: 'hero-mahjong',
    tag: 'PG SOFT LEGEND',
    title: 'Mahjong Ways 2 • Dragon Fortune',
    titleBn: 'মাহজং ওয়েজ ২ - ড্রাগন ফরচুন মেগা ওয়েজ',
    subtitle: 'Gold-plated symbols transform into wilds with up to 10x multiplier in free spins.',
    btnText: 'Enter Arena 🀄',
    targetGameId: 'pg_mahjong_ways_2',
    targetAction: 'game',
    bgGradient: 'from-purple-950/90 via-[#1f092b] to-[#02180e]',
    borderColor: 'border-purple-500/60',
    accentColor: '#a855f7',
    iconEmoji: '🀄',
    multiplierText: '100,000x',
    rtpText: '96.9%'
  }
];

// 4. Primary Mock Games Catalog
export const MOCK_GAMES_CATALOG: MockGameItem[] = [
  // --- CRASH & FAST ---
  {
    id: 'spribe_aviator',
    name: 'Aviator',
    nameBn: 'এভিয়েটর',
    provider: 'Spribe',
    providerId: 'spribe',
    category: 'crash',
    rtp: '97.0%',
    volatility: 'Medium',
    maxMultiplier: '10,000x',
    minBet: 10,
    maxBet: 50000,
    imageUrl: 'https://images.unsplash.com/photo-1517976487507-5b6533d8a57e?w=600&auto=format&fit=crop&q=80',
    isFeatured: true,
    isHot: true,
    badge: 'HOT #1',
    activePlayersCount: 4280,
    tags: ['Crash', 'Fast', 'Multiplayer', 'Instant Cashout']
  },
  {
    id: 'spribe_mines',
    name: 'Mines',
    nameBn: 'মাইনস',
    provider: 'Spribe',
    providerId: 'spribe',
    category: 'crash',
    rtp: '97.0%',
    volatility: 'High',
    maxMultiplier: '10,000x',
    minBet: 10,
    maxBet: 25000,
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    isHot: true,
    badge: 'HOT',
    activePlayersCount: 1840,
    tags: ['Grid', 'Instant Win', 'Custom Risk']
  },
  {
    id: 'spribe_plinko',
    name: 'Plinko',
    nameBn: 'প্লিঙ্কো',
    provider: 'Spribe',
    providerId: 'spribe',
    category: 'crash',
    rtp: '99.0%',
    volatility: 'Low',
    maxMultiplier: '1,000x',
    minBet: 10,
    maxBet: 20000,
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
    isHot: false,
    badge: 'HIGH RTP',
    activePlayersCount: 920,
    tags: ['Plinko', 'Casual', 'High RTP']
  },

  // --- PRAGMATIC PLAY SLOTS ---
  {
    id: 'vs20olympgate',
    name: 'Gates of Olympus',
    nameBn: 'গেটস অফ অলিম্পাস',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'slots',
    rtp: '96.5%',
    volatility: 'Extreme',
    maxMultiplier: '5,000x',
    minBet: 20,
    maxBet: 40000,
    imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
    isFeatured: true,
    isHot: true,
    badge: 'POPULAR',
    activePlayersCount: 3120,
    tags: ['Tumble', 'Free Spins', 'Zeus', 'Multipliers']
  },
  {
    id: 'vs20sweetbonz',
    name: 'Sweet Bonanza',
    nameBn: 'সুইট বোনানজা',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'slots',
    rtp: '96.5%',
    volatility: 'High',
    maxMultiplier: '21,100x',
    minBet: 20,
    maxBet: 35000,
    imageUrl: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=600&auto=format&fit=crop&q=80',
    isHot: true,
    badge: 'HOT',
    activePlayersCount: 2650,
    tags: ['Candy', 'Tumble', 'Bomb Multipliers']
  },
  {
    id: 'vs20doghouse',
    name: 'The Dog House Megaways',
    nameBn: 'দ্য ডগ হাউস মেগাওয়েজ',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'slots',
    rtp: '96.6%',
    volatility: 'Extreme',
    maxMultiplier: '12,305x',
    minBet: 20,
    maxBet: 25000,
    imageUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&auto=format&fit=crop&q=80',
    isHot: false,
    badge: 'MEGAWAYS',
    activePlayersCount: 1100,
    tags: ['Megaways', 'Sticky Wilds', 'Multiplier']
  },
  {
    id: 'vs20starlight',
    name: 'Starlight Princess',
    nameBn: 'স্টারলাইট প্রিন্সেস',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'slots',
    rtp: '96.5%',
    volatility: 'Extreme',
    maxMultiplier: '5,000x',
    minBet: 20,
    maxBet: 30000,
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    isHot: true,
    badge: 'HOT',
    activePlayersCount: 2190,
    tags: ['Anime', 'Tumble', 'Cascades']
  },
  {
    id: 'vs10bbextrm',
    name: 'Big Bass Extreme',
    nameBn: 'বিগ ব্যাস এক্সট্রিম',
    provider: 'Pragmatic Play',
    providerId: 'pragmatic',
    category: 'slots',
    rtp: '96.1%',
    volatility: 'High',
    maxMultiplier: '4,000x',
    minBet: 10,
    maxBet: 20000,
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop&q=80',
    isHot: false,
    badge: 'ANGLER',
    activePlayersCount: 880,
    tags: ['Fishing', 'Collect', 'Bonus Retrigger']
  },

  // --- JILI SLOTS & TABLE ---
  {
    id: 'jili_super_ace',
    name: 'Super Ace',
    nameBn: 'সুপার এস',
    provider: 'JILI Games',
    providerId: 'jili',
    category: 'slots',
    rtp: '97.9%',
    volatility: 'Medium',
    maxMultiplier: '1,500x',
    minBet: 10,
    maxBet: 50000,
    imageUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=600&auto=format&fit=crop&q=80',
    isFeatured: true,
    isHot: true,
    badge: 'JILI #1',
    activePlayersCount: 3890,
    tags: ['Golden Card', 'Poker Slots', 'Asian Classic']
  },
  {
    id: 'jili_boxing_king',
    name: 'Boxing King',
    nameBn: 'বক্সিং কিং',
    provider: 'JILI Games',
    providerId: 'jili',
    category: 'slots',
    rtp: '97.0%',
    volatility: 'High',
    maxMultiplier: '2,000x',
    minBet: 10,
    maxBet: 30000,
    imageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80',
    isHot: true,
    badge: 'HOT',
    activePlayersCount: 1750,
    tags: ['Boxing', 'Combos', 'Free Games']
  },
  {
    id: 'jili_golden_empire',
    name: 'Golden Empire',
    nameBn: 'গোল্ডেন এম্পায়ার',
    provider: 'JILI Games',
    providerId: 'jili',
    category: 'slots',
    rtp: '97.1%',
    volatility: 'High',
    maxMultiplier: '2,000x',
    minBet: 10,
    maxBet: 40000,
    imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
    isHot: false,
    badge: 'MEGA WAYS',
    activePlayersCount: 1420,
    tags: ['Inca', 'Megaways', 'Golden Frames']
  },
  {
    id: 'jili_fortune_gems',
    name: 'Fortune Gems 2',
    nameBn: 'ফরচুন জেমস ২',
    provider: 'JILI Games',
    providerId: 'jili',
    category: 'slots',
    rtp: '97.5%',
    volatility: 'Medium',
    maxMultiplier: '10,000x',
    minBet: 10,
    maxBet: 50000,
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    isHot: true,
    badge: 'HOT',
    activePlayersCount: 2900,
    tags: ['Multiplier Reel', 'Classic 3x3', 'Instant Bonus']
  },
  {
    id: 'jili_crazy_777',
    name: 'Crazy 777',
    nameBn: 'ক্রেজি ৭৭৭',
    provider: 'JILI Games',
    providerId: 'jili',
    category: 'slots',
    rtp: '97.2%',
    volatility: 'Low',
    maxMultiplier: '3,333x',
    minBet: 5,
    maxBet: 15000,
    imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    isHot: false,
    badge: 'CLASSIC',
    activePlayersCount: 650,
    tags: ['Retro', 'Single Line', 'Special Reel']
  },

  // --- PG SOFT SLOTS ---
  {
    id: 'pg_mahjong_ways_2',
    name: 'Mahjong Ways 2',
    nameBn: 'মাহজং ওয়েজ ২',
    provider: 'PG Soft',
    providerId: 'pgsoft',
    category: 'slots',
    rtp: '96.9%',
    volatility: 'Medium',
    maxMultiplier: '100,000x',
    minBet: 10,
    maxBet: 50000,
    imageUrl: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=600&auto=format&fit=crop&q=80',
    isFeatured: true,
    isHot: true,
    badge: 'PG TOP #1',
    activePlayersCount: 4670,
    tags: ['Mahjong', 'Gold Symbols', 'Transforming Wilds']
  },
  {
    id: 'pg_fortune_tiger',
    name: 'Fortune Tiger',
    nameBn: 'ফরচুন টাইগার',
    provider: 'PG Soft',
    providerId: 'pgsoft',
    category: 'slots',
    rtp: '96.8%',
    volatility: 'Medium',
    maxMultiplier: '2,500x',
    minBet: 10,
    maxBet: 30000,
    imageUrl: 'https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=600&auto=format&fit=crop&q=80',
    isHot: true,
    badge: 'HOT',
    activePlayersCount: 3100,
    tags: ['Tiger Respins', '10x Multiplier Full Screen']
  },
  {
    id: 'pg_fortune_rabbit',
    name: 'Fortune Rabbit',
    nameBn: 'ফরচুন র‍্যাবিট',
    provider: 'PG Soft',
    providerId: 'pgsoft',
    category: 'slots',
    rtp: '96.7%',
    volatility: 'Medium',
    maxMultiplier: '5,000x',
    minBet: 10,
    maxBet: 30000,
    imageUrl: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=600&auto=format&fit=crop&q=80',
    isHot: false,
    badge: 'PRIZE FEATURE',
    activePlayersCount: 1650,
    tags: ['Prize Symbols', 'Free Spins']
  },
  {
    id: 'pg_lucky_neko',
    name: 'Lucky Neko',
    nameBn: 'লাকি নেকো',
    provider: 'PG Soft',
    providerId: 'pgsoft',
    category: 'slots',
    rtp: '96.7%',
    volatility: 'Medium',
    maxMultiplier: '20,000x',
    minBet: 10,
    maxBet: 40000,
    imageUrl: 'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=600&auto=format&fit=crop&q=80',
    isHot: true,
    badge: 'HOT',
    activePlayersCount: 2200,
    tags: ['Cat Multipliers', 'Gigantic Wilds']
  },
  {
    id: 'pg_wild_bandito',
    name: 'Wild Bandito',
    nameBn: 'ওয়াইল্ড বান্ডিতো',
    provider: 'PG Soft',
    providerId: 'pgsoft',
    category: 'slots',
    rtp: '96.7%',
    volatility: 'Medium',
    maxMultiplier: '25,000x',
    minBet: 10,
    maxBet: 25000,
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    isHot: false,
    badge: 'NEW',
    activePlayersCount: 950,
    tags: ['Mariachi', 'Increasing Multiplier']
  },

  // --- LIVE CASINO (EVOLUTION & PRAGMATIC LIVE) ---
  {
    id: 'evo_crazy_time',
    name: 'Crazy Time',
    nameBn: 'ক্রেজি টাইম',
    provider: 'Evolution Gaming',
    providerId: 'evolution',
    category: 'casino',
    rtp: '96.1%',
    volatility: 'High',
    maxMultiplier: '25,000x',
    minBet: 10,
    maxBet: 100000,
    imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    isFeatured: true,
    isHot: true,
    badge: 'LIVE SHOW',
    activePlayersCount: 5400,
    tags: ['Live Presenter', 'Cash Hunt', 'Pachinko', 'Coin Flip']
  },
  {
    id: 'evo_lightning_roulette',
    name: 'Lightning Roulette',
    nameBn: 'লাইটনিং রুলেট',
    provider: 'Evolution Gaming',
    providerId: 'evolution',
    category: 'casino',
    rtp: '97.3%',
    volatility: 'High',
    maxMultiplier: '500x',
    minBet: 20,
    maxBet: 200000,
    imageUrl: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=600&auto=format&fit=crop&q=80',
    isHot: true,
    badge: 'LIVE',
    activePlayersCount: 3100,
    tags: ['Live Dealer', 'Lightning Multipliers', 'European Wheel']
  },
  {
    id: 'evo_speed_baccarat_a',
    name: 'Speed Baccarat A',
    nameBn: 'স্পিড ব্যাকারাত',
    provider: 'Evolution Gaming',
    providerId: 'evolution',
    category: 'casino',
    rtp: '98.9%',
    volatility: 'Low',
    maxMultiplier: '11x',
    minBet: 50,
    maxBet: 500000,
    imageUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=600&auto=format&fit=crop&q=80',
    isHot: true,
    badge: 'HIGH ROLLER',
    activePlayersCount: 2800,
    tags: ['Asian Squeeze', 'Live Roadmaps', 'Dragon Bonus']
  },
  {
    id: 'evo_monopoly_live',
    name: 'Monopoly Live',
    nameBn: 'মনোপলি লাইভ',
    provider: 'Evolution Gaming',
    providerId: 'evolution',
    category: 'casino',
    rtp: '96.2%',
    volatility: 'High',
    maxMultiplier: '10,000x',
    minBet: 10,
    maxBet: 50000,
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    isHot: false,
    badge: '3D BONUS',
    activePlayersCount: 1980,
    tags: ['Mr Monopoly', '3D Board', 'Dice Rolls']
  },

  // --- FISH HUNTER & ARCADE ---
  {
    id: 'jili_mega_fishing',
    name: 'Mega Fishing',
    nameBn: 'মেগা ফিশিং',
    provider: 'JILI Games',
    providerId: 'jili',
    category: 'fishing',
    rtp: '97.0%',
    volatility: 'Medium',
    maxMultiplier: '950x',
    minBet: 1,
    maxBet: 1000,
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop&q=80',
    isHot: true,
    badge: 'FISH #1',
    activePlayersCount: 1890,
    tags: ['Deep Sea', 'Laser Cannon', 'Boss Jackpot']
  },
  {
    id: 'fc_fierce_fishing',
    name: 'Fierce Fishing',
    nameBn: 'ফিয়ার্স ফিশিং',
    provider: 'Fa Chai',
    providerId: 'fachai',
    category: 'fishing',
    rtp: '97.2%',
    volatility: 'Medium',
    maxMultiplier: '1,000x',
    minBet: 1,
    maxBet: 1500,
    imageUrl: 'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=600&auto=format&fit=crop&q=80',
    isHot: false,
    badge: 'HOT',
    activePlayersCount: 1120,
    tags: ['Torpedo', 'Golden Kraken', 'Lock Target']
  },

  // --- SPORTSBOOK ---
  {
    id: 'sports_cricket_exchange',
    name: 'BPL & IPL Cricket Live',
    nameBn: 'ক্রিকেট লাইভ এক্সচেঞ্জ',
    provider: 'PLAY369 Sports',
    providerId: 'pragmatic',
    category: 'sports',
    rtp: '98.0%',
    volatility: 'Medium',
    maxMultiplier: '500x',
    minBet: 50,
    maxBet: 200000,
    imageUrl: 'https://images.unsplash.com/photo-1531415074868-036b1c57e3ce?w=600&auto=format&fit=crop&q=80',
    isHot: true,
    badge: 'LIVE MATCH',
    activePlayersCount: 4900,
    tags: ['Cricket', 'In-Play Live', 'Fast Odds']
  },
  {
    id: 'sports_premier_league',
    name: 'EPL & UEFA Football',
    nameBn: 'ফুটবল প্রিমিয়ার লীগ',
    provider: 'PLAY369 Sports',
    providerId: 'pragmatic',
    category: 'sports',
    rtp: '97.8%',
    volatility: 'Medium',
    maxMultiplier: '1,000x',
    minBet: 50,
    maxBet: 200000,
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80',
    isHot: false,
    badge: 'FOOTBALL',
    activePlayersCount: 2300,
    tags: ['Live Soccer', 'Corners', 'Asian Handicap']
  }
];

// Helper to get game by ID from mock catalog
export const getMockGameById = (id: string): MockGameItem | undefined => {
  return MOCK_GAMES_CATALOG.find((g) => g.id === id);
};
