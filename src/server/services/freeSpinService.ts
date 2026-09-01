/**
 * @file freeSpinService.ts
 * @description Authoritative PostgreSQL Free Spin Entitlement Service for PLAY369 Task 3.4.
 * 
 * Guarantees:
 * 1. Strict ACID creation of Free Spin entitlements for non-monetary Lucky Wheel rewards.
 * 2. Uniqueness & idempotency on deterministic source reference (e.g. WHEEL_FS_<userId>_<spinDateUtc>).
 * 3. Atomic fail-closed semantics: If entitlement creation fails, the wheel spin is not marked claimed.
 * 4. Free spins are tracked independently as non-monetary gaming credits and NEVER mixed with Real/Bonus wallets.
 */

import { eq, and, sql, gte, gt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { freeSpinEntitlements } from '../../db/schema.js';

export interface FreeSpinEntitlementRecord {
  id: number;
  userId: number;
  source: string;
  sourceReference: string;
  quantity: number;
  remainingQuantity: number;
  status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
  spinDateUtc: string;
  expiresAt: Date | null;
  grantedAt: Date;
  createdAt: Date;
}

export interface GrantWheelFreeSpinsParams {
  userId: number;
  spinDateUtc: string;
  quantity: number;
  spinTimestamp?: Date;
  expiryDays?: number;
  tx?: any;
}

export class FreeSpinService {
  /**
   * Deterministic entitlement reference string for lucky wheel rewards.
   */
  public static getWheelReference(userId: number, spinDateUtc: string): string {
    return `WHEEL_FS_${userId}_${spinDateUtc}`;
  }

  /**
   * Grants a Free Spin entitlement atomically within a transaction.
   * If a transaction is provided, executes inside it; otherwise uses root db.
   */
  public static async grantWheelEntitlement(
    params: GrantWheelFreeSpinsParams
  ): Promise<FreeSpinEntitlementRecord> {
    const {
      userId,
      spinDateUtc,
      quantity,
      spinTimestamp = new Date(),
      expiryDays = 7,
      tx
    } = params;

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid free spin quantity: ${quantity}. Quantity must be a positive integer.`);
    }

    const sourceReference = this.getWheelReference(userId, spinDateUtc);
    const expiresAt = expiryDays > 0
      ? new Date(spinTimestamp.getTime() + expiryDays * 24 * 60 * 60 * 1000)
      : null;

    const executor = tx || db;

    const [record] = await executor
      .insert(freeSpinEntitlements)
      .values({
        userId,
        source: 'LUCKY_WHEEL',
        sourceReference,
        quantity,
        remainingQuantity: quantity,
        status: 'ACTIVE',
        spinDateUtc,
        expiresAt,
        grantedAt: spinTimestamp,
        createdAt: spinTimestamp
      })
      .returning();

    if (!record) {
      throw new Error(`Failed to create free spin entitlement for user ${userId} on ${spinDateUtc}`);
    }

    return record as FreeSpinEntitlementRecord;
  }

  /**
   * Retrieves active, non-expired free spins for a given user.
   */
  public static async getUserActiveEntitlements(userId: number): Promise<FreeSpinEntitlementRecord[]> {
    const now = new Date();
    const rows = await db
      .select()
      .from(freeSpinEntitlements)
      .where(
        and(
          eq(freeSpinEntitlements.userId, userId),
          eq(freeSpinEntitlements.status, 'ACTIVE'),
          gt(freeSpinEntitlements.remainingQuantity, 0)
        )
      );

    // Filter out expired entitlements
    return rows.filter((r) => !r.expiresAt || new Date(r.expiresAt) > now) as FreeSpinEntitlementRecord[];
  }

  /**
   * Returns the total active free spins count for a user.
   */
  public static async getTotalActiveFreeSpins(userId: number): Promise<number> {
    const active = await this.getUserActiveEntitlements(userId);
    return active.reduce((sum, item) => sum + (item.remainingQuantity || 0), 0);
  }
}
