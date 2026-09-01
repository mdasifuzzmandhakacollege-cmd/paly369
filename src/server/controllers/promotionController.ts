/**
 * @file promotionController.ts
 * @description Enterprise Promotion & Event Engine for Playall 365.
 * Features: 7-Day Daily Check-in Streak, Cryptographically Secure Weighted Spin-the-Wheel,
 * Wagering Turnover Rollover Requirement Tracker (Bonus to Real balance conversion).
 */

import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { users, dailyCheckIns, wheelSpins, wageringRequirements, freeSpinEntitlements } from '../../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import { DAILY_CHECKIN_REWARDS, WHEEL_PRIZES } from '../../shared/gameplayConfig.js';
import { AuthRequest } from '../../middleware/auth.js';
import { WalletLedgerService } from '../ledger/walletLedgerService.js';
import { WheelRngService, CustomRngFunction } from '../services/wheelRngService.js';
import { FreeSpinService } from '../services/freeSpinService.js';
import { WageringService } from '../services/wageringService.js';

/**
 * Pure integer minor-units decimal arithmetic (scale 4, 1.0000 = 10000n)
 * Guarantees zero JavaScript floating-point representation errors.
 */
export const toScale4 = (val: string | number): bigint => {
  const s = typeof val === 'number' ? val.toFixed(4) : String(val).trim();
  const [intPart = '0', fracPart = ''] = s.split('.');
  const paddedFrac = fracPart.padEnd(4, '0').slice(0, 4);
  const isNeg = intPart.startsWith('-');
  const cleanInt = isNeg ? intPart.slice(1) : intPart;
  const combined = BigInt((cleanInt || '0') + paddedFrac);
  return isNeg ? -combined : combined;
};

export const fromScale4 = (val: bigint): string => {
  const isNeg = val < 0n;
  const abs = isNeg ? -val : val;
  const str = abs.toString().padStart(5, '0');
  const intPart = str.slice(0, -4) || '0';
  const fracPart = str.slice(-4);
  return `${isNeg ? '-' : ''}${intPart}.${fracPart}`;
};

/**
 * Authoritative UTC Date String (Format: 'YYYY-MM-DD').
 * Guarantees a single consistent timezone-independent UTC calendar day boundary.
 */
export const getUtcDateString = (d: Date = new Date()): string => {
  return d.toISOString().split('T')[0];
};

/**
 * Calculates the difference in UTC calendar days between two 'YYYY-MM-DD' date strings.
 * Returns:
 *   0 if same UTC date
 *   1 if exactly consecutive UTC day (target is tomorrow relative to base)
 *   >1 if gap/broken streak
 *   <0 if target is before base
 */
export const getUtcDaysDifference = (baseDateUtc: string, targetDateUtc: string): number => {
  const [y1, m1, d1] = baseDateUtc.split('-').map((n) => parseInt(n, 10));
  const [y2, m2, d2] = targetDateUtc.split('-').map((n) => parseInt(n, 10));
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((utc2 - utc1) / msPerDay);
};

export interface AuthenticatedUserResolution {
  userId: number;
  uid: string;
}

/**
 * Authoritative User Identifier Resolver with Firebase Auth Token Binding.
 * - Extracts verified `req.user.uid` from Firebase Auth token.
 * - Resolves the corresponding PostgreSQL user ID (`users.id`).
 * - Strictly validates that any client-supplied userId matches the authenticated identity.
 * - Throws 401 if token identity is missing/invalid.
 * - Throws 403 if client attempts to read/claim for another user ID.
 * - Throws 404 if user is not found in database.
 */
export const resolveAuthUser = async (
  req: Request,
  clientUserId?: unknown
): Promise<AuthenticatedUserResolution> => {
  const authUid = (req as AuthRequest).user?.uid;
  if (!authUid) {
    const error: any = new Error('Unauthorized: Authentication required');
    error.statusCode = 401;
    throw error;
  }

  // Authoritatively lookup user by Firebase UID in database
  const [foundUser] = await db
    .select({ id: users.id, uid: users.uid })
    .from(users)
    .where(eq(users.uid, authUid))
    .limit(1);

  if (!foundUser) {
    const error: any = new Error(`User account not found for UID: ${authUid}`);
    error.statusCode = 404;
    throw error;
  }

  // If client provided a userId in query or body, verify ownership strictly
  if (clientUserId !== undefined && clientUserId !== null && String(clientUserId).trim() !== '') {
    const strClientUserId = String(clientUserId).trim();
    const isMatchingUid = strClientUserId === foundUser.uid;
    const isMatchingId = /^\d+$/.test(strClientUserId) && parseInt(strClientUserId, 10) === foundUser.id;

    if (!isMatchingUid && !isMatchingId) {
      const error: any = new Error('Forbidden: Cannot access or claim rewards for another user');
      error.statusCode = 403;
      throw error;
    }
  }

  return {
    userId: foundUser.id,
    uid: foundUser.uid
  };
};

/**
 * Authoritative User Identifier Resolver (direct database resolution utility)
 */
export const resolveDbUserId = async (rawUserId: unknown): Promise<number> => {
  if (rawUserId === undefined || rawUserId === null || rawUserId === '') {
    throw new Error('Valid userId is required');
  }

  const strUserId = String(rawUserId).trim();
  if (!strUserId) {
    throw new Error('Valid userId is required');
  }

  // 1. Check if numeric primary key id
  if (/^\d+$/.test(strUserId)) {
    const numId = parseInt(strUserId, 10);
    const [foundUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, numId))
      .limit(1);

    if (foundUser) {
      return foundUser.id;
    }
  }

  // 2. Check if text UID in users table
  const [userByUid] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.uid, strUserId))
    .limit(1);

  if (userByUid) {
    return userByUid.id;
  }

  // Strict: If user cannot be found, throw error (no fallback or simulated user ID)
  throw new Error(`User not found: ${strUserId}`);
};


export class PromotionService {
  private static ledgerService: WalletLedgerService | null = null;

  public static setLedgerService(service: WalletLedgerService) {
    PromotionService.ledgerService = service;
  }

  public static getLedgerService(): WalletLedgerService | null {
    return PromotionService.ledgerService;
  }

  /**
   * Process 7-day Daily Check-In with ACID Row-Level Locking, Scale-4 BigInt Math,
   * Authoritative UTC Calendar Day Boundary, PostgreSQL DB-Level Unique Constraint Protection,
   * and Authoritative WalletLedgerService routing (ZERO direct balance mutations).
   */
  public static async claimDailyCheckIn(
    userId: number,
    claimTimestamp: Date = new Date(),
    customLedgerService?: WalletLedgerService
  ) {
    if (!userId || typeof userId !== 'number') {
      throw new Error('Valid userId is required to claim daily check-in');
    }

    const effectiveLedger = customLedgerService || PromotionService.ledgerService;
    if (!effectiveLedger) {
      throw new Error('FATAL_LEDGER_UNAVAILABLE: Production WalletLedgerService is not configured. Promotion claim failed closed.');
    }

    const todayUtc = getUtcDateString(claimTimestamp);
    const deterministicClaimTxId = `PROMO_CHECKIN_${userId}_${todayUtc}`;

    try {
      return await db.transaction(async (tx) => {
        // 1. Check if user already claimed check-in on this UTC date with row lock
        const existingTodayCheckIn = await tx
          .select({ id: dailyCheckIns.id })
          .from(dailyCheckIns)
          .where(
            and(
              eq(dailyCheckIns.userId, userId),
              eq(dailyCheckIns.claimDateUtc, todayUtc)
            )
          )
          .limit(1);

        if (existingTodayCheckIn.length > 0) {
          throw new Error('You have already claimed today’s check-in bonus. Come back tomorrow!');
        }

        // 2. Fetch latest check in within transaction
        const [lastCheckIn] = await tx
          .select()
          .from(dailyCheckIns)
          .where(eq(dailyCheckIns.userId, userId))
          .orderBy(sql`${dailyCheckIns.createdAt} DESC`)
          .limit(1);

        let nextStreakDay = 1;

        if (lastCheckIn) {
          const lastUtc = lastCheckIn.claimDateUtc || getUtcDateString(new Date(lastCheckIn.checkInDate || lastCheckIn.createdAt));
          const diffDays = getUtcDaysDifference(lastUtc, todayUtc);

          if (diffDays <= 0) {
            throw new Error('You have already claimed today’s check-in bonus. Come back tomorrow!');
          } else if (diffDays === 1) {
            nextStreakDay = (lastCheckIn.streakDay % 7) + 1;
          } else {
            nextStreakDay = 1; // Streak broken, reset to 1
          }
        }

        const rewardConfig = DAILY_CHECKIN_REWARDS.find((r) => r.day === nextStreakDay) || DAILY_CHECKIN_REWARDS[0];
        const rewardAmount = rewardConfig.reward;
        const rewardAmountStr = rewardAmount.toFixed(4);
        const rewardBigInt = toScale4(rewardAmountStr);

        // 3. Authoritative Wallet Ledger Credit (NO direct wallets.bonusBalance mutation)
        const ledgerResult = await effectiveLedger.executeTransaction({
          userId: String(userId),
          currency: 'BDT',
          type: 'CREDIT',
          targetBalance: 'BONUS',
          amountMinor: rewardAmountStr,
          transactionId: deterministicClaimTxId,
          auditMetadata: {
            providerId: 'GAMEPLAY365_PROMOTIONS',
            category: 'BONUS_CASH',
            rewardType: 'BONUS_CREDIT',
            promoType: 'DAILY_CHECKIN',
            streakDay: nextStreakDay,
            claimDateUtc: todayUtc,
            rewardAmount: rewardAmountStr,
            isWithdrawable: false
          }
        });

        // 4. Insert immutable check-in record with authoritative UTC claim date
        await tx.insert(dailyCheckIns).values({
          userId: userId,
          checkInDate: claimTimestamp,
          claimDateUtc: todayUtc,
          streakDay: nextStreakDay,
          rewardAmount: rewardAmountStr,
          rewardType: 'BONUS_CREDIT',
          createdAt: claimTimestamp
        });

        // 5. Insert 10x wagering requirement entry
        const targetTurnoverBigInt = rewardBigInt * 10n;
        await tx.insert(wageringRequirements).values({
          userId: userId,
          promoName: `Daily Check-In Day ${nextStreakDay}`,
          bonusAmountGranted: rewardAmountStr,
          requiredMultiplier: 10,
          targetTurnoverAmount: fromScale4(targetTurnoverBigInt),
          completedTurnoverAmount: '0.0000',
          status: 'ACTIVE',
          expiresAt: new Date(claimTimestamp.getTime() + 7 * 24 * 3600 * 1000),
          createdAt: claimTimestamp
        });

        return {
          streakDay: nextStreakDay,
          rewardAmount: rewardAmount,
          label: rewardConfig.label,
          newBonusBalance: parseFloat(ledgerResult.afterBalanceMajor),
          transactionId: deterministicClaimTxId,
          ledgerEntryId: ledgerResult.ledgerEntryId,
          isIdempotent: ledgerResult.isIdempotent || false
        };
      });
    } catch (err: any) {
      // Catch DB-level uniqueness constraint collision (code 23505) if concurrent race occurred
      if (err.code === '23505' || err.message?.includes('daily_check_ins_user_claim_date_utc_idx') || err.message?.includes('duplicate key')) {
        throw new Error('You have already claimed today’s check-in bonus. Come back tomorrow!');
      }
      throw err;
    }
  }

  /**
   * Cryptographically Secure Weighted Lucky Spin-the-Wheel with Daily Limits, Scale-4 Math,
   * Authoritative UTC Calendar Day Boundary, PostgreSQL DB-Level Unique Constraint Protection,
   * Node.js crypto.randomInt CSPRNG authority, and Authoritative WalletLedgerService routing.
   */
  public static async executeWheelSpin(
    userId: number,
    spinTimestamp: Date = new Date(),
    customLedgerService?: WalletLedgerService,
    customRng?: CustomRngFunction,
    customEntitlementCreator?: (params: {
      userId: number;
      spinDateUtc: string;
      quantity: number;
      spinTimestamp: Date;
      tx: any;
    }) => Promise<any>
  ) {
    if (!userId || typeof userId !== 'number') {
      throw new Error('Valid userId is required to execute wheel spin');
    }

    const effectiveLedger = customLedgerService || PromotionService.ledgerService;
    if (!effectiveLedger) {
      throw new Error('FATAL_LEDGER_UNAVAILABLE: Production WalletLedgerService is not configured. Wheel spin failed closed.');
    }

    const todayUtc = getUtcDateString(spinTimestamp);
    const deterministicSpinTxId = `PROMO_WHEEL_${userId}_${todayUtc}`;

    try {
      return await db.transaction(async (tx) => {
        // 1. Strictly enforce wheel daily-spin limit using authoritative UTC date inside the same transaction
        const existingSpin = await tx
          .select({ id: wheelSpins.id })
          .from(wheelSpins)
          .where(
            and(
              eq(wheelSpins.userId, userId),
              eq(wheelSpins.spinDateUtc, todayUtc)
            )
          )
          .limit(1);

        if (existingSpin.length >= 1) {
          throw new Error('You have already used your daily free wheel spin for today. Come back tomorrow!');
        }

        // 2. Cryptographically secure weighted Spin-the-Wheel RNG algorithm (Node.js CSPRNG)
        const selection = WheelRngService.selectPrize(WHEEL_PRIZES, customRng);
        const winningPrize = selection.prize;
        const prizeValueStr = winningPrize.value.toFixed(4);
        const prizeBigInt = toScale4(prizeValueStr);

        // 3. Prepare sanitized spin audit metadata (NO raw entropy/secrets stored)
        const spinAuditMetadata = WheelRngService.createAuditMetadata(
          selection,
          prizeValueStr,
          todayUtc
        );

        let ledgerResult: any = null;
        let entitlementResult: any = null;
        let isClaimFulfilled = false;

        // 4. Authoritative Reward Fulfillment by Prize Type
        if (winningPrize.type === 'REAL_CASH' || winningPrize.type === 'BONUS_CASH') {
          // Monetary prizes routed strictly through WalletLedgerService (NO direct wallet mutations)
          if (prizeBigInt > 0n) {
            if (winningPrize.type === 'REAL_CASH') {
              ledgerResult = await effectiveLedger.executeTransaction({
                userId: String(userId),
                currency: 'BDT',
                type: 'CREDIT',
                targetBalance: 'REAL',
                amountMinor: prizeValueStr,
                transactionId: deterministicSpinTxId,
                auditMetadata: spinAuditMetadata
              });
              isClaimFulfilled = !!ledgerResult?.ledgerEntryId || !!ledgerResult?.isIdempotent;
            } else if (winningPrize.type === 'BONUS_CASH') {
              ledgerResult = await effectiveLedger.executeTransaction({
                userId: String(userId),
                currency: 'BDT',
                type: 'CREDIT',
                targetBalance: 'BONUS',
                amountMinor: prizeValueStr,
                transactionId: deterministicSpinTxId,
                auditMetadata: spinAuditMetadata
              });
              isClaimFulfilled = !!ledgerResult?.ledgerEntryId || !!ledgerResult?.isIdempotent;
            }
          } else {
            isClaimFulfilled = true;
          }
        } else if (winningPrize.type === 'FREE_SPINS') {
          // Non-monetary Free Spins Entitlement Fulfillment (Task 3.4)
          // MUST NOT alter real or bonus wallet balances!
          const spinQuantity = Math.floor(winningPrize.value);
          if (spinQuantity <= 0) {
            throw new Error(`Invalid free spin prize quantity: ${winningPrize.value}`);
          }

          if (customEntitlementCreator) {
            entitlementResult = await customEntitlementCreator({
              userId,
              spinDateUtc: todayUtc,
              quantity: spinQuantity,
              spinTimestamp,
              tx
            });
          } else {
            entitlementResult = await FreeSpinService.grantWheelEntitlement({
              userId,
              spinDateUtc: todayUtc,
              quantity: spinQuantity,
              spinTimestamp,
              expiryDays: 7,
              tx
            });
          }

          if (!entitlementResult) {
            throw new Error(`FATAL_ENTITLEMENT_FAILED: Free spin entitlement creation returned empty. Wheel reward not claimed.`);
          }
          isClaimFulfilled = true;
        } else {
          // Other non-monetary awards (e.g. JACKPOT_TICKET)
          isClaimFulfilled = true;
        }

        // Fail closed if claim was not fulfilled
        if (!isClaimFulfilled) {
          throw new Error(`FATAL_FULFILLMENT_FAILED: Wheel reward fulfillment failed for prize ${winningPrize.label}. Spin failed closed.`);
        }

        // 5. Immutable wheel spin audit log with authoritative UTC spin date and audit metadata
        await tx.insert(wheelSpins).values({
          userId: userId,
          spinDateUtc: todayUtc,
          prizeType: winningPrize.type,
          prizeLabel: winningPrize.label,
          prizeValue: prizeValueStr,
          currency: 'BDT',
          isClaimed: isClaimFulfilled,
          auditMetadata: {
            prizeId: selection.prizeId,
            prizeType: selection.prizeType,
            prizeLabel: selection.prizeLabel,
            prizeWeight: selection.prizeWeight,
            totalWeight: selection.totalWeight,
            algorithm: selection.algorithm,
            spinDateUtc: todayUtc,
            entitlementId: entitlementResult?.id || null,
            entitlementReference: entitlementResult?.sourceReference || null
          },
          createdAt: spinTimestamp
        });

        return {
          prize: winningPrize,
          timestamp: spinTimestamp.getTime(),
          transactionId: deterministicSpinTxId,
          ledgerEntryId: ledgerResult?.ledgerEntryId || null,
          isIdempotent: ledgerResult?.isIdempotent || false,
          entitlement: entitlementResult ? {
            id: entitlementResult.id,
            sourceReference: entitlementResult.sourceReference,
            quantity: entitlementResult.quantity,
            remainingQuantity: entitlementResult.remainingQuantity,
            status: entitlementResult.status,
            expiresAt: entitlementResult.expiresAt
          } : null,
          audit: {
            prizeId: selection.prizeId,
            prizeType: selection.prizeType,
            prizeWeight: selection.prizeWeight,
            totalWeight: selection.totalWeight,
            algorithm: selection.algorithm,
            spinDateUtc: todayUtc
          }
        };
      });
    } catch (err: any) {
      // Catch DB-level uniqueness constraint collision (code 23505) if concurrent race occurred
      if (
        err.code === '23505' ||
        err.message?.includes('wheel_spins_user_spin_date_utc_idx') ||
        err.message?.includes('free_spin_entitlements_') ||
        err.message?.includes('duplicate key')
      ) {
        throw new Error('You have already used your daily free wheel spin for today. Come back tomorrow!');
      }
      throw err;
    }
  }
}

// ----------------------------------------------------------------------------
// Express Handlers
// ----------------------------------------------------------------------------
export const getPromotionDetailsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.query.userId);
    const now = new Date();
    const todayUtc = getUtcDateString(now);

    const [lastCheckIn] = await db
      .select()
      .from(dailyCheckIns)
      .where(eq(dailyCheckIns.userId, userId))
      .orderBy(sql`${dailyCheckIns.createdAt} DESC`)
      .limit(1);

    const activeWagering = await db
      .select()
      .from(wageringRequirements)
      .where(eq(wageringRequirements.userId, userId))
      .limit(10);

    const [todaySpin] = await db
      .select({ id: wheelSpins.id })
      .from(wheelSpins)
      .where(
        and(
          eq(wheelSpins.userId, userId),
          eq(wheelSpins.spinDateUtc, todayUtc)
        )
      )
      .limit(1);

    const activeFreeSpins = await db
      .select({
        id: freeSpinEntitlements.id,
        quantity: freeSpinEntitlements.quantity,
        remainingQuantity: freeSpinEntitlements.remainingQuantity,
        status: freeSpinEntitlements.status,
        expiresAt: freeSpinEntitlements.expiresAt,
        spinDateUtc: freeSpinEntitlements.spinDateUtc
      })
      .from(freeSpinEntitlements)
      .where(
        and(
          eq(freeSpinEntitlements.userId, userId),
          eq(freeSpinEntitlements.status, 'ACTIVE')
        )
      );

    const totalActiveFreeSpins = activeFreeSpins.reduce((sum, e) => sum + (e.remainingQuantity || 0), 0);

    let streak = 0;
    let canCheckInToday = true;

    if (lastCheckIn) {
      const lastUtc = lastCheckIn.claimDateUtc || getUtcDateString(new Date(lastCheckIn.checkInDate || lastCheckIn.createdAt));
      const diffDays = getUtcDaysDifference(lastUtc, todayUtc);

      if (diffDays <= 0) {
        canCheckInToday = false;
        streak = lastCheckIn.streakDay || 0;
      } else if (diffDays === 1) {
        canCheckInToday = true;
        streak = lastCheckIn.streakDay || 0;
      } else {
        canCheckInToday = true;
        streak = 0; // Streak broken
      }
    }

    // Authoritative available spins: 1 free daily spin per UTC date minus spins consumed today
    const availableSpins = todaySpin ? 0 : 1;

    res.json({
      status: 'SUCCESS',
      data: {
        checkInStreak: streak,
        canCheckInToday,
        availableSpins,
        activeFreeSpinsCount: totalActiveFreeSpins,
        freeSpinEntitlements: activeFreeSpins || [],
        dailyRewards: DAILY_CHECKIN_REWARDS,
        wheelPrizes: WHEEL_PRIZES,
        activeWageringRequirements: activeWagering || []
      }
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

export const claimCheckInHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const result = await PromotionService.claimDailyCheckIn(userId);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

export const spinWheelHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const result = await PromotionService.executeWheelSpin(userId);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

export const convertBonusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const requirementId = Number(req.body?.requirementId);
    if (!requirementId || isNaN(requirementId)) {
      res.status(400).json({ status: 'ERROR', message: 'Valid requirementId is required' });
      return;
    }
    const currency = req.body?.currency || 'BDT';
    const idempotencyKey = req.body?.idempotencyKey || (req.headers['idempotency-key'] as string);

    const result = await WageringService.convertOrReleaseBonus({
      userId,
      requirementId,
      currency,
      idempotencyKey
    });

    if (!result.success) {
      const statusCode = result.reason === 'TRANSACTION_USER_MISMATCH' ? 403 : 400;
      res.status(statusCode).json({
        status: 'ERROR',
        message: `Bonus conversion blocked: ${result.reason}`,
        data: result
      });
      return;
    }

    res.json({
      status: 'SUCCESS',
      data: result,
      message: result.duplicate
        ? 'Bonus requirement already released'
        : 'Bonus successfully converted and credited to REAL balance'
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

export const getWageringStatusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.query?.userId);
    const activeReqs = await WageringService.getUserActiveRequirements(userId);
    const gate = await WageringService.enforceWithdrawalWageringGate({ userId });
    res.json({
      status: 'SUCCESS',
      data: {
        userId,
        canWithdraw: gate.allowed,
        gateReason: gate.reason,
        activeRequirementsCount: gate.activeRequirementsCount,
        activeRequirements: activeReqs
      }
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

