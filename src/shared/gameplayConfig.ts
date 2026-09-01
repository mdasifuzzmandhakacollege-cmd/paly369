/**
 * @file gameplayConfig.ts
 * @description Shared config & constant definitions for Playall 365.
 * Shared between client UI components and backend server controllers without pulling in Node/PG dependencies.
 */

export interface VipTierInfo {
  level: number;
  name: string;
  minDeposit: number;
  minBet: number;
  bonus: number;
  cashback: number;
  payoutLimit: number;
}

export const VIP_TIER_CONFIG: VipTierInfo[] = [
  { level: 1, name: 'V1 Rookie', minDeposit: 0, minBet: 0, bonus: 0, cashback: 0.005, payoutLimit: 50000 },
  { level: 2, name: 'V2 Bronze', minDeposit: 5000, minBet: 25000, bonus: 500, cashback: 0.008, payoutLimit: 100000 },
  { level: 3, name: 'V3 Silver', minDeposit: 25000, minBet: 100000, bonus: 2000, cashback: 0.010, payoutLimit: 250000 },
  { level: 4, name: 'V4 Gold VIP', minDeposit: 100000, minBet: 500000, bonus: 8000, cashback: 0.012, payoutLimit: 500000 },
  { level: 5, name: 'V5 Platinum', minDeposit: 300000, minBet: 1500000, bonus: 25000, cashback: 0.015, payoutLimit: 1000000 },
  { level: 6, name: 'V6 Diamond', minDeposit: 1000000, minBet: 5000000, bonus: 75000, cashback: 0.018, payoutLimit: 2500000 },
  { level: 7, name: 'V7 Master', minDeposit: 2500000, minBet: 15000000, bonus: 200000, cashback: 0.020, payoutLimit: 5000000 },
  { level: 8, name: 'V8 Grandmaster', minDeposit: 5000000, minBet: 40000000, bonus: 500000, cashback: 0.025, payoutLimit: 10000000 },
  { level: 9, name: 'V9 Legend', minDeposit: 10000000, minBet: 100000000, bonus: 1500000, cashback: 0.030, payoutLimit: 25000000 },
  { level: 10, name: 'V10 Immortal', minDeposit: 25000000, minBet: 300000000, bonus: 5000000, cashback: 0.040, payoutLimit: 50000000 }
];

export interface DailyCheckInReward {
  day: number;
  reward: number;
  label: string;
}

export const DAILY_CHECKIN_REWARDS: DailyCheckInReward[] = [
  { day: 1, reward: 50, label: '৳50 Bonus' },
  { day: 2, reward: 100, label: '৳100 Bonus' },
  { day: 3, reward: 150, label: '৳150 Bonus + 5 Spins' },
  { day: 4, reward: 200, label: '৳200 Bonus' },
  { day: 5, reward: 300, label: '৳300 Bonus' },
  { day: 6, reward: 500, label: '৳500 Bonus + 10 Spins' },
  { day: 7, reward: 1000, label: '৳1,000 Grand Streak + Lucky Ticket' }
];

export interface WheelPrize {
  id: number;
  label: string;
  type: 'REAL_CASH' | 'BONUS_CASH' | 'FREE_SPINS' | 'JACKPOT_TICKET';
  value: number;
  weight: number;
  color: string;
}

export const WHEEL_PRIZES: WheelPrize[] = [
  { id: 1, label: '৳500 Real Cash', type: 'REAL_CASH', value: 500, weight: 15, color: '#f59e0b' },
  { id: 2, label: '৳100 Bonus', type: 'BONUS_CASH', value: 100, weight: 35, color: '#06b6d4' },
  { id: 3, label: '25 Free Spins', type: 'FREE_SPINS', value: 25, weight: 25, color: '#a855f7' },
  { id: 4, label: '৳2,000 Real Cash', type: 'REAL_CASH', value: 2000, weight: 5, color: '#10b981' },
  { id: 5, label: '৳50 Bonus', type: 'BONUS_CASH', value: 50, weight: 40, color: '#3b82f6' },
  { id: 6, label: '৳10,000 Mega Jackpot', type: 'REAL_CASH', value: 10000, weight: 1, color: '#ec4899' },
  { id: 7, label: '50 Free Spins', type: 'FREE_SPINS', value: 50, weight: 10, color: '#eab308' },
  { id: 8, label: '৳250 Bonus', type: 'BONUS_CASH', value: 250, weight: 20, color: '#6366f1' }
];
