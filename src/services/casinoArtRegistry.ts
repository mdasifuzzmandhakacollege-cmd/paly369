/**
 * @file casinoArtRegistry.ts
 * @description High-Impact Authentic Asian-Market iGaming Artwork Generator & Vector Registry.
 * Provides crisp, high-resolution vector casino posters for slots, crash, live tables & fishing
 * with authentic 3D elements, typography, provider insignias, and glowing neon effects.
 */

function createSvgPoster({
  title,
  subtitle,
  provider,
  icon,
  multiplier,
  bgGradient,
  accentColor,
  decorations
}: {
  title: string;
  subtitle: string;
  provider: string;
  icon: string;
  multiplier: string;
  bgGradient: [string, string, string];
  accentColor: string;
  decorations: string;
}): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradient[0]}" />
      <stop offset="50%" stop-color="${bgGradient[1]}" />
      <stop offset="100%" stop-color="${bgGradient[2]}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.55" />
      <stop offset="100%" stop-color="${accentColor}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FCE881" />
      <stop offset="50%" stop-color="#FFD700" />
      <stop offset="100%" stop-color="#D4AF37" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.8" />
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="400" height="400" rx="28" fill="url(#bg)" />
  <circle cx="200" cy="160" r="150" fill="url(#glow)" />

  <!-- Background Grid & Accents -->
  <g opacity="0.12" stroke="#ffffff" stroke-width="1">
    <line x1="0" y1="80" x2="400" y2="80" />
    <line x1="0" y1="160" x2="400" y2="160" />
    <line x1="0" y1="240" x2="400" y2="240" />
    <line x1="0" y1="320" x2="400" y2="320" />
    <line x1="80" y1="0" x2="80" y2="400" />
    <line x1="160" y1="0" x2="160" y2="400" />
    <line x1="240" y1="0" x2="240" y2="400" />
    <line x1="320" y1="0" x2="320" y2="400" />
  </g>

  <!-- Custom Decorative Elements -->
  ${decorations}

  <!-- Center Big Icon & Glow Ring -->
  <g transform="translate(200, 160)" filter="url(#shadow)">
    <circle cx="0" cy="0" r="70" fill="#0b1320" stroke="${accentColor}" stroke-width="3" opacity="0.9" />
    <text x="0" y="24" font-size="70" text-anchor="middle" font-family="sans-serif">${icon}</text>
  </g>

  <!-- Top Provider Pill -->
  <g transform="translate(20, 24)">
    <rect width="110" height="26" rx="13" fill="#000000" opacity="0.75" />
    <rect width="110" height="26" rx="13" fill="none" stroke="${accentColor}" stroke-width="1.5" />
    <text x="55" y="17" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" letter-spacing="1">${provider}</text>
  </g>

  <!-- Top Multiplier Tag -->
  <g transform="translate(270, 24)">
    <rect width="110" height="26" rx="13" fill="url(#gold)" />
    <text x="55" y="18" font-size="12" font-weight="900" fill="#0a0f18" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" letter-spacing="0.5">${multiplier}</text>
  </g>

  <!-- Bottom Dark Banner Overlay -->
  <rect x="0" y="295" width="400" height="105" rx="0" fill="#050a12" opacity="0.92" />
  <line x1="0" y1="295" x2="400" y2="295" stroke="${accentColor}" stroke-width="2" opacity="0.8" />

  <!-- Game Title -->
  <text x="200" y="338" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" letter-spacing="0.5" filter="url(#shadow)">
    ${title}
  </text>

  <!-- Game Subtitle / Mode -->
  <text x="200" y="366" font-size="13" font-weight="800" fill="${accentColor}" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" letter-spacing="1">
    ${subtitle}
  </text>

  <rect x="150" y="382" width="100" height="3" rx="1.5" fill="${accentColor}" />
</svg>
`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const CASINO_ART = {
  // 1. Spribe Aviator
  spribe_aviator: createSvgPoster({
    title: 'AVIATOR PRO',
    subtitle: 'CRASH & MULTIPLIER 1000X',
    provider: 'SPRIBE',
    icon: '✈️',
    multiplier: '1,000X',
    bgGradient: ['#3b0712', '#1a0508', '#050102'],
    accentColor: '#f43f5e',
    decorations: `
      <path d="M 50 250 Q 200 240 350 90" fill="none" stroke="#f43f5e" stroke-width="5" stroke-dasharray="6,6" opacity="0.8" />
      <polygon points="350,90 330,95 345,110" fill="#f43f5e" />
    `
  }),

  // 2. WG Aviator
  wg_aviator: createSvgPoster({
    title: 'WG AVIATOR',
    subtitle: 'TURBO FLIGHT 2500X',
    provider: 'WG GAMES',
    icon: '🚀',
    multiplier: '2,500X',
    bgGradient: ['#2e1065', '#170638', '#080117'],
    accentColor: '#a855f7',
    decorations: `
      <circle cx="200" cy="160" r="110" fill="none" stroke="#c084fc" stroke-width="2" opacity="0.4" stroke-dasharray="8,8" />
    `
  }),

  // 3. FlyX
  flyx_crash: createSvgPoster({
    title: 'FLYX CRASH',
    subtitle: 'SUPERHERO FLIGHT 10,000X',
    provider: 'BUCK STAKES',
    icon: '⚡',
    multiplier: '10,000X',
    bgGradient: ['#083344', '#041d27', '#020b10'],
    accentColor: '#06b6d4',
    decorations: `
      <line x1="40" y1="280" x2="360" y2="70" stroke="#22d3ee" stroke-width="4" opacity="0.7" />
    `
  }),

  // 4. JILI Super Ace
  jili_super_ace: createSvgPoster({
    title: 'SUPER ACE',
    subtitle: 'GOLDEN CARDS 1500X',
    provider: 'JILI GAMES',
    icon: '🃏',
    multiplier: '1,500X',
    bgGradient: ['#451a03', '#240d02', '#0d0400'],
    accentColor: '#f59e0b',
    decorations: `
      <rect x="70" y="100" width="60" height="90" rx="8" fill="#ffffff" stroke="#f59e0b" stroke-width="3" transform="rotate(-15 100 145)" opacity="0.3" />
      <rect x="270" y="100" width="60" height="90" rx="8" fill="#ffffff" stroke="#f59e0b" stroke-width="3" transform="rotate(15 300 145)" opacity="0.3" />
    `
  }),

  // 5. JILI Super Ace Deluxe
  jili_super_ace_deluxe: createSvgPoster({
    title: 'SUPER ACE DELUXE',
    subtitle: 'VIP COMBO MULTIPLIER',
    provider: 'JILI GAMES',
    icon: '👑',
    multiplier: '2,000X',
    bgGradient: ['#4c0519', '#28020d', '#0f0004'],
    accentColor: '#fb7185',
    decorations: `
      <polygon points="200,60 215,85 240,85 220,100 230,125 200,110 170,125 180,100 160,85 185,85" fill="#facc15" opacity="0.5" />
    `
  }),

  // 6. PG Soft Mahjong Ways 2
  pgsoft_mahjong_ways2: createSvgPoster({
    title: 'MAHJONG WAYS 2',
    subtitle: 'GOLDEN DRAGON 100,000X',
    provider: 'PG SOFT',
    icon: '🀄',
    multiplier: '100,000X',
    bgGradient: ['#064e3b', '#022c22', '#01140e'],
    accentColor: '#10b981',
    decorations: `
      <rect x="60" y="90" width="70" height="90" rx="10" fill="#047857" stroke="#34d399" stroke-width="2" opacity="0.4" />
      <rect x="270" y="90" width="70" height="90" rx="10" fill="#047857" stroke="#34d399" stroke-width="2" opacity="0.4" />
    `
  }),

  // 7. PG Soft Fortune Tiger
  fortune_tiger: createSvgPoster({
    title: 'FORTUNE TIGER',
    subtitle: 'GOLDEN RESPIN 2500X',
    provider: 'PG SOFT',
    icon: '🐯',
    multiplier: '2,500X',
    bgGradient: ['#7c2d12', '#431407', '#1a0601'],
    accentColor: '#ea580c',
    decorations: `
      <circle cx="200" cy="160" r="100" fill="none" stroke="#fdba74" stroke-width="4" stroke-dasharray="12,12" opacity="0.5" />
    `
  }),

  // 8. Pragmatic Gates of Olympus 1000
  gates_of_olympus: createSvgPoster({
    title: 'GATES OF OLYMPUS',
    subtitle: 'ZEUS MULTIPLIER 5000X',
    provider: 'PRAGMATIC PLAY',
    icon: '⚡',
    multiplier: '5,000X',
    bgGradient: ['#1e1b4b', '#0f0e2b', '#050414'],
    accentColor: '#6366f1',
    decorations: `
      <path d="M 120 70 L 150 140 L 130 140 L 170 230 L 140 160 L 160 160 Z" fill="#fbbf24" opacity="0.6" />
      <path d="M 280 70 L 250 140 L 270 140 L 230 230 L 260 160 L 240 160 Z" fill="#fbbf24" opacity="0.6" />
    `
  }),

  // 9. Pragmatic Sweet Bonanza 1000
  sweet_bonanza: createSvgPoster({
    title: 'SWEET BONANZA',
    subtitle: 'SUGAR BOMBS 25,000X',
    provider: 'PRAGMATIC PLAY',
    icon: '🍭',
    multiplier: '25,000X',
    bgGradient: ['#831843', '#500724', '#20010c'],
    accentColor: '#f43f5e',
    decorations: `
      <circle cx="80" cy="110" r="30" fill="#ec4899" opacity="0.4" />
      <circle cx="320" cy="120" r="35" fill="#a855f7" opacity="0.4" />
    `
  }),

  // 10. Pragmatic Sugar Rush 1000
  sugar_rush: createSvgPoster({
    title: 'SUGAR RUSH 1000',
    subtitle: 'MULTIPLIER SPOTS 25,000X',
    provider: 'PRAGMATIC PLAY',
    icon: '🍬',
    multiplier: '25,000X',
    bgGradient: ['#701a75', '#4a044e', '#230026'],
    accentColor: '#d946ef',
    decorations: `
      <circle cx="200" cy="160" r="105" fill="none" stroke="#f472b6" stroke-width="3" opacity="0.4" stroke-dasharray="10,10" />
    `
  }),

  // 11. Pragmatic Starlight Princess 1000
  starlight_princess: createSvgPoster({
    title: 'STARLIGHT PRINCESS',
    subtitle: 'ANIME CELESTIAL 15,000X',
    provider: 'PRAGMATIC PLAY',
    icon: '👸',
    multiplier: '15,000X',
    bgGradient: ['#1e1b4b', '#2e1065', '#0f0524'],
    accentColor: '#38bdf8',
    decorations: `
      <polygon points="200,50 208,75 235,75 212,90 220,115 200,100 180,115 188,90 165,75 192,75" fill="#38bdf8" opacity="0.7" />
    `
  }),

  // 12. Pragmatic The Dog House Megaways
  dog_house: createSvgPoster({
    title: 'DOG HOUSE MEGAWAYS',
    subtitle: '117,649 WAYS TO WIN',
    provider: 'PRAGMATIC PLAY',
    icon: '🐶',
    multiplier: '12,000X',
    bgGradient: ['#78350f', '#451a03', '#1e0a00'],
    accentColor: '#f59e0b',
    decorations: `
      <rect x="70" y="80" width="80" height="90" rx="10" fill="#b45309" opacity="0.4" />
      <polygon points="110,50 60,85 160,85" fill="#f59e0b" opacity="0.5" />
    `
  }),

  // 13. Evolution Speed Baccarat Live
  speed_baccarat_live: createSvgPoster({
    title: 'SPEED BACCARAT',
    subtitle: 'LIVE DEALER • ROADMAP',
    provider: 'EVOLUTION LIVE',
    icon: '🎴',
    multiplier: '11:1 PAIR',
    bgGradient: ['#4c0519', '#24020a', '#0d0003'],
    accentColor: '#f43f5e',
    decorations: `
      <rect x="60" y="90" width="100" height="60" rx="10" fill="#1e3a8a" stroke="#60a5fa" stroke-width="2" opacity="0.7" />
      <text x="110" y="125" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="sans-serif">PLAYER</text>
      <rect x="240" y="90" width="100" height="60" rx="10" fill="#991b1b" stroke="#f87171" stroke-width="2" opacity="0.7" />
      <text x="290" y="125" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="sans-serif">BANKER</text>
    `
  }),

  // 14. Evolution Dragon Tiger Live
  dragon_tiger_live: createSvgPoster({
    title: 'DRAGON TIGER',
    subtitle: 'LIVE 25-SECOND CLASH',
    provider: 'EVOLUTION LIVE',
    icon: '🐉',
    multiplier: '50X SUITED',
    bgGradient: ['#7c2d12', '#431407', '#1a0601'],
    accentColor: '#f97316',
    decorations: `
      <line x1="200" y1="50" x2="200" y2="280" stroke="#fdba74" stroke-width="3" stroke-dasharray="8,8" opacity="0.6" />
    `
  }),

  // 15. Evolution Teen Patti Live
  teen_patti_live: createSvgPoster({
    title: 'TEEN PATTI 20-20',
    subtitle: 'DESI 3-CARD LIVE POKER',
    provider: 'EVOLUTION LIVE',
    icon: '🃏',
    multiplier: '100X BONUS',
    bgGradient: ['#064e3b', '#022c22', '#01140e'],
    accentColor: '#10b981',
    decorations: `
      <circle cx="200" cy="160" r="105" fill="none" stroke="#6ee7b7" stroke-width="3" opacity="0.4" stroke-dasharray="10,10" />
    `
  }),

  // 16. Spribe Mines
  spribe_mines: createSvgPoster({
    title: 'SPRIBE MINES',
    subtitle: 'DIAMOND MATRIX 10,000X',
    provider: 'SPRIBE',
    icon: '💣',
    multiplier: '10,000X',
    bgGradient: ['#083344', '#041d27', '#010c12'],
    accentColor: '#06b6d4',
    decorations: `
      <rect x="70" y="80" width="45" height="45" rx="8" fill="#0e7490" opacity="0.5" />
      <rect x="130" y="80" width="45" height="45" rx="8" fill="#0e7490" opacity="0.5" />
      <rect x="225" y="80" width="45" height="45" rx="8" fill="#0e7490" opacity="0.5" />
      <rect x="285" y="80" width="45" height="45" rx="8" fill="#0e7490" opacity="0.5" />
    `
  }),

  // 17. JILI Fortune Gems 2
  fortune_gems: createSvgPoster({
    title: 'FORTUNE GEMS 2',
    subtitle: 'GARUDA WHEEL 10,000X',
    provider: 'JILI GAMES',
    icon: '💎',
    multiplier: '10,000X',
    bgGradient: ['#713f12', '#3f2206', '#1a0d01'],
    accentColor: '#eab308',
    decorations: `
      <circle cx="200" cy="160" r="110" fill="none" stroke="#fde047" stroke-width="4" opacity="0.5" stroke-dasharray="14,14" />
    `
  }),

  // 18. JILI Boxing King
  boxing_king: createSvgPoster({
    title: 'BOXING KING',
    subtitle: 'KNOCKOUT COMBO 2,000X',
    provider: 'JILI GAMES',
    icon: '🥊',
    multiplier: '2,000X',
    bgGradient: ['#7f1d1d', '#450a0a', '#1c0303'],
    accentColor: '#ef4444',
    decorations: `
      <polygon points="100,80 120,60 140,80 120,100" fill="#f87171" opacity="0.5" />
      <polygon points="260,80 280,60 300,80 280,100" fill="#f87171" opacity="0.5" />
    `
  }),

  // 19. JILI Jackpot Fishing
  jackpot_fishing: createSvgPoster({
    title: 'JACKPOT FISHING',
    subtitle: 'OCEAN LASER CANNON',
    provider: 'JILI GAMES',
    icon: '🔱',
    multiplier: '1,200X',
    bgGradient: ['#0c4a6e', '#052b42', '#01121d'],
    accentColor: '#38bdf8',
    decorations: `
      <circle cx="90" cy="120" r="25" fill="#0284c7" opacity="0.4" />
      <circle cx="310" cy="100" r="30" fill="#0284c7" opacity="0.4" />
    `
  }),

  // 20. Live Cricket Sports Exchange
  sports_cricket: createSvgPoster({
    title: 'LIVE CRICKET BPL/IPL',
    subtitle: 'BALL-BY-BALL EXCHANGE',
    provider: 'BETPRO SPORTS',
    icon: '🏏',
    multiplier: '500X ODDS',
    bgGradient: ['#064e3b', '#022c22', '#01140e'],
    accentColor: '#10b981',
    decorations: `
      <circle cx="200" cy="160" r="100" fill="none" stroke="#4ade80" stroke-width="2" opacity="0.5" />
    `
  }),

  // 21. Live Football Sports Exchange
  sports_football: createSvgPoster({
    title: 'LIVE FOOTBALL EPL',
    subtitle: 'IN-PLAY MATCH ODDS',
    provider: 'BETPRO SPORTS',
    icon: '⚽',
    multiplier: '1,000X ODDS',
    bgGradient: ['#1e3a8a', '#0f1f4a', '#04081c'],
    accentColor: '#3b82f6',
    decorations: `
      <circle cx="200" cy="160" r="95" fill="none" stroke="#60a5fa" stroke-width="2" opacity="0.5" />
    `
  })
};
