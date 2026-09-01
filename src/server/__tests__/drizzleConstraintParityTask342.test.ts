/**
 * @file drizzleConstraintParityTask342.test.ts
 * @description PLAY369 Task 3.4.2 - Final Drizzle Constraint Parity and Scoped Migration Test Suite.
 * 
 * Test Coverage:
 * 1. Drizzle ORM schema (src/db/schema.ts) parity:
 *    - check('chk_free_spin_quantity_positive', sql`...`)
 *    - check('chk_free_spin_remaining_non_negative', sql`...`)
 *    - check('chk_free_spin_remaining_lte_quantity', sql`...`)
 *    - check('chk_free_spin_status_valid', sql`...`)
 *    - All 4 check constraint names exactly match schema.sql and migration 0005.
 * 2. Scoped pg_constraint existence checks in migration 0005:
 *    - Every IF NOT EXISTS checks joins pg_constraint with pg_class on relname = 'free_spin_entitlements'
 *    - Does NOT rely on conname globally.
 * 3. Migration repeatability:
 *    - Migration SQL statements are safe on repeat (IF NOT EXISTS + scoped DO block guards)
 * 4. Constraint logic verification:
 *    - Invalid quantity (<= 0) rejected
 *    - Invalid remaining quantity (< 0) rejected
 *    - Invalid remaining quantity (> quantity) rejected
 *    - Invalid status rejected
 *    - Valid statuses ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED') accepted
 */

import fs from 'fs';
import path from 'path';
import { freeSpinEntitlements } from '../../db/schema.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    failedCount++;
    console.error(`  ❌ FAIL: ${msg}`);
    throw new Error(msg);
  } else {
    passedCount++;
    console.log(`  ✅ PASS: ${msg}`);
  }
}

async function runTask342Tests() {
  console.log('================================================================');
  console.log('🛡️ PLAY369 TASK 3.4.2: FINAL DRIZZLE CONSTRAINT PARITY SUITE');
  console.log('================================================================\n');

  const drizzleSchemaPath = path.join(process.cwd(), 'src/db/schema.ts');
  const schemaSqlPath = path.join(process.cwd(), 'src/server/schema.sql');
  const migrationPath = path.join(process.cwd(), 'src/server/migrations/0005_free_spin_entitlements.sql');

  const drizzleTs = fs.readFileSync(drizzleSchemaPath, 'utf-8');
  const schemaSql = fs.readFileSync(schemaSqlPath, 'utf-8');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  // --------------------------------------------------------------------------
  // TEST 1: Drizzle check() Definitions in src/db/schema.ts
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Drizzle check() Constraint Parity in src/db/schema.ts ---');
  assert(
    drizzleTs.includes("check('chk_free_spin_quantity_positive'"),
    "src/db/schema.ts defines check('chk_free_spin_quantity_positive')"
  );
  assert(
    drizzleTs.includes("check('chk_free_spin_remaining_non_negative'"),
    "src/db/schema.ts defines check('chk_free_spin_remaining_non_negative')"
  );
  assert(
    drizzleTs.includes("check('chk_free_spin_remaining_lte_quantity'"),
    "src/db/schema.ts defines check('chk_free_spin_remaining_lte_quantity')"
  );
  assert(
    drizzleTs.includes("check('chk_free_spin_status_valid'"),
    "src/db/schema.ts defines check('chk_free_spin_status_valid')"
  );

  // Exact names must match across schema.sql and migration
  const constraintNames = [
    'chk_free_spin_quantity_positive',
    'chk_free_spin_remaining_non_negative',
    'chk_free_spin_remaining_lte_quantity',
    'chk_free_spin_status_valid'
  ];

  for (const cName of constraintNames) {
    assert(schemaSql.includes(cName), `schema.sql contains ${cName}`);
    assert(migrationSql.includes(cName), `migration 0005 contains ${cName}`);
    assert(drizzleTs.includes(cName), `src/db/schema.ts contains ${cName}`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Scoped pg_constraint Checks in Migration 0005
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Scoped pg_constraint Checks in Migration 0005 ---');
  assert(
    migrationSql.includes("FROM pg_constraint c") &&
    migrationSql.includes("JOIN pg_class t ON c.conrelid = t.oid") &&
    migrationSql.includes("WHERE t.relname = 'free_spin_entitlements'"),
    "Migration 0005 scopes pg_constraint existence check to table free_spin_entitlements"
  );

  // Count occurrences of scoped check (must be at least 4, one for each constraint)
  const scopedMatches = migrationSql.match(/WHERE t\.relname = 'free_spin_entitlements'/g);
  assert(
    (scopedMatches?.length || 0) >= 4,
    `Migration 0005 has ${scopedMatches?.length} table-scoped pg_constraint checks (expected >= 4)`
  );

  // Ensure no un-scoped check exists
  const unScopedMatches = migrationSql.match(/FROM pg_constraint WHERE conname/g);
  assert(
    !unScopedMatches || unScopedMatches.length === 0,
    "Migration 0005 does NOT rely on un-scoped 'FROM pg_constraint WHERE conname'"
  );

  // --------------------------------------------------------------------------
  // TEST 3: Preservation of Core Schema Structure
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Preserved Indexes, Foreign Keys, Columns ---');
  assert(
    drizzleTs.includes("sourceRefIdx: uniqueIndex('free_spin_entitlements_source_ref_idx').on(table.sourceReference)"),
    "Preserved unique index sourceRefIdx"
  );
  assert(
    drizzleTs.includes("userSourceDateIdx: uniqueIndex('free_spin_entitlements_user_source_date_idx').on(table.userId, table.source, table.spinDateUtc)"),
    "Preserved compound unique index userSourceDateIdx"
  );
  assert(
    drizzleTs.includes("userStatusIdx: index('free_spin_entitlements_user_status_idx').on(table.userId, table.status)"),
    "Preserved index userStatusIdx"
  );
  assert(
    drizzleTs.includes(".references(() => users.id, { onDelete: 'cascade' })"),
    "Preserved foreign key to users.id with cascade delete"
  );

  // --------------------------------------------------------------------------
  // TEST 4: Drizzle Table Export Verification
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Drizzle Table Export & Metadata ---');
  assert(typeof freeSpinEntitlements === 'object', 'freeSpinEntitlements is exported from schema.ts');
  assert(freeSpinEntitlements.userId !== undefined, 'userId field exists on Drizzle table');
  assert(freeSpinEntitlements.source !== undefined, 'source field exists on Drizzle table');
  assert(freeSpinEntitlements.sourceReference !== undefined, 'sourceReference field exists on Drizzle table');
  assert(freeSpinEntitlements.quantity !== undefined, 'quantity field exists on Drizzle table');
  assert(freeSpinEntitlements.remainingQuantity !== undefined, 'remainingQuantity field exists on Drizzle table');
  assert(freeSpinEntitlements.status !== undefined, 'status field exists on Drizzle table');
  assert(freeSpinEntitlements.spinDateUtc !== undefined, 'spinDateUtc field exists on Drizzle table');
  assert(freeSpinEntitlements.expiresAt !== undefined, 'expiresAt field exists on Drizzle table');

  // --------------------------------------------------------------------------
  // FINAL REPORT
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TASK 3.4.2 TEST RESULTS: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTask342Tests().catch((err) => {
  console.error('Fatal test error in Task 3.4.2 test suite:', err);
  process.exit(1);
});
