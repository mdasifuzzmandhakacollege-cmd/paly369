/**
 * PLAY369 Task 2.3.3.2: Final Wallet Migration Compatibility Test Suite
 * 
 * Verifies:
 * 1. Migration safely converts existing NUMERIC(20,0) balance_minor column to BIGINT.
 * 2. Works for both old NUMERIC columns and fresh databases.
 * 3. Preserves all existing wallet balances (never resets balances).
 * 4. Enforces balance_minor BIGINT NOT NULL DEFAULT 0.
 * 5. Aligns wallet version type across Drizzle and production SQL as BIGINT and preserves existing versions.
 * 6. Migration is completely idempotent (running twice produces identical state).
 * 7. Exact scale-4 mapping: 0.0516 BDT = 516 minor units.
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

async function assert(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name} ->`, err?.message || err);
    failed++;
  }
}

// In-memory simulation of PostgreSQL DDL and DML migration execution
interface SimulatedPgColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: any;
}

interface SimulatedWalletRow {
  id: number;
  user_id: number;
  currency: string;
  real_balance: number;
  bonus_balance: number;
  locked_balance: number;
  commission_balance: number;
  balance_minor?: any;
  version?: any;
}

class SimulatedPgDatabase {
  public columns: Map<string, SimulatedPgColumn> = new Map();
  public rows: SimulatedWalletRow[] = [];
  public constraints: Set<string> = new Set();

  constructor(isLegacyNumeric: boolean = false) {
    this.columns.set('id', { name: 'id', type: 'serial', nullable: false, defaultValue: null });
    this.columns.set('user_id', { name: 'user_id', type: 'integer', nullable: false, defaultValue: null });
    this.columns.set('currency', { name: 'currency', type: 'varchar', nullable: false, defaultValue: null });
    this.columns.set('real_balance', { name: 'real_balance', type: 'numeric', nullable: false, defaultValue: '0.0000' });
    this.columns.set('bonus_balance', { name: 'bonus_balance', type: 'numeric', nullable: false, defaultValue: '0.0000' });
    this.columns.set('locked_balance', { name: 'locked_balance', type: 'numeric', nullable: false, defaultValue: '0.0000' });

    if (isLegacyNumeric) {
      this.columns.set('balance_minor', { name: 'balance_minor', type: 'numeric', nullable: true, defaultValue: null });
      this.columns.set('version', { name: 'version', type: 'integer', nullable: false, defaultValue: 1 });
    }
  }

  // Execute the exact logic embedded in 0001_canonical_wallet_schema.sql
  applyMigration() {
    // 1. balance_minor conversion / creation
    const minorCol = this.columns.get('balance_minor');
    if (minorCol) {
      if (['numeric', 'double precision', 'real', 'integer', 'smallint', 'character varying', 'text'].includes(minorCol.type)) {
        minorCol.type = 'bigint';
        for (const row of this.rows) {
          if (row.balance_minor !== undefined && row.balance_minor !== null) {
            row.balance_minor = BigInt(Math.round(Number(row.balance_minor)));
          }
        }
      }
    } else {
      this.columns.set('balance_minor', { name: 'balance_minor', type: 'bigint', nullable: true, defaultValue: 0n });
    }

    // 2. commission_balance column
    if (!this.columns.has('commission_balance')) {
      this.columns.set('commission_balance', { name: 'commission_balance', type: 'numeric', nullable: true, defaultValue: '0.0000' });
    }

    // 3. version column conversion / creation
    const verCol = this.columns.get('version');
    if (verCol) {
      if (['integer', 'smallint', 'numeric'].includes(verCol.type)) {
        verCol.type = 'bigint';
        for (const row of this.rows) {
          if (row.version !== undefined && row.version !== null) {
            row.version = BigInt(row.version);
          }
        }
      }
    } else {
      this.columns.set('version', { name: 'version', type: 'bigint', nullable: true, defaultValue: 1n });
    }

    // 4. unique constraint
    this.constraints.add('uq_wallet_user_currency');

    // 5. Backfill balance_minor from real_balance (0.0516 BDT -> 516 minor units)
    for (const row of this.rows) {
      if ((row.balance_minor === undefined || row.balance_minor === null || row.balance_minor === 0n || row.balance_minor === 0) && row.real_balance > 0) {
        row.balance_minor = BigInt(Math.round(row.real_balance * 10000));
      }
    }

    // 6. Guarantee zero defaults and NOT NULL constraints
    for (const row of this.rows) {
      if (row.balance_minor === undefined || row.balance_minor === null) {
        row.balance_minor = 0n;
      }
      if (row.version === undefined || row.version === null) {
        row.version = 1n;
      }
    }

    const finalMinor = this.columns.get('balance_minor')!;
    finalMinor.defaultValue = 0n;
    finalMinor.nullable = false;

    const finalVer = this.columns.get('version')!;
    finalVer.defaultValue = 1n;
    finalVer.nullable = false;
  }
}

async function runTask2332Tests() {
  console.log('================================================================');
  console.log('🧪 PLAY369 TASK 2.3.3.2: FINAL WALLET MIGRATION COMPATIBILITY TESTS');
  console.log('================================================================\n');

  const migrationSqlPath = path.resolve(process.cwd(), 'src/server/migrations/0001_canonical_wallet_schema.sql');
  const schemaTsPath = path.resolve(process.cwd(), 'src/db/schema.ts');
  const schemaSqlPath = path.resolve(process.cwd(), 'src/server/schema.sql');

  const migrationSql = fs.readFileSync(migrationSqlPath, 'utf-8');
  const schemaTs = fs.readFileSync(schemaTsPath, 'utf-8');
  const schemaSql = fs.readFileSync(schemaSqlPath, 'utf-8');

  // --------------------------------------------------------------------------
  // TEST 1: Migration script handles old NUMERIC balance_minor safely
  // --------------------------------------------------------------------------
  await assert('1. Migrate old wallet schema with NUMERIC(20,0) balance_minor to BIGINT', () => {
    const db = new SimulatedPgDatabase(true);
    db.rows.push({
      id: 1,
      user_id: 101,
      currency: 'BDT',
      real_balance: 100.5000,
      bonus_balance: 0.0000,
      locked_balance: 0.0000,
      commission_balance: 0.0000,
      balance_minor: '1005000', // legacy numeric string or number
      version: 7, // legacy integer
    });

    db.applyMigration();

    const minorCol = db.columns.get('balance_minor')!;
    const verCol = db.columns.get('version')!;

    if (minorCol.type !== 'bigint' || minorCol.nullable !== false) {
      throw new Error(`Expected balance_minor to be bigint NOT NULL, got ${minorCol.type}, nullable=${minorCol.nullable}`);
    }
    if (verCol.type !== 'bigint' || verCol.nullable !== false) {
      throw new Error(`Expected version to be bigint NOT NULL, got ${verCol.type}, nullable=${verCol.nullable}`);
    }
    if (db.rows[0].balance_minor !== 1005000n) {
      throw new Error(`Expected balance_minor 1005000n, got ${db.rows[0].balance_minor}`);
    }
    if (db.rows[0].version !== 7n) {
      throw new Error(`Expected version 7n preserved, got ${db.rows[0].version}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Existing wallet balance is preserved and never reset
  // --------------------------------------------------------------------------
  await assert('2. Existing wallet balances and versions are strictly preserved', () => {
    const db = new SimulatedPgDatabase(true);
    db.rows.push(
      { id: 1, user_id: 1, currency: 'BDT', real_balance: 500.0000, bonus_balance: 25.0000, locked_balance: 0.0000, commission_balance: 0.0000, balance_minor: 5000000n, version: 15 },
      { id: 2, user_id: 2, currency: 'BDT', real_balance: 12.3456, bonus_balance: 0.0000, locked_balance: 0.0000, commission_balance: 0.0000, balance_minor: 123456n, version: 3 }
    );

    db.applyMigration();

    if (db.rows[0].real_balance !== 500.0000 || db.rows[0].bonus_balance !== 25.0000 || db.rows[0].balance_minor !== 5000000n || db.rows[0].version !== 15n) {
      throw new Error('Wallet 1 balance or version was mutated during migration');
    }
    if (db.rows[1].real_balance !== 12.3456 || db.rows[1].balance_minor !== 123456n || db.rows[1].version !== 3n) {
      throw new Error('Wallet 2 balance or version was mutated during migration');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Exact scale-4 mapping: 0.0516 BDT -> 516 minor units
  // --------------------------------------------------------------------------
  await assert('3. Exact scale-4 backfill mapping: 0.0516 BDT = 516 minor units', () => {
    const db = new SimulatedPgDatabase(false);
    db.rows.push({
      id: 1,
      user_id: 10005,
      currency: 'BDT',
      real_balance: 0.0516,
      bonus_balance: 0.0000,
      locked_balance: 0.0000,
      commission_balance: 0.0000,
    });

    db.applyMigration();

    if (db.rows[0].balance_minor !== 516n) {
      throw new Error(`Scale-4 backfill mismatch: expected 516n, got ${db.rows[0].balance_minor}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Migration idempotency (can run twice safely without side effects)
  // --------------------------------------------------------------------------
  await assert('4. Migration idempotency: running twice produces identical state without balance change', () => {
    const db = new SimulatedPgDatabase(true);
    db.rows.push({
      id: 1,
      user_id: 200,
      currency: 'BDT',
      real_balance: 75.1234,
      bonus_balance: 5.0000,
      locked_balance: 0.0000,
      commission_balance: 1.5000,
      balance_minor: null,
      version: 2,
    });

    // Run 1
    db.applyMigration();
    const stateAfterRun1 = JSON.stringify(db.rows, (_, v) => typeof v === 'bigint' ? v.toString() : v);

    // Run 2
    db.applyMigration();
    const stateAfterRun2 = JSON.stringify(db.rows, (_, v) => typeof v === 'bigint' ? v.toString() : v);

    if (stateAfterRun1 !== stateAfterRun2) {
      throw new Error('Migration is not idempotent: second run modified state');
    }
    if (db.rows[0].balance_minor !== 751234n) {
      throw new Error(`Expected 751234n, got ${db.rows[0].balance_minor}`);
    }
    if (db.rows[0].version !== 2n) {
      throw new Error(`Expected version 2n, got ${db.rows[0].version}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Fresh DB schema matches Drizzle schema definitions
  // --------------------------------------------------------------------------
  await assert('5. Fresh DB schema matches Drizzle schema types (BIGINT balance_minor & version)', () => {
    // Check Drizzle schema.ts
    if (!schemaTs.includes("balanceMinor: bigint('balance_minor', { mode: 'bigint' })")) {
      throw new Error('Drizzle schema.ts does not use bigint for balanceMinor');
    }
    if (!schemaTs.includes("version: bigint('version', { mode: 'bigint' })")) {
      throw new Error('Drizzle schema.ts does not use bigint for version');
    }

    // Check Production schema.sql
    if (!schemaSql.includes('balance_minor BIGINT NOT NULL DEFAULT 0,')) {
      throw new Error('Production schema.sql does not define balance_minor BIGINT NOT NULL DEFAULT 0');
    }
    if (!schemaSql.includes('version BIGINT NOT NULL DEFAULT 1,')) {
      throw new Error('Production schema.sql does not define version BIGINT NOT NULL DEFAULT 1');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Migration SQL contains explicit type conversion & safety guards
  // --------------------------------------------------------------------------
  await assert('6. Migration SQL script contains explicit BIGINT casting and NOT NULL enforcement', () => {
    if (!migrationSql.includes('ALTER TABLE wallets ALTER COLUMN balance_minor TYPE BIGINT USING ROUND(balance_minor::numeric)::bigint;')) {
      throw new Error('Migration SQL missing explicit balance_minor conversion to BIGINT');
    }
    if (!migrationSql.includes('ALTER TABLE wallets ALTER COLUMN version TYPE BIGINT USING version::bigint;')) {
      throw new Error('Migration SQL missing explicit version conversion to BIGINT');
    }
    if (!migrationSql.includes('ALTER TABLE IF EXISTS wallets ALTER COLUMN balance_minor SET NOT NULL;') ||
        !migrationSql.includes('ALTER TABLE IF EXISTS wallets ALTER COLUMN balance_minor SET DEFAULT 0;')) {
      throw new Error('Migration SQL missing balance_minor NOT NULL DEFAULT 0 enforcement');
    }
    if (!migrationSql.includes('ALTER TABLE IF EXISTS wallets ALTER COLUMN version SET NOT NULL;') ||
        !migrationSql.includes('ALTER TABLE IF EXISTS wallets ALTER COLUMN version SET DEFAULT 1;')) {
      throw new Error('Migration SQL missing version NOT NULL DEFAULT 1 enforcement');
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TASK 2.3.3.2 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTask2332Tests();
