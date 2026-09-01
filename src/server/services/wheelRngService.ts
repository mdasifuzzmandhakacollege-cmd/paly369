/**
 * @file wheelRngService.ts
 * @description Cryptographically Secure Weighted Random Number Generator (CSPRNG) for Lucky Fortune Wheel.
 * 
 * PLAY369 Task 3.3 Wheel RNG Integrity:
 * - Uses Node.js crypto.randomInt (CSPRNG backed by OS entropy pool).
 * - Preserves exact configured weights and probabilities for WHEEL_PRIZES.
 * - Enforces boundary condition guarantees (lowest integer 0 -> first prize, highest integer totalWeight-1 -> last prize).
 * - Validates prize array integrity (non-empty, non-negative integer weights, totalWeight > 0).
 * - Generates comprehensive audit metadata for every spin without exposing raw entropy or secrets.
 * - Server-authoritative: client cannot determine or override the outcome.
 */

import crypto from 'crypto';
import { WheelPrize, WHEEL_PRIZES } from '../../shared/gameplayConfig.js';

export const WHEEL_RNG_ALGORITHM = 'CSPRNG_WEIGHTED_V1';

export interface WheelRngSelectionResult {
  prize: WheelPrize;
  prizeId: number;
  prizeType: string;
  prizeLabel: string;
  prizeValue: number;
  prizeWeight: number;
  totalWeight: number;
  algorithm: string;
}

export interface WheelSpinAuditMetadata {
  providerId: string;
  promoType: 'LUCKY_WHEEL';
  category: 'REAL_CASH' | 'BONUS_CASH' | 'NON_MONETARY';
  rewardType: string;
  prizeId: number;
  prizeLabel: string;
  prizeValue: string;
  prizeWeight: number;
  totalWeight: number;
  rngAlgorithm: string;
  spinDateUtc: string;
  isWithdrawable: boolean;
}

/**
 * Custom RNG type for deterministic unit tests and boundary assertions.
 */
export type CustomRngFunction = (max: number) => number;

export class WheelRngService {
  /**
   * Cryptographically secure weighted selection using Node.js crypto.randomInt.
   * 
   * Given prizes with weights [w_0, w_1, ..., w_{n-1}] and totalWeight = SUM(w_i):
   * 1. Draws uniform integer R in [0, totalWeight - 1] via crypto.randomInt(0, totalWeight).
   * 2. Iteratively sums weights until R < cumulativeWeight.
   * 3. Selects the corresponding prize deterministically and uniformly.
   * 
   * @param prizes Configured wheel prize array (defaults to WHEEL_PRIZES)
   * @param customRng Optional custom RNG function for boundary testing (must return integer in [0, max-1])
   * @returns Selected prize along with audit verification attributes
   */
  public static selectPrize(
    prizes: WheelPrize[] = WHEEL_PRIZES,
    customRng?: CustomRngFunction
  ): WheelRngSelectionResult {
    if (!prizes || !Array.isArray(prizes) || prizes.length === 0) {
      throw new Error('Invalid wheel prize configuration: prizes list cannot be empty');
    }

    let totalWeight = 0;
    for (const prize of prizes) {
      if (
        typeof prize.weight !== 'number' ||
        isNaN(prize.weight) ||
        prize.weight < 0 ||
        !Number.isInteger(prize.weight)
      ) {
        throw new Error(
          `Invalid prize weight for prize '${prize.label}' (id: ${prize.id}): weight must be a non-negative integer, got ${prize.weight}`
        );
      }
      totalWeight += prize.weight;
    }

    if (totalWeight <= 0) {
      throw new Error('Invalid wheel prize configuration: total weight must be strictly greater than 0');
    }

    // Draw cryptographically secure uniform random integer in range [0, totalWeight - 1]
    const randomInt = customRng
      ? customRng(totalWeight)
      : crypto.randomInt(0, totalWeight);

    if (
      typeof randomInt !== 'number' ||
      !Number.isInteger(randomInt) ||
      randomInt < 0 ||
      randomInt >= totalWeight
    ) {
      throw new Error(
        `RNG value ${randomInt} is out of bounds [0, ${totalWeight - 1}]`
      );
    }

    let cumulativeWeight = 0;
    for (const prize of prizes) {
      cumulativeWeight += prize.weight;
      if (randomInt < cumulativeWeight) {
        return {
          prize,
          prizeId: prize.id,
          prizeType: prize.type,
          prizeLabel: prize.label,
          prizeValue: prize.value,
          prizeWeight: prize.weight,
          totalWeight,
          algorithm: WHEEL_RNG_ALGORITHM
        };
      }
    }

    // Safety fallback to last prize with weight > 0
    const fallbackPrize =
      [...prizes].reverse().find((p) => p.weight > 0) || prizes[prizes.length - 1];

    return {
      prize: fallbackPrize,
      prizeId: fallbackPrize.id,
      prizeType: fallbackPrize.type,
      prizeLabel: fallbackPrize.label,
      prizeValue: fallbackPrize.value,
      prizeWeight: fallbackPrize.weight,
      totalWeight,
      algorithm: WHEEL_RNG_ALGORITHM
    };
  }

  /**
   * Generates sanitized audit metadata for spin persistence in DB and ledger entries.
   * Does NOT include raw entropy, seeds, or sensitive keys.
   */
  public static createAuditMetadata(
    selection: WheelRngSelectionResult,
    prizeValueStr: string,
    spinDateUtc: string
  ): WheelSpinAuditMetadata {
    const isReal = selection.prizeType === 'REAL_CASH';
    const isBonus = selection.prizeType === 'BONUS_CASH';
    const category = isReal ? 'REAL_CASH' : isBonus ? 'BONUS_CASH' : 'NON_MONETARY';

    return {
      providerId: 'GAMEPLAY365_PROMOTIONS',
      promoType: 'LUCKY_WHEEL',
      category,
      rewardType: selection.prizeType,
      prizeId: selection.prizeId,
      prizeLabel: selection.prizeLabel,
      prizeValue: prizeValueStr,
      prizeWeight: selection.prizeWeight,
      totalWeight: selection.totalWeight,
      rngAlgorithm: selection.algorithm,
      spinDateUtc,
      isWithdrawable: isReal
    };
  }

  /**
   * Calculates total weight of configured prizes.
   */
  public static getTotalWeight(prizes: WheelPrize[] = WHEEL_PRIZES): number {
    return prizes.reduce((acc, p) => acc + p.weight, 0);
  }
}
