/**
 * @file vipController.ts
 * @description Enterprise VIP & Loyalty Progression System for Playall 365.
 * Automated VIP tier evaluation (V1 Rookie to V10 Immortal), level-up bonus unlocks,
 * daily cashback distributions, and VIP benefit metrics.
 */

import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import {
  vipLevels,
  userVipProgress,
  users,
  vipRewardClaims,
  vipProgressionEvents,
  paymentRequests,
  transactions
} from '../../db/schema.js';
import { and, eq, or, sql } from 'drizzle-orm';
import { VIP_TIER_CONFIG } from '../../shared/gameplayConfig.js';
import { resolveAuthUser, toScale4, fromScale4 } from './promotionController.js';
import { WalletLedgerService } from '../ledger/walletLedgerService.js';

export interface ProcessProgressionEventParams {
  userId: number;
  sourceTransactionId: string;
  sourceType: 'DEPOSIT' | 'BET';
  amount?: string | number | bigint;
  currency?: string;
}

export interface ProgressionUpdateResult {
  success: boolean;
  duplicate?: boolean;
  reason?: string;
  userId: number;
  sourceTransactionId: string;
  sourceType: 'DEPOSIT' | 'BET';
  amountScale4?: bigint;
  amountStr?: string;
  previousDeposit?: string;
  newDeposit?: string;
  previousBet?: string;
  newBet?: string;
  cumulativeDeposit?: string;
  cumulativeBet?: string;
  previousLevel?: number;
  currentLevel?: number;
  upgraded?: boolean;
  newTierName?: string;
  levelUpBonusAvailable?: number;
}

export class VipService {
  private static ledgerService: WalletLedgerService | null = null;

  public static setLedgerService(service: WalletLedgerService) {
    VipService.ledgerService = service;
  }

  public static getLedgerService(): WalletLedgerService | null {
    return VipService.ledgerService;
  }

  /**
   * Cron / Background Evaluator: Check cumulative deposits and bets to trigger tier upgrades
   * Pure scale-4 BigInt arithmetic (zero float drift / zero Number() conversion).
   */
  public static async evaluateVipUpgrade(userId: number) {
    return await db.transaction(async (tx) => {
      const [progress] = await tx
        .select()
        .from(userVipProgress)
        .where(eq(userVipProgress.userId, userId))
        .for('update');

      if (!progress) return null;

      const currentLvl = progress.currentLevel;
      const depositScale4 = toScale4(progress.cumulativeDeposit || '0.0000');
      const betScale4 = toScale4(progress.cumulativeBet || '0.0000');

      // Find highest qualifying level with exact BigInt comparisons
      let qualifiedLevel = 1;
      for (const tier of VIP_TIER_CONFIG) {
        const minDepositScale4 = toScale4(tier.minDeposit);
        const minBetScale4 = toScale4(tier.minBet);
        if (depositScale4 >= minDepositScale4 && betScale4 >= minBetScale4) {
          qualifiedLevel = tier.level;
        }
      }

      if (qualifiedLevel > currentLvl) {
        const upgradedTier = VIP_TIER_CONFIG.find((t) => t.level === qualifiedLevel)!;

        // Upgrade user level
        await tx
          .update(userVipProgress)
          .set({
            currentLevel: qualifiedLevel,
            lastUpgradedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(userVipProgress.userId, userId));

        await tx
          .update(users)
          .set({
            vipLevel: qualifiedLevel,
            vipTier: upgradedTier.name.toUpperCase().replace(/\s+/g, '_'),
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));

        return {
          upgraded: true,
          oldLevel: currentLvl,
          newLevel: qualifiedLevel,
          tierName: upgradedTier.name,
          levelUpBonusAvailable: upgradedTier.bonus
        };
      }

      return { upgraded: false, currentLevel: currentLvl };
    });
  }

  /**
   * Authoritative VIP Progression Event Processor (Task 4.3 & 4.3.1 Atomic TOCTOU Fix)
   * 
   * [SOURCE AUTHORITY, ATOMICITY & FINANCIAL INTEGRITY INVARIANTS]:
   * 1. Transactional Atomicity (TOCTOU Proof):
   *    All source lookup (SELECT ... FOR UPDATE on paymentRequests / transactions),
   *    validation, vip_progression_events idempotency, user_vip_progress locking & increment,
   *    and tier upgrade evaluation occur inside the SAME ACID transaction.
   * 2. Authoritative Source Validation: Only settled/approved REAL deposits and committed BET transactions.
   * 3. Exclusions: Rejects failed, pending, rejected, reversed, promo, bonus, commission, admin adjustment, and free-spin stakes.
   * 4. Pure Scale-4 BigInt Arithmetic: Zero Number(), parseFloat(), or floating-point math in financial path.
   * 5. Strict Idempotency: Enforced by PostgreSQL unique constraint on vip_progression_events (user_id, source_transaction_id, source_type).
   * 6. Concurrent Safety: Locks user_vip_progress with FOR UPDATE to eliminate lost updates on parallel events.
   */
  public static async processAuthoritativeProgression(
    params: ProcessProgressionEventParams
  ): Promise<ProgressionUpdateResult> {
    if (!params.userId || typeof params.userId !== 'number') {
      throw new Error('Valid userId is required');
    }
    if (!params.sourceTransactionId || typeof params.sourceTransactionId !== 'string' || params.sourceTransactionId.trim() === '') {
      throw new Error('sourceTransactionId is required for VIP progression');
    }
    if (params.sourceType !== 'DEPOSIT' && params.sourceType !== 'BET') {
      return {
        success: false,
        reason: 'INVALID_SOURCE_TYPE',
        userId: params.userId,
        sourceTransactionId: params.sourceTransactionId,
        sourceType: params.sourceType
      };
    }

    // Atomic ACID Transaction enclosing source verification, locking, event logging, and progression update
    return await db.transaction(async (tx) => {
      // 1. Authoritative Source Lookup inside the transaction with row locks
      let authoritativeAmount: string = '0.0000';
      let authoritativeCurrency: string = 'BDT';

      if (params.sourceType === 'DEPOSIT') {
        const [req] = await tx
          .select()
          .from(paymentRequests)
          .where(
            and(
              eq(paymentRequests.userId, params.userId),
              or(
                eq(paymentRequests.trxId, params.sourceTransactionId),
                sql`${paymentRequests.id}::varchar = ${params.sourceTransactionId}`
              )
            )
          )
          .for('update')
          .limit(1);

        let depositRecord: { amount: string; currency: string; status: string; type: string; userId: number } | null = req
          ? { amount: String(req.amount), currency: req.currency || 'BDT', status: req.status, type: req.type, userId: req.userId }
          : null;

        if (!depositRecord) {
          const [depositTx] = await tx
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.userId, params.userId),
                eq(transactions.transactionId, params.sourceTransactionId)
              )
            )
            .for('update')
            .limit(1);

          if (depositTx) {
            depositRecord = {
              amount: String(depositTx.amount),
              currency: depositTx.currency || 'BDT',
              status: depositTx.status,
              type: depositTx.type,
              userId: depositTx.userId
            };
          }
        }

        if (!depositRecord) {
          return {
            success: false,
            reason: 'SOURCE_TRANSACTION_NOT_FOUND',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: 'DEPOSIT'
          };
        }

        if (depositRecord.userId !== params.userId) {
          return {
            success: false,
            reason: 'TRANSACTION_USER_MISMATCH',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: 'DEPOSIT'
          };
        }

        if (depositRecord.type !== 'DEPOSIT') {
          return {
            success: false,
            reason: 'INVALID_TRANSACTION_TYPE',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: 'DEPOSIT'
          };
        }

        const isApprovedDeposit = depositRecord.status === 'APPROVED' || depositRecord.status === 'COMPLETED' || depositRecord.status === 'SETTLED';
        if (!isApprovedDeposit) {
          return {
            success: false,
            reason: 'DEPOSIT_NOT_SETTLED',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: 'DEPOSIT'
          };
        }

        authoritativeAmount = depositRecord.amount;
        authoritativeCurrency = depositRecord.currency;
      } else if (params.sourceType === 'BET') {
        const [betTx] = await tx
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, params.userId),
              eq(transactions.transactionId, params.sourceTransactionId)
            )
          )
          .for('update')
          .limit(1);

        if (!betTx) {
          return {
            success: false,
            reason: 'SOURCE_TRANSACTION_NOT_FOUND',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: 'BET'
          };
        }

        if (betTx.userId !== params.userId) {
          return {
            success: false,
            reason: 'TRANSACTION_USER_MISMATCH',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: 'BET'
          };
        }

        if (betTx.type !== 'BET') {
          return {
            success: false,
            reason: 'INVALID_TRANSACTION_TYPE',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: 'BET'
          };
        }

        const isCommittedBet = betTx.status === 'COMPLETED' || betTx.status === 'SETTLED';
        if (!isCommittedBet) {
          return {
            success: false,
            reason: 'TRANSACTION_NOT_SETTLED',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: 'BET'
          };
        }

        const meta = betTx.metadata as any;
        if (meta && (meta.freeSpin === true || meta.isFreeSpin === true || meta.source === 'FREE_SPIN')) {
          return {
            success: false,
            reason: 'EXCLUDED_PROMOTIONAL_STAKE',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: 'BET'
          };
        }

        authoritativeAmount = String(betTx.amount);
        authoritativeCurrency = betTx.currency || 'BDT';
      }

      // 2. Validate scale-4 amount and check callers' context if provided
      const amountScale4 = toScale4(authoritativeAmount);
      if (amountScale4 <= 0n) {
        return {
          success: false,
          reason: 'INVALID_AMOUNT',
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          sourceType: params.sourceType
        };
      }

      if (params.amount !== undefined && params.amount !== null) {
        const callerAmountScale4 = typeof params.amount === 'bigint' ? params.amount : toScale4(params.amount);
        if (callerAmountScale4 !== amountScale4) {
          return {
            success: false,
            reason: params.sourceType === 'BET' ? 'BET_AMOUNT_MISMATCH' : 'AMOUNT_MISMATCH',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: params.sourceType
          };
        }
      }

      if (params.currency && typeof params.currency === 'string' && params.currency.trim() !== '') {
        if (params.currency.trim().toUpperCase() !== authoritativeCurrency.trim().toUpperCase()) {
          return {
            success: false,
            reason: 'CURRENCY_MISMATCH',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: params.sourceType
          };
        }
      }

      const amountStr = fromScale4(amountScale4);

      // 3. Check idempotency in vip_progression_events inside same transaction
      const [existingEvent] = await tx
        .select()
        .from(vipProgressionEvents)
        .where(
          and(
            eq(vipProgressionEvents.userId, params.userId),
            eq(vipProgressionEvents.sourceTransactionId, params.sourceTransactionId),
            eq(vipProgressionEvents.sourceType, params.sourceType)
          )
        )
        .for('update');

      if (existingEvent) {
        const [currProgress] = await tx
          .select()
          .from(userVipProgress)
          .where(eq(userVipProgress.userId, params.userId));

        return {
          success: true,
          duplicate: true,
          reason: 'ALREADY_PROCESSED',
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          sourceType: params.sourceType,
          currentLevel: currProgress?.currentLevel || 1,
          cumulativeDeposit: currProgress?.cumulativeDeposit || '0.0000',
          cumulativeBet: currProgress?.cumulativeBet || '0.0000'
        };
      }

      // 4. Insert event into vip_progression_events
      const [insertedEvent] = await tx
        .insert(vipProgressionEvents)
        .values({
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          sourceType: params.sourceType,
          amount: amountStr,
          currency: authoritativeCurrency,
          processedAt: new Date()
        })
        .onConflictDoNothing()
        .returning();

      if (!insertedEvent) {
        const [currProgress] = await tx
          .select()
          .from(userVipProgress)
          .where(eq(userVipProgress.userId, params.userId));

        return {
          success: true,
          duplicate: true,
          reason: 'ALREADY_PROCESSED',
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          sourceType: params.sourceType,
          currentLevel: currProgress?.currentLevel || 1,
          cumulativeDeposit: currProgress?.cumulativeDeposit || '0.0000',
          cumulativeBet: currProgress?.cumulativeBet || '0.0000'
        };
      }

      // 5. Lock user_vip_progress row to prevent lost updates under concurrency
      let [progress] = await tx
        .select()
        .from(userVipProgress)
        .where(eq(userVipProgress.userId, params.userId))
        .for('update');

      if (!progress) {
        const [created] = await tx
          .insert(userVipProgress)
          .values({
            userId: params.userId,
            currentLevel: 1,
            cumulativeDeposit: '0.0000',
            cumulativeBet: '0.0000',
            levelUpBonusClaimed: [],
            totalCashbackClaimed: '0.0000',
            lastUpgradedAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        progress = created;
      }

      // 6. Compute new cumulative totals with pure Scale-4 BigInt arithmetic
      const prevDepositScale4 = toScale4(progress.cumulativeDeposit || '0.0000');
      const prevBetScale4 = toScale4(progress.cumulativeBet || '0.0000');

      let newDepositScale4 = prevDepositScale4;
      let newBetScale4 = prevBetScale4;

      if (params.sourceType === 'DEPOSIT') {
        newDepositScale4 = prevDepositScale4 + amountScale4;
      } else if (params.sourceType === 'BET') {
        newBetScale4 = prevBetScale4 + amountScale4;
      }

      const newDepositStr = fromScale4(newDepositScale4);
      const newBetStr = fromScale4(newBetScale4);

      // 7. Evaluate VIP upgrade with pure BigInt comparisons
      let qualifiedLevel = 1;
      for (const tier of VIP_TIER_CONFIG) {
        const minDepositScale4 = toScale4(tier.minDeposit);
        const minBetScale4 = toScale4(tier.minBet);
        if (newDepositScale4 >= minDepositScale4 && newBetScale4 >= minBetScale4) {
          qualifiedLevel = tier.level;
        }
      }

      const currentLvl = progress.currentLevel;
      let upgraded = false;
      let upgradedTierName: string | undefined = undefined;
      let levelUpBonusAvailable: number | undefined = undefined;

      if (qualifiedLevel > currentLvl) {
        upgraded = true;
        const upgradedTier = VIP_TIER_CONFIG.find((t) => t.level === qualifiedLevel)!;
        upgradedTierName = upgradedTier.name;
        levelUpBonusAvailable = upgradedTier.bonus;

        await tx
          .update(userVipProgress)
          .set({
            currentLevel: qualifiedLevel,
            cumulativeDeposit: newDepositStr,
            cumulativeBet: newBetStr,
            lastUpgradedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(userVipProgress.userId, params.userId));

        await tx
          .update(users)
          .set({
            vipLevel: qualifiedLevel,
            vipTier: upgradedTier.name.toUpperCase().replace(/\s+/g, '_'),
            updatedAt: new Date()
          })
          .where(eq(users.id, params.userId));
      } else {
        await tx
          .update(userVipProgress)
          .set({
            cumulativeDeposit: newDepositStr,
            cumulativeBet: newBetStr,
            updatedAt: new Date()
          })
          .where(eq(userVipProgress.userId, params.userId));
      }

      return {
        success: true,
        duplicate: false,
        userId: params.userId,
        sourceTransactionId: params.sourceTransactionId,
        sourceType: params.sourceType,
        amountScale4,
        amountStr,
        previousDeposit: fromScale4(prevDepositScale4),
        newDeposit: newDepositStr,
        previousBet: fromScale4(prevBetScale4),
        newBet: newBetStr,
        cumulativeDeposit: newDepositStr,
        cumulativeBet: newBetStr,
        previousLevel: currentLvl,
        currentLevel: upgraded ? qualifiedLevel : currentLvl,
        upgraded,
        newTierName: upgradedTierName,
        levelUpBonusAvailable
      };
    });
  }

  public static async recordAuthoritativeDeposit(params: {
    userId: number;
    sourceTransactionId: string;
    amount?: string | number | bigint;
    currency?: string;
  }) {
    return await VipService.processAuthoritativeProgression({
      ...params,
      sourceType: 'DEPOSIT'
    });
  }

  public static async recordAuthoritativeBet(params: {
    userId: number;
    sourceTransactionId: string;
    amount?: string | number | bigint;
    currency?: string;
  }) {
    return await VipService.processAuthoritativeProgression({
      ...params,
      sourceType: 'BET'
    });
  }

  /**
   * Claim VIP Level-Up Reward
   * 
   * [FINANCIAL LEDGER & IDEMPOTENCY INVARIANTS]:
   * 1. Zero Direct Wallet Mutation: Balance changes are strictly executed by production WalletLedgerService.
   * 2. Canonical Scale-4 Money Arithmetic: Exact integer minor units (1 BDT = 10000 minor units).
   * 3. Deterministic Transaction ID: 'VIP_LEVELUP_<userId>_<level>' for exactly-once ledger credit idempotency.
   * 4. Crash-Safe State Machine:
   *    - Row lock on user_vip_progress via SELECT ... FOR UPDATE.
   *    - Row lock & reserve claim in vip_reward_claims with status 'PENDING'.
   *    - Idempotent execution via WalletLedgerService.
   *    - Synchronous transition of vip_reward_claims to 'CREDITED' and update of levelUpBonusClaimed.
   * 5. Fail Closed: Rejects immediately if production WalletLedgerService is unavailable.
   */
  public static async claimLevelUpBonus(
    userId: number,
    levelToClaim: number,
    customLedgerService?: WalletLedgerService
  ) {
    if (!userId || typeof userId !== 'number') {
      throw new Error('Valid userId is required');
    }
    if (!levelToClaim || typeof levelToClaim !== 'number' || levelToClaim < 1 || levelToClaim > 10) {
      throw new Error('Valid VIP level is required');
    }

    const effectiveLedger = customLedgerService || VipService.ledgerService;
    if (!effectiveLedger) {
      throw new Error('FATAL_LEDGER_UNAVAILABLE: Production WalletLedgerService is not configured. VIP reward claim failed closed.');
    }

    const tierConfig = VIP_TIER_CONFIG.find((t) => t.level === levelToClaim);
    if (!tierConfig || tierConfig.bonus <= 0) {
      throw new Error('No bonus configured for this level');
    }

    const deterministicClaimTxId = `VIP_LEVELUP_${userId}_${levelToClaim}`;
    const rewardAmountScale4 = toScale4(tierConfig.bonus);
    const rewardAmountStr = fromScale4(rewardAmountScale4);

    return await db.transaction(async (tx) => {
      // 1. Lock user VIP progress row with SELECT ... FOR UPDATE
      const [progress] = await tx
        .select()
        .from(userVipProgress)
        .where(eq(userVipProgress.userId, userId))
        .for('update');

      if (!progress) {
        throw new Error('VIP progress profile not found');
      }

      if (progress.currentLevel < levelToClaim) {
        throw new Error(`You have not reached VIP Level ${levelToClaim} yet`);
      }

      // 2. Lock & check existing claim record in vip_reward_claims
      const [existingClaim] = await tx
        .select()
        .from(vipRewardClaims)
        .where(
          and(
            eq(vipRewardClaims.userId, userId),
            eq(vipRewardClaims.vipLevel, levelToClaim)
          )
        )
        .for('update');

      if (existingClaim && existingClaim.status === 'CREDITED') {
        throw new Error(`Level ${levelToClaim} bonus has already been claimed`);
      }

      const claimedList = ((progress.levelUpBonusClaimed as number[]) || []).slice();
      if (existingClaim?.status === 'CREDITED' || (claimedList.includes(levelToClaim) && !existingClaim)) {
        throw new Error(`Level ${levelToClaim} bonus has already been claimed`);
      }

      // 3. Reserve or find claim record
      let claimRecord = existingClaim;
      if (!claimRecord) {
        const [inserted] = await tx
          .insert(vipRewardClaims)
          .values({
            userId,
            vipLevel: levelToClaim,
            transactionId: deterministicClaimTxId,
            rewardAmount: rewardAmountStr,
            currency: 'BDT',
            status: 'PENDING',
            createdAt: new Date()
          })
          .onConflictDoNothing()
          .returning();

        if (!inserted) {
          const [fetched] = await tx
            .select()
            .from(vipRewardClaims)
            .where(
              and(
                eq(vipRewardClaims.userId, userId),
                eq(vipRewardClaims.vipLevel, levelToClaim)
              )
            )
            .for('update');
          claimRecord = fetched;
        } else {
          claimRecord = inserted;
        }
      }

      if (claimRecord && claimRecord.status === 'CREDITED') {
        throw new Error(`Level ${levelToClaim} bonus has already been claimed`);
      }

      // 4. Authoritative Wallet Ledger Credit (Zero direct wallets balance mutation)
      const ledgerResult = await effectiveLedger.executeTransaction({
        userId: String(userId),
        currency: 'BDT',
        type: 'CREDIT',
        targetBalance: 'REAL',
        amountMinor: rewardAmountStr,
        transactionId: deterministicClaimTxId,
        auditMetadata: {
          providerId: 'GAMEPLAY365_VIP',
          type: 'VIP_LEVEL_UP_REWARD',
          userId,
          levelClaimed: levelToClaim,
          tierName: tierConfig.name,
          rewardAmount: rewardAmountStr
        }
      });

      // 5. Update claim record status to CREDITED
      if (claimRecord) {
        await tx
          .update(vipRewardClaims)
          .set({
            status: 'CREDITED',
            creditedAt: new Date()
          })
          .where(eq(vipRewardClaims.id, claimRecord.id));
      }

      // 6. Update levelUpBonusClaimed array on userVipProgress for compatibility/UI
      if (!claimedList.includes(levelToClaim)) {
        claimedList.push(levelToClaim);
      }
      await tx
        .update(userVipProgress)
        .set({
          levelUpBonusClaimed: claimedList,
          updatedAt: new Date()
        })
        .where(eq(userVipProgress.userId, userId));

      return {
        levelClaimed: levelToClaim,
        bonusAmount: tierConfig.bonus,
        newRealBalance: ledgerResult.afterBalanceMajor,
        transactionId: deterministicClaimTxId,
        status: 'CREDITED'
      };
    });
  }
}

// ----------------------------------------------------------------------------
// Express Handlers
// ----------------------------------------------------------------------------
export const getVipDetailsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.query?.userId);
    const [progress] = await db
      .select()
      .from(userVipProgress)
      .where(eq(userVipProgress.userId, userId));

    res.json({
      status: 'SUCCESS',
      data: {
        tiers: VIP_TIER_CONFIG,
        userProgress: progress || {
          currentLevel: 1,
          cumulativeDeposit: '0.0000',
          cumulativeBet: '0.0000',
          levelUpBonusClaimed: [],
          totalCashbackClaimed: '0.0000'
        }
      }
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 500);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

export const claimVipBonusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const rawLevel = req.body?.level;
    if (rawLevel === undefined || rawLevel === null || isNaN(Number(rawLevel))) {
      res.status(400).json({ status: 'ERROR', message: 'Valid level is required' });
      return;
    }
    const level = Number(rawLevel);
    const result = await VipService.claimLevelUpBonus(userId, level);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};
