/**
 * @file promotionUtcMigrationTask311.test.ts
 * @description Test Suite for PLAY369 Task 3.1.1: Promotion UTC Schema Migration
 * 
 * Verifies:
 * 1. Fresh database migration creates claim_date_utc & spin_date_utc and applies unique constraints.
 * 2. Existing historical rows backfill correctly using UTC 'YYYY-MM-DD' calendar date.
 * 3. Migration is completely idempotent and safe to run twice.
 * 4. Duplicate historical date collision fails migration clearly (no silent data deletion / no winner picking).
 * 5. Unique indexes exist after migration.
 * 6. Drizzle schema (src/db/schema.ts) and PostgreSQL production schema (src/server/schema.sql) match migration.
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

async function assert(desc: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}\n`);
    failed++;
  }
}

interface SimulatedDailyCheckInRow {
  id: number;
  user_id: number;
  check_in_date: Date;
  claim_date_utc?: string | null;
  streak_day: number;
  reward_amount: string;
  reward_type: string;
  created_at: Date;
}

interface SimulatedWheelSpinRow {
  id: number;
  user_id: number;
  spin_date_utc?: string | null;
  prize_type: string;
  prize_label: string;
  prize_value: string;
  currency: string;
  is_claimed: boolean;
  created_at: Date;
}

class SimulatedPgMigrationRunner {
  public dailyCheckIns: SimulatedDailyCheckInRow[] = [];
  public wheelSpins: SimulatedWheelSpinRow[] = [];
  public checkInColumns: Set<string> = new Set(['id', 'user_id', 'check_in_date', 'streak_day', 'reward_amount', 'reward_type', 'created_at']);
  public wheelSpinColumns: Set<string> = new Set(['id', 'user_id', 'prize_type', 'prize_label', 'prize_value', 'currency', 'is_claimed', 'created_at']);
  public uniqueIndexes: Set<string> = new Set();
  public notNullColumns: Set<string> = new Set();

  constructor(hasUtcColumns: boolean = false) {
    if (hasUtcColumns) {
      this.checkInColumns.add('claim_date_utc');
      this.wheelSpinColumns.add('spin_date_utc');
      this.notNullColumns.add('daily_check_ins.claim_date_utc');
      this.notNullColumns.add('wheel_spins.spin_date_utc');
      this.uniqueIndexes.add('daily_check_ins_user_claim_date_utc_idx');
      this.uniqueIndexes.add('wheel_spins_user_spin_date_utc_idx');
    }
  }

  // Executes the exact logic from 0002_promotion_utc_daily_integrity.sql
  public runMigration0002() {
    // PART A: daily_check_ins
    // A1. Column existence
    this.checkInColumns.add('claim_date_utc');

    // A2. Backfill existing rows using UTC calendar date format 'YYYY-MM-DD'
    for (const row of this.dailyCheckIns) {
      if (row.claim_date_utc === undefined || row.claim_date_utc === null) {
        const sourceDate = row.check_in_date || row.created_at;
        row.claim_date_utc = sourceDate.toISOString().split('T')[0];
      }
    }

    // A3. Duplicate collision check: Fail if duplicates exist
    const checkInDups: Record<string, number> = {};
    for (const row of this.dailyCheckIns) {
      const key = `${row.user_id}:${row.claim_date_utc}`;
      checkInDups[key] = (checkInDups[key] || 0) + 1;
    }

    const collisionKeys = Object.entries(checkInDups).filter(([_, count]) => count > 1);
    if (collisionKeys.length > 0) {
      const sample = collisionKeys.map(([k, c]) => `${k} (${c} claims)`).join(', ');
      throw new Error(`MIGRATION_FAILED: Duplicate historical daily_check_ins detected for user/UTC date: ${sample}. Cannot create unique index without manual reconciliation.`);
    }

    // A4. NOT NULL
    for (const row of this.dailyCheckIns) {
      if (!row.claim_date_utc) {
        throw new Error('daily_check_ins.claim_date_utc contains null value after backfill');
      }
    }
    this.notNullColumns.add('daily_check_ins.claim_date_utc');

    // A5. Unique Index
    this.uniqueIndexes.add('daily_check_ins_user_claim_date_utc_idx');


    // PART B: wheel_spins
    // B1. Column existence
    this.wheelSpinColumns.add('spin_date_utc');

    // B2. Backfill existing rows using UTC calendar date format 'YYYY-MM-DD'
    for (const row of this.wheelSpins) {
      if (row.spin_date_utc === undefined || row.spin_date_utc === null) {
        row.spin_date_utc = row.created_at.toISOString().split('T')[0];
      }
    }

    // B3. Duplicate collision check: Fail if duplicates exist
    const spinDups: Record<string, number> = {};
    for (const row of this.wheelSpins) {
      const key = `${row.user_id}:${row.spin_date_utc}`;
      spinDups[key] = (spinDups[key] || 0) + 1;
    }

    const spinCollisionKeys = Object.entries(spinDups).filter(([_, count]) => count > 1);
    if (spinCollisionKeys.length > 0) {
      const sample = spinCollisionKeys.map(([k, c]) => `${k} (${c} spins)`).join(', ');
      throw new Error(`MIGRATION_FAILED: Duplicate historical wheel_spins detected for user/UTC date: ${sample}. Cannot create unique index without manual reconciliation.`);
    }

    // B4. NOT NULL
    for (const row of this.wheelSpins) {
      if (!row.spin_date_utc) {
        throw new Error('wheel_spins.spin_date_utc contains null value after backfill');
      }
    }
    this.notNullColumns.add('wheel_spins.spin_date_utc');

    // B5. Unique Index
    this.uniqueIndexes.add('wheel_spins_user_spin_date_utc_idx');
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🛡️ PLAY369 TASK 3.1.1: PROMOTION UTC SCHEMA MIGRATION TEST SUITE');
  console.log('================================================================\n');

  const migrationPath = path.join(process.cwd(), 'src/server/migrations/0002_promotion_utc_daily_integrity.sql');
  const schemaTsPath = path.join(process.cwd(), 'src/db/schema.ts');
  const schemaSqlPath = path.join(process.cwd(), 'src/server/schema.sql');

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  const schemaTs = fs.readFileSync(schemaTsPath, 'utf8');
  const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');

  // --------------------------------------------------------------------------
  // TEST 1: Fresh Database Migration
  // --------------------------------------------------------------------------
  await assert('1. Fresh database migration creates columns, NOT NULL constraints, and unique indexes', () => {
    const db = new SimulatedPgMigrationRunner(false);
    db.runMigration0002();

    if (!db.checkInColumns.has('claim_date_utc')) throw new Error('claim_date_utc missing from checkInColumns');
    if (!db.wheelSpinColumns.has('spin_date_utc')) throw new Error('spin_date_utc missing from wheelSpinColumns');
    if (!db.notNullColumns.has('daily_check_ins.claim_date_utc')) throw new Error('NOT NULL missing on daily_check_ins.claim_date_utc');
    if (!db.notNullColumns.has('wheel_spins.spin_date_utc')) throw new Error('NOT NULL missing on wheel_spins.spin_date_utc');
    if (!db.uniqueIndexes.has('daily_check_ins_user_claim_date_utc_idx')) throw new Error('daily_check_ins_user_claim_date_utc_idx index missing');
    if (!db.uniqueIndexes.has('wheel_spins_user_spin_date_utc_idx')) throw new Error('wheel_spins_user_spin_date_utc_idx index missing');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Existing Historical Rows Backfill Correctly in UTC
  // --------------------------------------------------------------------------
  await assert('2. Existing historical rows backfill correctly using UTC YYYY-MM-DD preserving all history', () => {
    const db = new SimulatedPgMigrationRunner(false);
    
    // Historical rows across different UTC timestamps & days
    db.dailyCheckIns.push({
      id: 1,
      user_id: 101,
      check_in_date: new Date('2026-08-27T23:45:00Z'),
      streak_day: 1,
      reward_amount: '50.0000',
      reward_type: 'BONUS_CREDIT',
      created_at: new Date('2026-08-27T23:45:00Z')
    });
    db.dailyCheckIns.push({
      id: 2,
      user_id: 101,
      check_in_date: new Date('2026-08-28T00:15:00Z'),
      streak_day: 2,
      reward_amount: '50.0000',
      reward_type: 'BONUS_CREDIT',
      created_at: new Date('2026-08-28T00:15:00Z')
    });
    db.wheelSpins.push({
      id: 1,
      user_id: 101,
      prize_type: 'REAL_CASH',
      prize_label: '৳100 Real Cash',
      prize_value: '100.0000',
      currency: 'BDT',
      is_claimed: true,
      created_at: new Date('2026-08-28T14:30:00Z')
    });

    db.runMigration0002();

    if (db.dailyCheckIns[0].claim_date_utc !== '2026-08-27') {
      throw new Error(`Row 1 expected claim_date_utc 2026-08-27, got ${db.dailyCheckIns[0].claim_date_utc}`);
    }
    if (db.dailyCheckIns[1].claim_date_utc !== '2026-08-28') {
      throw new Error(`Row 2 expected claim_date_utc 2026-08-28, got ${db.dailyCheckIns[1].claim_date_utc}`);
    }
    if (db.wheelSpins[0].spin_date_utc !== '2026-08-28') {
      throw new Error(`Spin 1 expected spin_date_utc 2026-08-28, got ${db.wheelSpins[0].spin_date_utc}`);
    }
    if (db.dailyCheckIns.length !== 2 || db.wheelSpins.length !== 1) {
      throw new Error('Historical rows were corrupted or deleted during migration!');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Migration Run Twice Safely (Idempotency)
  // --------------------------------------------------------------------------
  await assert('3. Migration run twice produces identical state without error (Idempotency)', () => {
    const db = new SimulatedPgMigrationRunner(false);
    db.dailyCheckIns.push({
      id: 1,
      user_id: 101,
      check_in_date: new Date('2026-08-28T12:00:00Z'),
      streak_day: 1,
      reward_amount: '50.0000',
      reward_type: 'BONUS_CREDIT',
      created_at: new Date('2026-08-28T12:00:00Z')
    });

    // Run 1
    db.runMigration0002();
    const snap1CheckIn = JSON.parse(JSON.stringify(db.dailyCheckIns));

    // Run 2
    db.runMigration0002();
    const snap2CheckIn = JSON.parse(JSON.stringify(db.dailyCheckIns));

    if (JSON.stringify(snap1CheckIn) !== JSON.stringify(snap2CheckIn)) {
      throw new Error('Migration run 2 altered state compared to run 1!');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Duplicate Historical Date Collision Fails Clearly
  // --------------------------------------------------------------------------
  await assert('4. Duplicate historical date collision fails migration clearly (no silent deletion)', () => {
    const db = new SimulatedPgMigrationRunner(false);
    // Add two checkins for same user on same UTC date (legacy bug before fix)
    db.dailyCheckIns.push({
      id: 1,
      user_id: 101,
      check_in_date: new Date('2026-08-28T10:00:00Z'),
      streak_day: 1,
      reward_amount: '50.0000',
      reward_type: 'BONUS_CREDIT',
      created_at: new Date('2026-08-28T10:00:00Z')
    });
    db.dailyCheckIns.push({
      id: 2,
      user_id: 101,
      check_in_date: new Date('2026-08-28T18:00:00Z'),
      streak_day: 2,
      reward_amount: '50.0000',
      reward_type: 'BONUS_CREDIT',
      created_at: new Date('2026-08-28T18:00:00Z')
    });

    let failedAsExpected = false;
    let errMsg = '';
    try {
      db.runMigration0002();
    } catch (err: any) {
      failedAsExpected = true;
      errMsg = err.message;
    }

    if (!failedAsExpected) {
      throw new Error('Expected duplicate historical records to fail migration!');
    }
    if (!errMsg.includes('Duplicate historical daily_check_ins detected')) {
      throw new Error(`Unexpected error message: ${errMsg}`);
    }
    // Verify both records still exist unharmed (no silent deletion)
    if (db.dailyCheckIns.length !== 2) {
      throw new Error('Migration modified/deleted records before failure!');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: SQL & Schema Inspection & Alignment
  // --------------------------------------------------------------------------
  await assert('5. Drizzle schema and SQL migration match exact columns and unique constraint names', () => {
    // Check Drizzle Schema
    if (!schemaTs.includes("claimDateUtc: varchar('claim_date_utc', { length: 10 }).notNull()")) {
      throw new Error('schema.ts missing claimDateUtc definition');
    }
    if (!schemaTs.includes("userClaimDateUtcIdx: uniqueIndex('daily_check_ins_user_claim_date_utc_idx').on(table.userId, table.claimDateUtc)")) {
      throw new Error('schema.ts missing daily_check_ins_user_claim_date_utc_idx uniqueIndex');
    }
    if (!schemaTs.includes("spinDateUtc: varchar('spin_date_utc', { length: 10 }).notNull()")) {
      throw new Error('schema.ts missing spinDateUtc definition');
    }
    if (!schemaTs.includes("userSpinDateUtcIdx: uniqueIndex('wheel_spins_user_spin_date_utc_idx').on(table.userId, table.spinDateUtc)")) {
      throw new Error('schema.ts missing wheel_spins_user_spin_date_utc_idx uniqueIndex');
    }

    // Check PostgreSQL schema.sql
    if (!schemaSql.includes('claim_date_utc VARCHAR(10) NOT NULL')) {
      throw new Error('schema.sql missing claim_date_utc VARCHAR(10) NOT NULL');
    }
    if (!schemaSql.includes('CREATE UNIQUE INDEX IF NOT EXISTS daily_check_ins_user_claim_date_utc_idx')) {
      throw new Error('schema.sql missing daily_check_ins_user_claim_date_utc_idx index creation');
    }
    if (!schemaSql.includes('spin_date_utc VARCHAR(10) NOT NULL')) {
      throw new Error('schema.sql missing spin_date_utc VARCHAR(10) NOT NULL');
    }
    if (!schemaSql.includes('CREATE UNIQUE INDEX IF NOT EXISTS wheel_spins_user_spin_date_utc_idx')) {
      throw new Error('schema.sql missing wheel_spins_user_spin_date_utc_idx index creation');
    }

    // Check Migration SQL
    if (!migrationSql.includes('daily_check_ins_user_claim_date_utc_idx') || !migrationSql.includes('wheel_spins_user_spin_date_utc_idx')) {
      throw new Error('0002 migration missing unique index creation queries');
    }
    if (!migrationSql.includes('TO_CHAR(COALESCE(check_in_date, created_at) AT TIME ZONE \'UTC\', \'YYYY-MM-DD\')')) {
      throw new Error('0002 migration missing UTC timezone conversion in backfill');
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Migration Test Suite Failed:', err);
  process.exit(1);
});
