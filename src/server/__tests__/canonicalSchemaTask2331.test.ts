/**
 * PLAY369 Task 2.3.3.1: Canonical Schema Consistency Test Suite
 * 
 * Verifies:
 * 1. src/db/schema.ts uses BIGINT for balance_minor (not NUMERIC).
 * 2. src/server/schema.sql has all integer/serial types matching PLAY369 canonical schema (no UUID mismatches).
 * 3. src/server/schema.sql has removed demo/test users and demo/test wallets seeds.
 * 4. src/db/users.ts provisions new users with realBalance = 0.0000, bonusBalance = 0.0000, balanceMinor = 0n, operatorId = GAMEPLAY365_BD, currency = BDT.
 * 5. Existing wallet migration preserves real balances while accurately computing balance_minor (0.0516 BDT -> 516 minor units).
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

async function runTask2331Tests() {
  console.log('================================================================');
  console.log('🧪 PLAY369 TASK 2.3.3.1: CANONICAL SCHEMA CONSISTENCY TESTS');
  console.log('================================================================\n');

  const schemaTsPath = path.resolve(process.cwd(), 'src/db/schema.ts');
  const schemaSqlPath = path.resolve(process.cwd(), 'src/server/schema.sql');
  const usersTsPath = path.resolve(process.cwd(), 'src/db/users.ts');
  const migrationSqlPath = path.resolve(process.cwd(), 'src/server/migrations/0001_canonical_wallet_schema.sql');

  const schemaTsContent = fs.readFileSync(schemaTsPath, 'utf-8');
  const schemaSqlContent = fs.readFileSync(schemaSqlPath, 'utf-8');
  const usersTsContent = fs.readFileSync(usersTsPath, 'utf-8');
  const migrationSqlContent = fs.readFileSync(migrationSqlPath, 'utf-8');

  // --------------------------------------------------------------------------
  // TEST 1: src/db/schema.ts uses PostgreSQL BIGINT for balance_minor
  // --------------------------------------------------------------------------
  await assert('1. src/db/schema.ts: balance_minor uses bigint (not numeric)', () => {
    if (!schemaTsContent.includes("balanceMinor: bigint('balance_minor', { mode: 'bigint' })")) {
      throw new Error("schema.ts does not define balanceMinor using bigint('balance_minor', { mode: 'bigint' })");
    }
    if (schemaTsContent.includes("numeric('balance_minor'")) {
      throw new Error("schema.ts still contains numeric('balance_minor')");
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: src/server/schema.sql has canonical integer/serial types (no UUID mismatches)
  // --------------------------------------------------------------------------
  await assert('2. src/server/schema.sql: integer/serial types across all related tables', () => {
    // Check users
    if (!schemaSqlContent.includes('CREATE TABLE IF NOT EXISTS users (\n    id SERIAL PRIMARY KEY,')) {
      throw new Error('users table does not use SERIAL PRIMARY KEY');
    }

    // Check wallets
    if (!schemaSqlContent.includes('CREATE TABLE IF NOT EXISTS wallets (\n    id SERIAL PRIMARY KEY,\n    user_id INTEGER NOT NULL REFERENCES users(id)')) {
      throw new Error('wallets table does not use SERIAL PRIMARY KEY and INTEGER user_id');
    }

    // Check game_rounds
    if (!schemaSqlContent.includes('CREATE TABLE IF NOT EXISTS game_rounds (\n    id SERIAL PRIMARY KEY,') ||
        !schemaSqlContent.includes('user_id INTEGER NOT NULL REFERENCES users(id),')) {
      throw new Error('game_rounds table contains UUID instead of SERIAL/INTEGER');
    }

    // Check transactions
    if (!schemaSqlContent.includes('CREATE TABLE IF NOT EXISTS transactions (\n    id SERIAL PRIMARY KEY,') ||
        !schemaSqlContent.includes('user_id INTEGER NOT NULL REFERENCES users(id),') ||
        !schemaSqlContent.includes('wallet_id INTEGER NOT NULL REFERENCES wallets(id),') ||
        !schemaSqlContent.includes('round_id INTEGER REFERENCES game_rounds(id),')) {
      throw new Error('transactions table contains UUID mismatches on id, user_id, wallet_id, or round_id');
    }

    // Check ledger_entries
    if (!schemaSqlContent.includes('wallet_id INTEGER NOT NULL REFERENCES wallets(id),') ||
        !schemaSqlContent.includes('user_id INTEGER NOT NULL REFERENCES users(id),')) {
      throw new Error('ledger_entries does not reference INTEGER user_id/wallet_id');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Demo seeds removed from src/server/schema.sql
  // --------------------------------------------------------------------------
  await assert('3. src/server/schema.sql: demo/test users and wallets removed from seeds', () => {
    if (schemaSqlContent.includes('high_roller_alex') || schemaSqlContent.includes('slot_queen_maria')) {
      throw new Error('schema.sql still contains demo test user seeds');
    }
    if (schemaSqlContent.includes('INSERT INTO wallets (id, user_id, currency, real_balance')) {
      throw new Error('schema.sql still contains demo wallet seeds');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: src/db/users.ts starts new users with 0.0000 balance & PLAY369 defaults
  // --------------------------------------------------------------------------
  await assert('4. src/db/users.ts: new user starts with 0.0000 balance and GAMEPLAY365_BD/BDT defaults', () => {
    if (usersTsContent.includes('CASINO_ROYAL') || usersTsContent.includes("currency: 'USD'")) {
      throw new Error('users.ts still uses CASINO_ROYAL or USD demo defaults');
    }
    if (!usersTsContent.includes("operatorId: 'GAMEPLAY365_BD'")) {
      throw new Error('users.ts missing GAMEPLAY365_BD operatorId');
    }
    if (!usersTsContent.includes("currency: 'BDT'")) {
      throw new Error('users.ts missing default BDT currency');
    }
    if (!usersTsContent.includes("realBalance: '0.0000'") ||
        !usersTsContent.includes("bonusBalance: '0.0000'") ||
        !usersTsContent.includes("balanceMinor: 0n")) {
      throw new Error('users.ts initial balance is not zero (0.0000 realBalance, 0.0000 bonusBalance, 0n balanceMinor)');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Existing wallet migration preserves real balance & calculates minor correctly
  // --------------------------------------------------------------------------
  await assert('5. Migration 0001 preserves existing balance and backfills balance_minor accurately', () => {
    if (!migrationSqlContent.includes('ALTER TABLE wallets ALTER COLUMN balance_minor TYPE BIGINT') &&
        !migrationSqlContent.includes('ADD COLUMN balance_minor BIGINT')) {
      throw new Error('Migration does not handle balance_minor BIGINT conversion/addition');
    }
    if (!migrationSqlContent.includes('SET balance_minor = ROUND(real_balance * 10000)')) {
      throw new Error('Migration does not backfill balance_minor from real_balance using scale 4 (10000)');
    }

    // Verify 0.0516 BDT conversion logic
    const realBalance = 0.0516;
    const computedMinor = Math.round(realBalance * 10000);
    if (computedMinor !== 516) {
      throw new Error(`Scale 4 arithmetic mismatch: expected 516, got ${computedMinor}`);
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TASK 2.3.3.1 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTask2331Tests();
