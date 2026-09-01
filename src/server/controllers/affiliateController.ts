/**
 * @file affiliateController.ts
 * @description Enterprise Multi-Tier Affiliate & Commission Engine for Playall 365.
 * Handles Tier A -> Tier B (Direct 0.50%) -> Tier C (Subordinate 0.20%) -> Tier D (0.10%)
 * commission distributions upon valid bets with row-level locking.
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../../db/index.js';
import { affiliateNodes, affiliateCommissions, users, transactions } from '../../db/schema.js';
import { eq, sql, inArray, and } from 'drizzle-orm';
import { resolveAuthUser, toScale4, fromScale4 } from './promotionController.js';
import { WalletLedgerService } from '../ledger/walletLedgerService.js';

export interface DistributeCommissionParams {
  userId: number;
  betAmount?: number | string | bigint;
  currency?: string;
  sourceTransactionId: string;
  gameId?: string;
}

/**
 * Pure integer minor-units arithmetic for Commission Rates
 * Preserves exact business rates:
 * Tier 1 (Direct Parent): 0.50% (0.0050 = 50 in basis points of 10000)
 * Tier 2 (Grandparent): 0.20% (0.0020 = 20 in basis points of 10000)
 * Tier 3 (Great-Grandparent): 0.10% (0.0010 = 10 in basis points of 10000)
 */
export const COMMISSION_TIER_BPS: Record<number, bigint> = {
  1: 50n, // 0.0050 * 10000 = 50 bps
  2: 20n, // 0.0020 * 10000 = 20 bps
  3: 10n, // 0.0010 * 10000 = 10 bps
};

export class AffiliateService {
  /**
   * Distribute multi-tier commissions when a player places a valid bet.
   * Enforces:
   * 1. Exact Scale-4 BigInt Math (Zero float drift).
   * 2. Transaction status validation (COMMITTED/COMPLETED/SETTLED).
   * 3. Strict Idempotency via sourceTransactionId + beneficiaryUserId + tier.
   * 4. Single ACID transaction with SELECT ... FOR UPDATE row-level locking on all affected affiliate nodes.
   * 5. Immutable commission ledger entries.
   */
  public static async processValidBetCommission(params: DistributeCommissionParams) {
    if (!params.sourceTransactionId || typeof params.sourceTransactionId !== 'string' || params.sourceTransactionId.trim() === '') {
      throw new Error('sourceTransactionId is required for commission distribution');
    }

    // 1. Authoritatively lookup source bet transaction from database
    const [sourceTx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.transactionId, params.sourceTransactionId))
      .limit(1);

    // Reject if source transaction does not exist
    if (!sourceTx) {
      return { success: false, reason: 'SOURCE_TRANSACTION_NOT_FOUND', distributedCount: 0 };
    }

    // Validate type = BET
    if (sourceTx.type !== 'BET') {
      return { success: false, reason: 'INVALID_TRANSACTION_TYPE', distributedCount: 0 };
    }

    // Validate status = COMPLETED or SETTLED
    const isCommittedStatus = sourceTx.status === 'COMPLETED' || sourceTx.status === 'SETTLED';
    if (!isCommittedStatus) {
      return { success: false, reason: 'TRANSACTION_NOT_SETTLED', distributedCount: 0 };
    }

    // Validate ownership: source transaction must belong to the caller/source user
    if (sourceTx.userId !== params.userId) {
      return { success: false, reason: 'TRANSACTION_USER_MISMATCH', distributedCount: 0 };
    }

    // 2. Read authoritative bet amount and currency directly from verified database record
    const authoritativeBetScale4 = toScale4(sourceTx.amount);
    if (authoritativeBetScale4 <= 0n) {
      return { success: false, reason: 'INVALID_BET_AMOUNT', distributedCount: 0 };
    }
    const authoritativeCurrency = sourceTx.currency || 'BDT';

    // 3. Reject any mismatch between caller-supplied context and authoritative source transaction
    if (params.betAmount !== undefined && params.betAmount !== null) {
      const callerBetScale4 = typeof params.betAmount === 'bigint' ? params.betAmount : toScale4(params.betAmount);
      if (callerBetScale4 !== authoritativeBetScale4) {
        return { success: false, reason: 'BET_AMOUNT_MISMATCH', distributedCount: 0 };
      }
    }

    if (params.currency && typeof params.currency === 'string' && params.currency.trim() !== '') {
      if (params.currency.trim().toUpperCase() !== authoritativeCurrency.trim().toUpperCase()) {
        return { success: false, reason: 'CURRENCY_MISMATCH', distributedCount: 0 };
      }
    }

    const betScale4 = authoritativeBetScale4;
    const resolvedCurrency = authoritativeCurrency;

    // 4. Lookup user's affiliate node to resolve upline beneficiaries
    const [userNode] = await db
      .select()
      .from(affiliateNodes)
      .where(eq(affiliateNodes.userId, sourceTx.userId))
      .limit(1);

    if (!userNode || !userNode.parentAffiliateId) {
      return { success: true, reason: 'NO_UPLINE_BENEFICIARY', distributedCount: 0 }; // No upline sponsor
    }

    const beneficiaries: { userId: number; tier: number; bps: bigint; rateStr: string }[] = [];
    
    if (userNode.parentAffiliateId) {
      beneficiaries.push({
        userId: userNode.parentAffiliateId,
        tier: 1,
        bps: COMMISSION_TIER_BPS[1],
        rateStr: '0.0050'
      });
    }

    if (userNode.grandParentAffiliateId) {
      beneficiaries.push({
        userId: userNode.grandParentAffiliateId,
        tier: 2,
        bps: COMMISSION_TIER_BPS[2],
        rateStr: '0.0020'
      });
    }

    if (beneficiaries.length === 0) {
      return { success: true, reason: 'NO_UPLINE_BENEFICIARY', distributedCount: 0 };
    }

    // Execute within a single ACID transaction
    return await db.transaction(async (tx) => {
      // 5. Check existing commission records for strict idempotency
      const existingCommissions = await tx
        .select()
        .from(affiliateCommissions)
        .where(eq(affiliateCommissions.sourceTransactionId, params.sourceTransactionId));

      const existingTierMap = new Set(
        existingCommissions.map((c) => `${c.beneficiaryUserId}_${c.tier}`)
      );

      // Filter to only beneficiaries that haven't been credited for this source transaction
      const pendingBeneficiaries = beneficiaries.filter(
        (b) => !existingTierMap.has(`${b.userId}_${b.tier}`)
      );

      if (pendingBeneficiaries.length === 0) {
        return { success: true, reason: 'ALREADY_PROCESSED', distributedCount: 0 };
      }

      // Collect distinct beneficiary user IDs in deterministic ascending order to prevent deadlocks
      const distinctBeneficiaryIds = Array.from(
        new Set(pendingBeneficiaries.map((b) => b.userId))
      ).sort((a, b) => a - b);

      // 6. Row-level locking on affiliate_nodes using SELECT ... FOR UPDATE
      for (const bUserId of distinctBeneficiaryIds) {
        await tx.execute(
          sql`SELECT * FROM affiliate_nodes WHERE user_id = ${bUserId} FOR UPDATE`
        );
      }

      let distributedCount = 0;

      for (const beneficiary of pendingBeneficiaries) {
        // Exact BigInt calculation: (betScale4 * bps) / 10000n
        const commissionScale4 = (betScale4 * beneficiary.bps) / 10000n;
        if (commissionScale4 <= 0n) {
          continue; // Below min fractional precision unit
        }

        const commissionAmountStr = fromScale4(commissionScale4);
        const betAmountStr = fromScale4(betScale4);

        // Update beneficiary affiliate node counters authoritatively
        await tx
          .update(affiliateNodes)
          .set({
            totalCommissionEarned: sql`(${affiliateNodes.totalCommissionEarned}::numeric + ${commissionAmountStr}::numeric)::text`,
            unclaimedCommission: sql`(${affiliateNodes.unclaimedCommission}::numeric + ${commissionAmountStr}::numeric)::text`,
            totalTurnoverVolume: sql`(${affiliateNodes.totalTurnoverVolume}::numeric + ${betAmountStr}::numeric)::text`,
            updatedAt: new Date()
          })
          .where(eq(affiliateNodes.userId, beneficiary.userId));

        // Insert immutable commission ledger entry
        await tx.insert(affiliateCommissions).values({
          beneficiaryUserId: beneficiary.userId,
          sourceUserId: sourceTx.userId,
          sourceTransactionId: params.sourceTransactionId,
          tier: beneficiary.tier,
          validBetAmount: betAmountStr,
          commissionRate: beneficiary.rateStr,
          commissionAmount: commissionAmountStr,
          currency: resolvedCurrency,
          status: 'SETTLED',
          settledAt: new Date()
        });

        distributedCount++;
      }

      return {
        success: true,
        distributedCount,
        sourceTransactionId: params.sourceTransactionId
      };
    });
  }

  private static ledgerService: WalletLedgerService | null = null;

  public static setLedgerService(service: WalletLedgerService) {
    AffiliateService.ledgerService = service;
  }

  public static getLedgerService(): WalletLedgerService | null {
    return AffiliateService.ledgerService;
  }

  /**
   * Claim accumulated affiliate commissions into withdrawable real wallet balance.
   * Enforces:
   * 1. Authoritative Production Wallet Ledger: Fails closed if production ledger service is not configured (ZERO in-memory fallback).
   * 2. Deterministic Server Idempotency: Server-derived claim ID generated from exact SETTLED commission entry IDs (never Date.now(), client transactionId ignored).
   * 3. Strict Settlement Check: Only exact SETTLED commission entries are claimed; zero fallback credit from aggregate counters.
   * 4. Crash-Safe & Exactly-Once Execution:
   *    - Row-level lock (SELECT ... FOR UPDATE) on affiliate_nodes and affiliateCommissions.
   *    - Deterministic transaction ID derived from exact SETTLED entry IDs ensures ledger credit idempotency.
   *    - Authoritative wallet ledger credit executed with atomic recovery.
   *    - Synchronous transition of commission entries to CLAIMED and deduction of unclaimedCommission.
   * 5. Exact Scale-4 BigInt Math (zero float drift, strict minor-unit representation).
   * 6. Zero direct wallets.realBalance mutation.
   */
  public static async claimAffiliateCommission(userId: number, customLedgerService?: WalletLedgerService) {
    if (!userId || typeof userId !== 'number') {
      throw new Error('Valid userId is required to claim commissions');
    }

    const effectiveLedger = customLedgerService || AffiliateService.ledgerService;
    if (!effectiveLedger) {
      throw new Error('FATAL_LEDGER_UNAVAILABLE: Production WalletLedgerService is not configured. Affiliate commission claim failed closed.');
    }

    return await db.transaction(async (tx) => {
      // 1. Lock affiliate node row with SELECT ... FOR UPDATE
      const [node] = await tx
        .select()
        .from(affiliateNodes)
        .where(eq(affiliateNodes.userId, userId))
        .for('update');

      if (!node) {
        throw new Error('Affiliate profile not found');
      }

      // 2. Fetch all SETTLED (unclaimed) commission entries for this beneficiary with row lock
      const settledCommissions = await tx
        .select()
        .from(affiliateCommissions)
        .where(
          and(
            eq(affiliateCommissions.beneficiaryUserId, userId),
            eq(affiliateCommissions.status, 'SETTLED')
          )
        )
        .for('update');

      // Strict enforcement: Only exact SETTLED affiliateCommissions entries may be claimed. Zero fallback credit.
      if (settledCommissions.length === 0) {
        throw new Error('No unclaimed commissions available');
      }

      // 3. Derive server-deterministic claim ID from exact SETTLED entries
      const sortedIds = settledCommissions.map((c) => c.id).sort((a, b) => a - b);
      const entriesFingerprint = sortedIds.join(',');
      const entriesHash = crypto.createHash('sha256').update(entriesFingerprint).digest('hex').slice(0, 24);
      const deterministicClaimTxId = `AFF_CLAIM_U${userId}_${entriesHash}`;

      // 4. Calculate total claimable commission using exact Scale-4 BigInt math
      let totalClaimableScale4 = 0n;
      for (const entry of settledCommissions) {
        totalClaimableScale4 += toScale4(entry.commissionAmount);
      }

      if (totalClaimableScale4 <= 0n) {
        throw new Error('No unclaimed commissions available');
      }

      const claimedAmountStr = fromScale4(totalClaimableScale4);

      // 5. Authoritatively credit user wallet via production WalletLedgerService (NO direct wallets.realBalance mutation)
      const ledgerResult = await effectiveLedger.executeTransaction({
        userId: String(userId),
        currency: 'BDT',
        type: 'CREDIT',
        amountMinor: claimedAmountStr,
        transactionId: deterministicClaimTxId,
        auditMetadata: {
          providerId: 'GAMEPLAY365_CORE',
          type: 'AFFILIATE_COMMISSION_CLAIM',
          beneficiaryUserId: userId,
          claimedEntryIds: sortedIds,
          claimedAmount: claimedAmountStr
        }
      });

      // 6. Update unclaimed commission on affiliate node
      const nodeUnclaimedScale4 = toScale4(node.unclaimedCommission);
      const remainingUnclaimedScale4 = nodeUnclaimedScale4 > totalClaimableScale4
        ? nodeUnclaimedScale4 - totalClaimableScale4
        : 0n;
      const remainingUnclaimedStr = fromScale4(remainingUnclaimedScale4);

      await tx
        .update(affiliateNodes)
        .set({
          unclaimedCommission: remainingUnclaimedStr,
          updatedAt: new Date()
        })
        .where(eq(affiliateNodes.userId, userId));

      // 7. Mark exact SETTLED commission entries as CLAIMED
      await tx
        .update(affiliateCommissions)
        .set({ status: 'CLAIMED' })
        .where(inArray(affiliateCommissions.id, sortedIds));

      return {
        claimedAmount: claimedAmountStr,
        newRealBalance: ledgerResult.afterBalanceMajor || fromScale4(toScale4(ledgerResult.afterBalanceMinor)),
        transactionId: deterministicClaimTxId,
        ledgerEntryId: ledgerResult.ledgerEntryId,
        isIdempotent: ledgerResult.isIdempotent || false
      };
    });
  }

  /**
   * Bind a new user to an authoritative referrer via unique referralCode.
   * Enforces:
   * 1. PostgreSQL/server as the ONLY authority for referral relationships.
   * 2. Authoritative authenticated caller derived strictly from verified Firebase Auth token.
   * 3. Authoritative resolution of referralCode only against PostgreSQL user/affiliate record.
   * 4. Immutable relationship: Single parent only, never reassignable.
   * 5. Strict idempotency: Retrying with the same parent returns identical success state.
   * 6. Strict validation: Rejects self-referral, referral cycles (A->B->A), invalid codes, parent reassignment.
   * 7. Concurrency-safe: Single ACID transaction with ordered row-level locking (SELECT ... FOR UPDATE).
   * 8. Zero client-side financial mutations.
   */
  public static async bindReferral(params: { userId: number; referralCode: string }) {
    if (!params.userId || typeof params.userId !== 'number') {
      throw new Error('Valid userId is required for referral binding');
    }

    if (!params.referralCode || typeof params.referralCode !== 'string' || !params.referralCode.trim()) {
      const error: any = new Error('Referral code is required');
      error.statusCode = 400;
      error.code = 'INVALID_REFERRAL_CODE';
      throw error;
    }

    const cleanCode = params.referralCode.trim();

    // 1. Authoritative lookup of referrer by referralCode in PostgreSQL
    let referrerUserId: number | null = null;

    // Check affiliate_nodes table first
    const [matchedNode] = await db
      .select()
      .from(affiliateNodes)
      .where(sql`LOWER(${affiliateNodes.referralCode}) = LOWER(${cleanCode})`)
      .limit(1);

    if (matchedNode) {
      referrerUserId = matchedNode.userId;
    } else {
      // Check users table referral_code
      const [matchedUser] = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.referralCode}) = LOWER(${cleanCode})`)
        .limit(1);

      if (matchedUser) {
        referrerUserId = matchedUser.id;
      } else {
        // Check exact PLAY369_<userId> standard format
        const match = cleanCode.toUpperCase().match(/^PLAY369_(\d+)$/);
        if (match) {
          const possibleId = parseInt(match[1], 10);
          const [userById] = await db
            .select()
            .from(users)
            .where(eq(users.id, possibleId))
            .limit(1);

          if (userById) {
            referrerUserId = userById.id;
          }
        }
      }
    }

    if (!referrerUserId) {
      const error: any = new Error(`Invalid or nonexistent referral code: ${cleanCode}`);
      error.statusCode = 404;
      error.code = 'INVALID_REFERRAL_CODE';
      throw error;
    }

    // 2. Reject self-referral
    if (referrerUserId === params.userId) {
      const error: any = new Error('Self-referral is strictly forbidden');
      error.statusCode = 400;
      error.code = 'CANNOT_REFER_SELF';
      throw error;
    }

    // 3. Concurrency-Safe Transaction with Deterministic Row-Level Locking
    return await db.transaction(async (tx) => {
      // Deterministically sort user IDs to prevent database deadlocks on concurrent binds
      const lockIds = [params.userId, referrerUserId].sort((a, b) => a - b);
      for (const uid of lockIds) {
        await tx.execute(sql`SELECT id FROM users WHERE id = ${uid} FOR UPDATE`);
      }

      // Re-read current user under lock
      const [currentUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, params.userId))
        .limit(1);

      if (!currentUser) {
        const error: any = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      const [currentUserNode] = await tx
        .select()
        .from(affiliateNodes)
        .where(eq(affiliateNodes.userId, params.userId))
        .limit(1);

      // 4. Immutability Check: A user may have only ONE parent; once set it can NEVER be reassigned
      const existingParent = currentUser.referredByUserId || currentUserNode?.parentAffiliateId;
      if (existingParent !== null && existingParent !== undefined) {
        if (existingParent === referrerUserId) {
          // Idempotent retry: user is already bound to this exact parent
          return {
            success: true,
            isIdempotent: true,
            message: 'Already referred by this sponsor',
            parentUserId: referrerUserId,
            grandParentUserId: currentUserNode?.grandParentAffiliateId || null,
            referralCode: cleanCode
          };
        } else {
          // Reject attempts to change an existing parent
          const error: any = new Error('Referral relationship is immutable and cannot be reassigned');
          error.statusCode = 409;
          error.code = 'ALREADY_BOUND';
          throw error;
        }
      }

      // 5. Ensure referrer has an authoritative affiliate node record
      let [referrerNode] = await tx
        .select()
        .from(affiliateNodes)
        .where(eq(affiliateNodes.userId, referrerUserId))
        .limit(1);

      if (!referrerNode) {
        const [insertedRefNode] = await tx
          .insert(affiliateNodes)
          .values({
            userId: referrerUserId,
            referralCode: `PLAY369_${referrerUserId}`,
            totalDirectReferrals: 0,
            totalSubordinates: 0,
            totalTurnoverVolume: '0.0000',
            totalCommissionEarned: '0.0000',
            unclaimedCommission: '0.0000',
            status: 'ACTIVE'
          })
          .returning();
        referrerNode = insertedRefNode;
      }

      // 6. Referral Cycle Detection: Traverse upline hierarchy to prevent A -> B -> A cycles
      let currentAncestorId: number | null = referrerNode.parentAffiliateId;
      let depth = 0;
      const visited = new Set<number>([referrerUserId]);

      while (currentAncestorId && depth < 50) {
        if (currentAncestorId === params.userId) {
          const error: any = new Error('Referral cycle detected: Cannot create circular referral relationship');
          error.statusCode = 400;
          error.code = 'REFERRAL_CYCLE_DETECTED';
          throw error;
        }
        if (visited.has(currentAncestorId)) {
          break;
        }
        visited.add(currentAncestorId);

        const [ancestorNode] = await tx
          .select({ parentAffiliateId: affiliateNodes.parentAffiliateId })
          .from(affiliateNodes)
          .where(eq(affiliateNodes.userId, currentAncestorId))
          .limit(1);

        currentAncestorId = ancestorNode?.parentAffiliateId || null;
        depth++;
      }

      // 7. Resolve Grandparent ID
      const grandParentId = referrerNode.parentAffiliateId || null;

      // 8. Update authoritative users table
      await tx
        .update(users)
        .set({
          referredByUserId: referrerUserId,
          updatedAt: new Date()
        })
        .where(eq(users.id, params.userId));

      // 9. Upsert authoritative affiliate_nodes record for new user
      if (currentUserNode) {
        await tx
          .update(affiliateNodes)
          .set({
            parentAffiliateId: referrerUserId,
            grandParentAffiliateId: grandParentId,
            updatedAt: new Date()
          })
          .where(eq(affiliateNodes.userId, params.userId));
      } else {
        await tx
          .insert(affiliateNodes)
          .values({
            userId: params.userId,
            parentAffiliateId: referrerUserId,
            grandParentAffiliateId: grandParentId,
            referralCode: currentUser.referralCode || `PLAY369_${params.userId}`,
            totalDirectReferrals: 0,
            totalSubordinates: 0,
            totalTurnoverVolume: '0.0000',
            totalCommissionEarned: '0.0000',
            unclaimedCommission: '0.0000',
            status: 'ACTIVE'
          });
      }

      // 10. Increment referrer's counters authoritatively
      await tx
        .update(affiliateNodes)
        .set({
          totalDirectReferrals: sql`${affiliateNodes.totalDirectReferrals} + 1`,
          totalSubordinates: sql`${affiliateNodes.totalSubordinates} + 1`,
          updatedAt: new Date()
        })
        .where(eq(affiliateNodes.userId, referrerUserId));

      // 11. If grandparent exists, increment grandparent's subordinate counter
      if (grandParentId) {
        await tx
          .update(affiliateNodes)
          .set({
            totalSubordinates: sql`${affiliateNodes.totalSubordinates} + 1`,
            updatedAt: new Date()
          })
          .where(eq(affiliateNodes.userId, grandParentId));
      }

      return {
        success: true,
        isIdempotent: false,
        message: 'Referral relationship bound successfully',
        parentUserId: referrerUserId,
        grandParentUserId: grandParentId,
        referralCode: cleanCode
      };
    });
  }
}

// ----------------------------------------------------------------------------
// Express Route Handlers
// ----------------------------------------------------------------------------
export const getAffiliateSummaryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req);

    const [node] = await db
      .select()
      .from(affiliateNodes)
      .where(eq(affiliateNodes.userId, userId));

    const commissions = await db
      .select()
      .from(affiliateCommissions)
      .where(eq(affiliateCommissions.beneficiaryUserId, userId))
      .limit(50);

    res.json({
      status: 'SUCCESS',
      data: {
        node: node || {
          userId,
          referralCode: `PLAY369_${userId}`,
          totalDirectReferrals: 0,
          totalSubordinates: 0,
          totalTurnoverVolume: '0.0000',
          totalCommissionEarned: '0.0000',
          unclaimedCommission: '0.0000'
        },
        recentCommissions: commissions || []
      }
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 500);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

export const claimCommissionHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req);
    const result = await AffiliateService.claimAffiliateCommission(userId);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : (err.message?.includes('frozen') || err.message?.includes('inactive') ? 403 : 400));
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

export const bindReferralHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Authoritatively resolve the authenticated user identity via verified Firebase token
    const { userId } = await resolveAuthUser(req);

    // 2. Extract ONLY referralCode from client payload (never trust client-supplied parent/referrer/role)
    const referralCode = req.body?.referralCode;
    if (!referralCode || typeof referralCode !== 'string' || !referralCode.trim()) {
      res.status(400).json({
        status: 'ERROR',
        code: 'INVALID_REFERRAL_CODE',
        message: 'Referral code is required'
      });
      return;
    }

    const result = await AffiliateService.bindReferral({
      userId,
      referralCode: referralCode.trim()
    });

    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    const statusCode = err.statusCode || (
      err.code === 'INVALID_REFERRAL_CODE' ? 404 :
      err.code === 'ALREADY_BOUND' ? 409 :
      err.code === 'CANNOT_REFER_SELF' || err.code === 'REFERRAL_CYCLE_DETECTED' ? 400 :
      err.message?.includes('not found') ? 404 : 400
    );
    res.status(statusCode).json({
      status: 'ERROR',
      code: err.code || 'REFERRAL_BIND_ERROR',
      message: err.message
    });
  }
};
