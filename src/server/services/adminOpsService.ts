/**
 * @file adminOpsService.ts
 * @description Authoritative PostgreSQL Admin Operations Data Read Layer for PLAY369.
 * 
 * CORE CONTRACT & ARCHITECTURAL INVARIANTS:
 * 1. Financial Truth from PostgreSQL ONLY: Zero financial reads from Firestore.
 * 2. Exact Decimal Strings: All monetary balances, liabilities, and totals are computed
 *    using pure BigInt scale-4 arithmetic and returned strictly as exact decimal strings (e.g. "1250.0000").
 *    No JavaScript floating point Number(), parseFloat(), or toFixed().
 * 3. Zero Secrets Exposure: Strips and redacts all provider API keys, HMAC secrets,
 *    Firebase service credentials, and internal tokens.
 * 4. Fail Closed: Throws descriptive errors if the authoritative database query fails,
 *    never returning fabricated fallback numbers.
 * 5. Pagination & Filtering: All list queries support robust pagination and criteria filtering.
 * 6. Authoritative Metadata: All responses carry `source: "POSTGRESQL_AUTHORITATIVE"`.
 */

import { eq, and, desc, sql, count, isNull, inArray, gte, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  users,
  wallets,
  ledgerEntries,
  paymentRequests,
  transactions,
  gameProviders,
  wageringRequirements,
  wageringProgressEvents,
  vipLevels,
  userVipProgress,
  vipRewardClaims,
  affiliateNodes,
  affiliateCommissions,
  dailyCheckIns,
  wheelSpins,
  freeSpinEntitlements
} from '../../db/schema.js';
import { paymentGatewayEngine } from '../../services/paymentGatewayEngine.js';

export const AUTHORITATIVE_SOURCE_TAG = 'POSTGRESQL_AUTHORITATIVE';

/**
 * Exact scale-4 arithmetic conversion helpers (1.0000 = 10000n)
 * Guarantees zero floating point precision drift.
 */
export const toScale4 = (val: string | number | bigint | null | undefined): bigint => {
  if (val === null || val === undefined || val === '') return 0n;
  if (typeof val === 'bigint') return val;
  const s = String(val).trim();
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return 0n;
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

export const sumDecimalStrings = (values: (string | number | bigint | null | undefined)[]): string => {
  let total = 0n;
  for (const v of values) {
    total += toScale4(v);
  }
  return fromScale4(total);
};

export const formatScale4String = (val: string | number | null | undefined): string => {
  return fromScale4(toScale4(val));
};

export const maskEmail = (email: string | null | undefined): string | null => {
  if (!email || !email.includes('@')) return null;
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user.slice(-1)}@${domain}`;
};

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  source: typeof AUTHORITATIVE_SOURCE_TAG;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: Record<string, any>;
  data: T[];
}

export interface AdminOverviewResult {
  source: typeof AUTHORITATIVE_SOURCE_TAG;
  timestamp: number;
  system: {
    status: 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE';
    environment: string;
    database: 'POSTGRESQL';
  };
  cashier: {
    pendingDepositsCount: number;
    pendingDepositsAmount: string;
    pendingWithdrawalsCount: number;
    pendingWithdrawalsAmount: string;
    approvedDepositsAmount: string;
    approvedWithdrawalsAmount: string;
    failedOrRejectedRequestsCount: number;
  };
  wallets: {
    totalWalletsCount: number;
    totalActiveWalletsCount: number;
    totalFrozenWalletsCount: number;
    totalRealBalance: string;
    totalBonusBalance: string;
    totalLockedBalance: string;
    totalCommissionBalance: string;
    totalSystemBalance: string;
  };
  wagering: {
    activeRequirementsCount: number;
    completedRequirementsCount: number;
    expiredRequirementsCount: number;
    blockedWithdrawalPlayersCount: number;
    totalActiveBonusGranted: string;
    totalActiveTargetTurnover: string;
    totalActiveCompletedTurnover: string;
  };
  liabilities: {
    vip: {
      pendingRewardClaimsCount: number;
      pendingRewardClaimsAmount: string;
      totalCashbackClaimed: string;
      tierDistribution: Record<string, number>;
    };
    affiliate: {
      totalUnclaimedCommission: string;
      totalCommissionEarned: string;
      activeAffiliatesCount: number;
      settledCommissionsCount: number;
    };
    promotions: {
      checkInsTodayCount: number;
      wheelSpinsTodayCount: number;
      activeFreeSpinsRemaining: number;
    };
  };
  integrations: {
    gameProviders: Array<{
      id: string;
      name: string;
      isActive: boolean;
      webhookTimeoutMs: number;
      updatedAt: Date | string;
    }>;
    paymentDestinations: {
      totalPoolAccounts: number;
      activePoolAccounts: number;
      poolDailyVolume: string;
    };
  };
  audit: {
    totalLedgerEntriesCount: number;
    latestLedgerEntryTimestamp: string | null;
  };
}

export class AdminOpsService {
  private static dbClient: any = null;

  public static setDbClient(client: any): void {
    AdminOpsService.dbClient = client;
  }

  public static resetDbClient(): void {
    AdminOpsService.dbClient = null;
  }

  private static getDb(): any {
    return AdminOpsService.dbClient || db;
  }

  /**
   * Authoritatively retrieves high-level operational and financial metrics from PostgreSQL only.
   */
  public static async getOverview(): Promise<AdminOverviewResult> {
    try {
      const database = AdminOpsService.getDb();

      // 1. Query Payment Requests Metrics
      const allPaymentRequests = await database
        .select({
          id: paymentRequests.id,
          type: paymentRequests.type,
          status: paymentRequests.status,
          amount: paymentRequests.amount,
        })
        .from(paymentRequests);

      let pendingDepCount = 0;
      let pendingDepMinor = 0n;
      let pendingWdCount = 0;
      let pendingWdMinor = 0n;
      let approvedDepMinor = 0n;
      let approvedWdMinor = 0n;
      let failedOrRejectedCount = 0;

      for (const pr of allPaymentRequests) {
        const amtMinor = toScale4(pr.amount);
        if (pr.type === 'DEPOSIT') {
          if (pr.status === 'PENDING') {
            pendingDepCount++;
            pendingDepMinor += amtMinor;
          } else if (pr.status === 'APPROVED') {
            approvedDepMinor += amtMinor;
          } else if (pr.status === 'REJECTED' || pr.status === 'FAILED') {
            failedOrRejectedCount++;
          }
        } else if (pr.type === 'WITHDRAWAL') {
          if (pr.status === 'PENDING') {
            pendingWdCount++;
            pendingWdMinor += amtMinor;
          } else if (pr.status === 'APPROVED') {
            approvedWdMinor += amtMinor;
          } else if (pr.status === 'REJECTED' || pr.status === 'FAILED') {
            failedOrRejectedCount++;
          }
        }
      }

      // 2. Query Wallets Metrics
      const allWallets = await database
        .select({
          id: wallets.id,
          status: wallets.status,
          realBalance: wallets.realBalance,
          bonusBalance: wallets.bonusBalance,
          lockedBalance: wallets.lockedBalance,
          commissionBalance: wallets.commissionBalance,
        })
        .from(wallets);

      let totalActiveWallets = 0;
      let totalFrozenWallets = 0;
      let totalRealMinor = 0n;
      let totalBonusMinor = 0n;
      let totalLockedMinor = 0n;
      let totalCommissionMinor = 0n;

      for (const w of allWallets) {
        if (w.status === 'ACTIVE') totalActiveWallets++;
        else if (w.status === 'FROZEN') totalFrozenWallets++;

        totalRealMinor += toScale4(w.realBalance);
        totalBonusMinor += toScale4(w.bonusBalance);
        totalLockedMinor += toScale4(w.lockedBalance);
        totalCommissionMinor += toScale4(w.commissionBalance);
      }

      const totalSystemMinor = totalRealMinor + totalBonusMinor + totalLockedMinor + totalCommissionMinor;

      // 3. Query Wagering Requirements Metrics
      const allWagering = await database
        .select({
          id: wageringRequirements.id,
          userId: wageringRequirements.userId,
          status: wageringRequirements.status,
          bonusAmountGranted: wageringRequirements.bonusAmountGranted,
          targetTurnoverAmount: wageringRequirements.targetTurnoverAmount,
          completedTurnoverAmount: wageringRequirements.completedTurnoverAmount,
          isReleased: wageringRequirements.isReleased,
        })
        .from(wageringRequirements);

      let activeWageringCount = 0;
      let completedWageringCount = 0;
      let expiredWageringCount = 0;
      let activeBonusMinor = 0n;
      let activeTargetMinor = 0n;
      let activeCompletedMinor = 0n;
      const blockedUsers = new Set<number>();

      for (const wr of allWagering) {
        if (wr.status === 'ACTIVE' && !wr.isReleased) {
          activeWageringCount++;
          activeBonusMinor += toScale4(wr.bonusAmountGranted);
          activeTargetMinor += toScale4(wr.targetTurnoverAmount);
          activeCompletedMinor += toScale4(wr.completedTurnoverAmount);
          blockedUsers.add(wr.userId);
        } else if (wr.status === 'COMPLETED') {
          completedWageringCount++;
        } else if (wr.status === 'EXPIRED') {
          expiredWageringCount++;
        }
      }

      // 4. Query VIP Liabilities
      const allVipClaims = await database
        .select({
          id: vipRewardClaims.id,
          status: vipRewardClaims.status,
          rewardAmount: vipRewardClaims.rewardAmount,
        })
        .from(vipRewardClaims);

      let pendingVipClaimsCount = 0;
      let pendingVipClaimsMinor = 0n;
      for (const vc of allVipClaims) {
        if (vc.status === 'PENDING') {
          pendingVipClaimsCount++;
          pendingVipClaimsMinor += toScale4(vc.rewardAmount);
        }
      }

      const allVipProgress = await database
        .select({
          currentLevel: userVipProgress.currentLevel,
          totalCashbackClaimed: userVipProgress.totalCashbackClaimed,
        })
        .from(userVipProgress);

      let totalCashbackMinor = 0n;
      const tierDist: Record<string, number> = {};
      for (let i = 1; i <= 10; i++) tierDist[`V${i}`] = 0;

      for (const vp of allVipProgress) {
        totalCashbackMinor += toScale4(vp.totalCashbackClaimed);
        const lvlKey = `V${vp.currentLevel || 1}`;
        tierDist[lvlKey] = (tierDist[lvlKey] || 0) + 1;
      }

      // 5. Query Affiliate Liabilities
      const allAffiliateNodes = await database
        .select({
          unclaimedCommission: affiliateNodes.unclaimedCommission,
          totalCommissionEarned: affiliateNodes.totalCommissionEarned,
          status: affiliateNodes.status,
        })
        .from(affiliateNodes);

      let totalUnclaimedCommissionMinor = 0n;
      let totalCommissionEarnedMinor = 0n;
      let activeAffiliatesCount = 0;

      for (const an of allAffiliateNodes) {
        if (an.status === 'ACTIVE') activeAffiliatesCount++;
        totalUnclaimedCommissionMinor += toScale4(an.unclaimedCommission);
        totalCommissionEarnedMinor += toScale4(an.totalCommissionEarned);
      }

      const [commSettledCount] = await database
        .select({ val: count() })
        .from(affiliateCommissions);

      // 6. Query Promotion Metrics
      const todayUtc = new Date().toISOString().split('T')[0];
      const todayCheckIns = await database
        .select({ id: dailyCheckIns.id })
        .from(dailyCheckIns)
        .where(eq(dailyCheckIns.claimDateUtc, todayUtc));

      const todayWheelSpins = await database
        .select({ id: wheelSpins.id })
        .from(wheelSpins)
        .where(eq(wheelSpins.spinDateUtc, todayUtc));

      const allFreeSpins = await database
        .select({
          remainingQuantity: freeSpinEntitlements.remainingQuantity,
          status: freeSpinEntitlements.status,
        })
        .from(freeSpinEntitlements)
        .where(eq(freeSpinEntitlements.status, 'ACTIVE'));

      let activeFreeSpinsTotal = 0;
      for (const fs of allFreeSpins) {
        activeFreeSpinsTotal += fs.remainingQuantity || 0;
      }

      // 7. Query Game Providers (CRITICAL: Strip secrets like secretKey)
      const rawProviders = await database
        .select({
          id: gameProviders.id,
          name: gameProviders.name,
          isActive: gameProviders.isActive,
          webhookTimeoutMs: gameProviders.webhookTimeoutMs,
          updatedAt: gameProviders.updatedAt,
        })
        .from(gameProviders);

      const sanitizedProviders = rawProviders.map((p) => ({
        id: p.id,
        name: p.name,
        isActive: p.isActive,
        webhookTimeoutMs: p.webhookTimeoutMs,
        updatedAt: p.updatedAt,
      }));

      // 8. Destination Pool Summary (from Payment Gateway Engine)
      const poolAccounts = paymentGatewayEngine.getDestinationPool();
      let poolDailyVolumeMinor = 0n;
      let activePoolAccounts = 0;

      for (const acc of poolAccounts) {
        if (acc.isActive && !acc.isMaintenance) activePoolAccounts++;
        poolDailyVolumeMinor += toScale4(acc.currentDayVolume);
      }

      // 9. Ledger Entries Metadata
      const [ledgerCountRes] = await database
        .select({ val: count() })
        .from(ledgerEntries);

      const [latestLedgerEntry] = await database
        .select({ createdAt: ledgerEntries.createdAt })
        .from(ledgerEntries)
        .orderBy(desc(ledgerEntries.createdAt))
        .limit(1);

      return {
        source: AUTHORITATIVE_SOURCE_TAG,
        timestamp: Date.now(),
        system: {
          status: 'OPERATIONAL',
          environment: process.env.NODE_ENV || 'development',
          database: 'POSTGRESQL',
        },
        cashier: {
          pendingDepositsCount: pendingDepCount,
          pendingDepositsAmount: fromScale4(pendingDepMinor),
          pendingWithdrawalsCount: pendingWdCount,
          pendingWithdrawalsAmount: fromScale4(pendingWdMinor),
          approvedDepositsAmount: fromScale4(approvedDepMinor),
          approvedWithdrawalsAmount: fromScale4(approvedWdMinor),
          failedOrRejectedRequestsCount: failedOrRejectedCount,
        },
        wallets: {
          totalWalletsCount: allWallets.length,
          totalActiveWalletsCount: totalActiveWallets,
          totalFrozenWalletsCount: totalFrozenWallets,
          totalRealBalance: fromScale4(totalRealMinor),
          totalBonusBalance: fromScale4(totalBonusMinor),
          totalLockedBalance: fromScale4(totalLockedMinor),
          totalCommissionBalance: fromScale4(totalCommissionMinor),
          totalSystemBalance: fromScale4(totalSystemMinor),
        },
        wagering: {
          activeRequirementsCount: activeWageringCount,
          completedRequirementsCount: completedWageringCount,
          expiredRequirementsCount: expiredWageringCount,
          blockedWithdrawalPlayersCount: blockedUsers.size,
          totalActiveBonusGranted: fromScale4(activeBonusMinor),
          totalActiveTargetTurnover: fromScale4(activeTargetMinor),
          totalActiveCompletedTurnover: fromScale4(activeCompletedMinor),
        },
        liabilities: {
          vip: {
            pendingRewardClaimsCount: pendingVipClaimsCount,
            pendingRewardClaimsAmount: fromScale4(pendingVipClaimsMinor),
            totalCashbackClaimed: fromScale4(totalCashbackMinor),
            tierDistribution: tierDist,
          },
          affiliate: {
            totalUnclaimedCommission: fromScale4(totalUnclaimedCommissionMinor),
            totalCommissionEarned: fromScale4(totalCommissionEarnedMinor),
            activeAffiliatesCount: activeAffiliatesCount,
            settledCommissionsCount: Number(commSettledCount?.val || 0),
          },
          promotions: {
            checkInsTodayCount: todayCheckIns.length,
            wheelSpinsTodayCount: todayWheelSpins.length,
            activeFreeSpinsRemaining: activeFreeSpinsTotal,
          },
        },
        integrations: {
          gameProviders: sanitizedProviders,
          paymentDestinations: {
            totalPoolAccounts: poolAccounts.length,
            activePoolAccounts,
            poolDailyVolume: fromScale4(poolDailyVolumeMinor),
          },
        },
        audit: {
          totalLedgerEntriesCount: Number(ledgerCountRes?.val || 0),
          latestLedgerEntryTimestamp: latestLedgerEntry?.createdAt ? new Date(latestLedgerEntry.createdAt).toISOString() : null,
        },
      };
    } catch (err: any) {
      console.error('[AdminOpsService.getOverview error]:', err);
      throw new Error(`Authoritative overview query failed: ${err.message || 'PostgreSQL database read error'}`);
    }
  }

  /**
   * Authoritatively retrieves paginated payment requests with summary and filters.
   */
  public static async getPayments(params: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    method?: string;
    currency?: string;
    userId?: number;
    search?: string;
  }): Promise<PaginatedResult<any>> {
    try {
      const database = AdminOpsService.getDb();
      const page = Math.max(1, Number(params.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
      const offset = (page - 1) * limit;

      // Base query for counting and summary
      const allRows = await database
        .select({
          id: paymentRequests.id,
          userId: paymentRequests.userId,
          walletId: paymentRequests.walletId,
          type: paymentRequests.type,
          method: paymentRequests.method,
          amount: paymentRequests.amount,
          currency: paymentRequests.currency,
          senderNumber: paymentRequests.senderNumber,
          receiverNumber: paymentRequests.receiverNumber,
          trxId: paymentRequests.trxId,
          status: paymentRequests.status,
          adminNote: paymentRequests.adminNote,
          createdAt: paymentRequests.createdAt,
          updatedAt: paymentRequests.updatedAt,
          username: users.username,
          userEmail: users.email,
          walletLockedBalance: wallets.lockedBalance,
          walletRealBalance: wallets.realBalance,
        })
        .from(paymentRequests)
        .leftJoin(users, eq(paymentRequests.userId, users.id))
        .leftJoin(wallets, eq(paymentRequests.walletId, wallets.id))
        .orderBy(desc(paymentRequests.createdAt));

      // Apply in-memory filtering for flexible criteria
      let filtered = allRows;

      if (params.type) {
        filtered = filtered.filter((r) => r.type.toUpperCase() === params.type!.toUpperCase());
      }
      if (params.status) {
        filtered = filtered.filter((r) => r.status.toUpperCase() === params.status!.toUpperCase());
      }
      if (params.method) {
        filtered = filtered.filter((r) => r.method.toUpperCase() === params.method!.toUpperCase());
      }
      if (params.currency) {
        filtered = filtered.filter((r) => r.currency.toUpperCase() === params.currency!.toUpperCase());
      }
      if (params.userId) {
        filtered = filtered.filter((r) => r.userId === Number(params.userId));
      }
      if (params.search) {
        const query = params.search.toLowerCase().trim();
        filtered = filtered.filter((r) =>
          (r.trxId && r.trxId.toLowerCase().includes(query)) ||
          (r.senderNumber && r.senderNumber.toLowerCase().includes(query)) ||
          (r.receiverNumber && r.receiverNumber.toLowerCase().includes(query)) ||
          (r.username && r.username.toLowerCase().includes(query)) ||
          (r.userEmail && r.userEmail.toLowerCase().includes(query)) ||
          (r.method && r.method.toLowerCase().includes(query)) ||
          String(r.id).includes(query) ||
          String(r.userId).includes(query)
        );
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const pagedData = filtered.slice(offset, offset + limit);

      // Summary across the filtered set
      let pendingDepositsCount = 0;
      let pendingDepositsMinor = 0n;
      let pendingWithdrawalsCount = 0;
      let pendingWithdrawalsMinor = 0n;
      let approvedTotalMinor = 0n;
      let rejectedCount = 0;

      for (const item of filtered) {
        const amtMinor = toScale4(item.amount);
        if (item.type === 'DEPOSIT' && item.status === 'PENDING') {
          pendingDepositsCount++;
          pendingDepositsMinor += amtMinor;
        } else if (item.type === 'WITHDRAWAL' && item.status === 'PENDING') {
          pendingWithdrawalsCount++;
          pendingWithdrawalsMinor += amtMinor;
        } else if (item.status === 'APPROVED') {
          approvedTotalMinor += amtMinor;
        } else if (item.status === 'REJECTED' || item.status === 'FAILED') {
          rejectedCount++;
        }
      }

      // Format monetary values as exact decimal strings
      const sanitizedData = pagedData.map((item) => {
        const lockedBal = item.walletLockedBalance ? formatScale4String(item.walletLockedBalance) : '0.0000';
        return {
          id: item.id,
          userId: item.userId,
          username: item.username || `User_${item.userId}`,
          userEmail: item.userEmail || null,
          walletId: item.walletId,
          type: item.type,
          method: item.method,
          amount: formatScale4String(item.amount),
          currency: item.currency,
          senderNumber: item.senderNumber,
          receiverNumber: item.receiverNumber,
          senderNumberMasked: item.senderNumber ? (item.senderNumber.length > 6 ? item.senderNumber.slice(0, 3) + '****' + item.senderNumber.slice(-4) : item.senderNumber) : null,
          receiverNumberMasked: item.receiverNumber ? (item.receiverNumber.length > 6 ? item.receiverNumber.slice(0, 3) + '****' + item.receiverNumber.slice(-4) : item.receiverNumber) : null,
          trxId: item.trxId,
          status: item.status,
          adminNote: item.adminNote,
          walletLockedBalance: lockedBal,
          withdrawalLockedAmount: item.type === 'WITHDRAWAL' ? lockedBal : '0.0000',
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });

      return {
        source: AUTHORITATIVE_SOURCE_TAG,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        summary: {
          totalCount: total,
          pendingDepositsCount,
          pendingDepositsAmount: fromScale4(pendingDepositsMinor),
          pendingWithdrawalsCount,
          pendingWithdrawalsAmount: fromScale4(pendingWithdrawalsMinor),
          approvedTotalAmount: fromScale4(approvedTotalMinor),
          rejectedCount,
        },
        data: sanitizedData,
      };
    } catch (err: any) {
      console.error('[AdminOpsService.getPayments error]:', err);
      throw new Error(`Authoritative payments query failed: ${err.message || 'PostgreSQL database read error'}`);
    }
  }

  /**
   * Authoritatively retrieves paginated wallets with user profile details and balances.
   */
  public static async getWallets(params: {
    page?: number;
    limit?: number;
    currency?: string;
    status?: string;
    search?: string;
  }): Promise<PaginatedResult<any>> {
    try {
      const database = AdminOpsService.getDb();
      const page = Math.max(1, Number(params.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
      const offset = (page - 1) * limit;

      const allRows = await database
        .select({
          id: wallets.id,
          userId: wallets.userId,
          currency: wallets.currency,
          balanceMinor: wallets.balanceMinor,
          realBalance: wallets.realBalance,
          bonusBalance: wallets.bonusBalance,
          lockedBalance: wallets.lockedBalance,
          commissionBalance: wallets.commissionBalance,
          status: wallets.status,
          version: wallets.version,
          createdAt: wallets.createdAt,
          updatedAt: wallets.updatedAt,
          username: users.username,
          userEmail: users.email,
          userStatus: users.status,
          userUid: users.uid,
        })
        .from(wallets)
        .leftJoin(users, eq(wallets.userId, users.id))
        .orderBy(desc(wallets.updatedAt));

      let filtered = allRows;

      if (params.currency) {
        filtered = filtered.filter((w) => w.currency.toUpperCase() === params.currency!.toUpperCase());
      }
      if (params.status) {
        filtered = filtered.filter((w) => w.status.toUpperCase() === params.status!.toUpperCase());
      }
      if (params.search) {
        const query = params.search.toLowerCase().trim();
        filtered = filtered.filter((w) =>
          (w.username && w.username.toLowerCase().includes(query)) ||
          (w.userEmail && w.userEmail.toLowerCase().includes(query)) ||
          (w.userUid && w.userUid.toLowerCase().includes(query)) ||
          String(w.userId).includes(query)
        );
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const pagedData = filtered.slice(offset, offset + limit);

      let totalRealMinor = 0n;
      let totalBonusMinor = 0n;
      let totalLockedMinor = 0n;
      let totalCommissionMinor = 0n;

      for (const w of filtered) {
        totalRealMinor += toScale4(w.realBalance);
        totalBonusMinor += toScale4(w.bonusBalance);
        totalLockedMinor += toScale4(w.lockedBalance);
        totalCommissionMinor += toScale4(w.commissionBalance);
      }

      const sanitizedData = pagedData.map((w) => {
        const realMinor = toScale4(w.realBalance);
        const bonusMinor = toScale4(w.bonusBalance);
        const lockedMinor = toScale4(w.lockedBalance);
        const commissionMinor = toScale4(w.commissionBalance);
        const combinedMinor = realMinor + bonusMinor + lockedMinor + commissionMinor;

        return {
          id: w.id,
          userId: w.userId,
          username: w.username || `User_${w.userId}`,
          email: w.userEmail ? maskEmail(w.userEmail) : null,
          emailMasked: w.userEmail ? maskEmail(w.userEmail) : null,
          userStatus: w.userStatus || 'ACTIVE',
          currency: w.currency,
          realBalance: fromScale4(realMinor),
          bonusBalance: fromScale4(bonusMinor),
          lockedBalance: fromScale4(lockedMinor),
          commissionBalance: fromScale4(commissionMinor),
          totalBalance: fromScale4(combinedMinor),
          status: w.status,
          version: Number(w.version || 1),
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        };
      });

      return {
        source: AUTHORITATIVE_SOURCE_TAG,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        summary: {
          totalWallets: total,
          totalRealBalance: fromScale4(totalRealMinor),
          totalBonusBalance: fromScale4(totalBonusMinor),
          totalLockedBalance: fromScale4(totalLockedMinor),
          totalCommissionBalance: fromScale4(totalCommissionMinor),
          totalSystemBalance: fromScale4(totalRealMinor + totalBonusMinor + totalLockedMinor + totalCommissionMinor),
        },
        data: sanitizedData,
      };
    } catch (err: any) {
      console.error('[AdminOpsService.getWallets error]:', err);
      throw new Error(`Authoritative wallets query failed: ${err.message || 'PostgreSQL database read error'}`);
    }
  }

  /**
   * Authoritatively retrieves paginated wagering requirements and gate block status.
   */
  public static async getWagering(params: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: number;
    search?: string;
    released?: string | boolean;
  }): Promise<PaginatedResult<any>> {
    try {
      const database = AdminOpsService.getDb();
      const page = Math.max(1, Number(params.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
      const offset = (page - 1) * limit;

      const allRows = await database
        .select({
          id: wageringRequirements.id,
          userId: wageringRequirements.userId,
          promoName: wageringRequirements.promoName,
          bonusAmountGranted: wageringRequirements.bonusAmountGranted,
          requiredMultiplier: wageringRequirements.requiredMultiplier,
          targetTurnoverAmount: wageringRequirements.targetTurnoverAmount,
          completedTurnoverAmount: wageringRequirements.completedTurnoverAmount,
          status: wageringRequirements.status,
          isReleased: wageringRequirements.isReleased,
          releasedAt: wageringRequirements.releasedAt,
          releaseTransactionId: wageringRequirements.releaseTransactionId,
          expiresAt: wageringRequirements.expiresAt,
          createdAt: wageringRequirements.createdAt,
          completedAt: wageringRequirements.completedAt,
          username: users.username,
          userEmail: users.email,
        })
        .from(wageringRequirements)
        .leftJoin(users, eq(wageringRequirements.userId, users.id))
        .orderBy(desc(wageringRequirements.createdAt));

      let filtered = allRows;

      if (params.status) {
        filtered = filtered.filter((r) => r.status.toUpperCase() === params.status!.toUpperCase());
      }
      if (params.userId) {
        filtered = filtered.filter((r) => r.userId === Number(params.userId));
      }
      if (params.released !== undefined && params.released !== '') {
        const isRel = String(params.released).toLowerCase() === 'true' || String(params.released).toUpperCase() === 'RELEASED';
        filtered = filtered.filter((r) => Boolean(r.isReleased) === isRel);
      }
      if (params.search) {
        const query = params.search.toLowerCase().trim();
        filtered = filtered.filter((r) =>
          (r.promoName && r.promoName.toLowerCase().includes(query)) ||
          (r.username && r.username.toLowerCase().includes(query)) ||
          (r.userEmail && r.userEmail.toLowerCase().includes(query)) ||
          String(r.userId).includes(query)
        );
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const pagedData = filtered.slice(offset, offset + limit);

      let activeCount = 0;
      let completedCount = 0;
      let expiredCount = 0;
      let totalBonusGrantedMinor = 0n;
      let totalTargetTurnoverMinor = 0n;
      let totalCompletedTurnoverMinor = 0n;
      let totalRemainingTurnoverMinor = 0n;
      const activeUserIds = new Set<number>();

      for (const r of filtered) {
        const targetMinor = toScale4(r.targetTurnoverAmount);
        const completedMinor = toScale4(r.completedTurnoverAmount);
        const remainingMinor = targetMinor > completedMinor ? targetMinor - completedMinor : 0n;
        totalRemainingTurnoverMinor += remainingMinor;

        if (r.status === 'ACTIVE' && !r.isReleased) {
          activeCount++;
          activeUserIds.add(r.userId);
        } else if (r.status === 'COMPLETED') {
          completedCount++;
        } else if (r.status === 'EXPIRED') {
          expiredCount++;
        }

        totalBonusGrantedMinor += toScale4(r.bonusAmountGranted);
        totalTargetTurnoverMinor += targetMinor;
        totalCompletedTurnoverMinor += completedMinor;
      }

      const sanitizedData = pagedData.map((r) => {
        const targetMinor = toScale4(r.targetTurnoverAmount);
        const completedMinor = toScale4(r.completedTurnoverAmount);
        const remainingMinor = targetMinor > completedMinor ? targetMinor - completedMinor : 0n;
        const progressPercent = targetMinor > 0n
          ? Number((completedMinor * 10000n) / targetMinor) / 100
          : 100;

        return {
          id: r.id,
          userId: r.userId,
          username: r.username || `User_${r.userId}`,
          userEmail: r.userEmail ? maskEmail(r.userEmail) : null,
          emailMasked: r.userEmail ? maskEmail(r.userEmail) : null,
          promoName: r.promoName,
          bonusAmountGranted: formatScale4String(r.bonusAmountGranted),
          requiredMultiplier: r.requiredMultiplier,
          targetTurnoverAmount: formatScale4String(r.targetTurnoverAmount),
          completedTurnoverAmount: formatScale4String(r.completedTurnoverAmount),
          remainingTurnoverAmount: fromScale4(remainingMinor),
          progressPercent: Math.min(100, progressPercent),
          status: r.status,
          isReleased: Boolean(r.isReleased),
          isWithdrawalBlocked: r.status === 'ACTIVE' && !r.isReleased,
          releasedAt: r.releasedAt,
          releaseTransactionId: r.releaseTransactionId,
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
          completedAt: r.completedAt,
        };
      });

      return {
        source: AUTHORITATIVE_SOURCE_TAG,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        summary: {
          totalRequirements: total,
          activeCount,
          completedCount,
          expiredCount,
          blockedPlayersCount: activeUserIds.size,
          totalBonusGranted: fromScale4(totalBonusGrantedMinor),
          totalTargetTurnover: fromScale4(totalTargetTurnoverMinor),
          totalCompletedTurnover: fromScale4(totalCompletedTurnoverMinor),
          totalRemainingTurnover: fromScale4(totalRemainingTurnoverMinor),
        },
        data: sanitizedData,
      };
    } catch (err: any) {
      console.error('[AdminOpsService.getWagering error]:', err);
      throw new Error(`Authoritative wagering query failed: ${err.message || 'PostgreSQL database read error'}`);
    }
  }

  /**
   * Authoritatively retrieves paginated immutable ledger audit entries.
   * Strips any sensitive credentials or secrets from audit metadata.
   */
  public static async getAudit(params: {
    page?: number;
    limit?: number;
    type?: string;
    balanceTarget?: string;
    userId?: number;
    walletId?: number;
    transactionId?: string;
    status?: string;
  }): Promise<PaginatedResult<any>> {
    try {
      const database = AdminOpsService.getDb();
      const page = Math.max(1, Number(params.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
      const offset = (page - 1) * limit;

      const allRows = await database
        .select({
          id: ledgerEntries.id,
          walletId: ledgerEntries.walletId,
          userId: ledgerEntries.userId,
          transactionId: ledgerEntries.transactionId,
          referenceTransactionId: ledgerEntries.referenceTransactionId,
          type: ledgerEntries.type,
          balanceTarget: ledgerEntries.balanceTarget,
          amountMinor: ledgerEntries.amountMinor,
          currency: ledgerEntries.currency,
          beforeBalanceMinor: ledgerEntries.beforeBalanceMinor,
          afterBalanceMinor: ledgerEntries.afterBalanceMinor,
          status: ledgerEntries.status,
          correlationId: ledgerEntries.correlationId,
          auditMetadata: ledgerEntries.auditMetadata,
          createdAt: ledgerEntries.createdAt,
          username: users.username,
          userEmail: users.email,
        })
        .from(ledgerEntries)
        .leftJoin(users, eq(ledgerEntries.userId, users.id))
        .orderBy(desc(ledgerEntries.createdAt));

      let filtered = allRows;

      if (params.type) {
        filtered = filtered.filter((r) => r.type.toUpperCase() === params.type!.toUpperCase());
      }
      if (params.balanceTarget) {
        filtered = filtered.filter((r) => r.balanceTarget.toUpperCase() === params.balanceTarget!.toUpperCase());
      }
      if (params.status) {
        filtered = filtered.filter((r) => r.status.toUpperCase() === params.status!.toUpperCase());
      }
      if (params.userId) {
        filtered = filtered.filter((r) => r.userId === Number(params.userId));
      }
      if (params.walletId) {
        filtered = filtered.filter((r) => r.walletId === Number(params.walletId));
      }
      if (params.transactionId) {
        const txQuery = params.transactionId.toLowerCase().trim();
        filtered = filtered.filter((r) =>
          r.transactionId.toLowerCase().includes(txQuery) ||
          (r.referenceTransactionId && r.referenceTransactionId.toLowerCase().includes(txQuery))
        );
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const pagedData = filtered.slice(offset, offset + limit);

      let totalDebitMinor = 0n;
      let totalCreditMinor = 0n;

      for (const r of filtered) {
        const amt = typeof r.amountMinor === 'bigint' ? r.amountMinor : BigInt(r.amountMinor || 0);
        if (r.type === 'DEBIT') {
          totalDebitMinor += amt;
        } else if (r.type === 'CREDIT') {
          totalCreditMinor += amt;
        }
      }

      const sanitizedData = pagedData.map((r) => {
        const amtMinor = typeof r.amountMinor === 'bigint' ? r.amountMinor : BigInt(r.amountMinor || 0);
        const beforeMinor = typeof r.beforeBalanceMinor === 'bigint' ? r.beforeBalanceMinor : BigInt(r.beforeBalanceMinor || 0);
        const afterMinor = typeof r.afterBalanceMinor === 'bigint' ? r.afterBalanceMinor : BigInt(r.afterBalanceMinor || 0);

        // Sanitize metadata: redact any potential credentials
        const rawMeta = (r.auditMetadata || {}) as Record<string, any>;
        const safeMeta: Record<string, any> = {};
        for (const [k, v] of Object.entries(rawMeta)) {
          const lowerKey = k.toLowerCase();
          if (lowerKey.includes('secret') || lowerKey.includes('key') || lowerKey.includes('token') || lowerKey.includes('auth') || lowerKey.includes('pass')) {
            safeMeta[k] = '[REDACTED]';
          } else {
            safeMeta[k] = v;
          }
        }

        return {
          id: r.id,
          walletId: r.walletId,
          userId: r.userId,
          username: r.username || `User_${r.userId}`,
          userEmail: r.userEmail || null,
          transactionId: r.transactionId,
          referenceTransactionId: r.referenceTransactionId,
          type: r.type,
          balanceTarget: r.balanceTarget,
          amountMinor: amtMinor.toString(),
          amount: fromScale4(amtMinor),
          currency: r.currency,
          beforeBalance: fromScale4(beforeMinor),
          afterBalance: fromScale4(afterMinor),
          status: r.status,
          correlationId: r.correlationId,
          auditMetadata: safeMeta,
          createdAt: r.createdAt,
        };
      });

      return {
        source: AUTHORITATIVE_SOURCE_TAG,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        summary: {
          totalEntries: total,
          totalDebitAmount: fromScale4(totalDebitMinor),
          totalCreditAmount: fromScale4(totalCreditMinor),
        },
        data: sanitizedData,
      };
    } catch (err: any) {
      console.error('[AdminOpsService.getAudit error]:', err);
      throw new Error(`Authoritative audit query failed: ${err.message || 'PostgreSQL database read error'}`);
    }
  }
}
