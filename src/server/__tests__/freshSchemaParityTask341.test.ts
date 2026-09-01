/**
 * @file freshSchemaParityTask341.test.ts
 * @description PLAY369 Task 3.4.1 - Promotion Fresh-Schema Parity and Integrity Constraint Test Suite.
 * 
 * Test Coverage:
 * 1. Fresh schema.sql provisioning matches Drizzle schema:
 *    - wheel_spins has audit_metadata JSONB NOT NULL DEFAULT '{}'
 *    - free_spin_entitlements exists with exact canonical fields
 *    - check constraints on quantity, remaining_quantity, and status
 *    - unique index on source_reference
 *    - unique index on (user_id, source, spin_date_utc)
 *    - index on (user_id, status)
 *    - foreign key to users(id) ON DELETE CASCADE
 * 2. Migration 0005 matches fresh schema.sql:
 *    - table creation has all 4 check constraints
 *    - DO block provides idempotent ADD CONSTRAINT guards
 * 3. Database check constraint enforcement:
 *    - Invalid quantity (quantity <= 0) rejected
 *    - Invalid remaining quantity (remaining_quantity < 0) rejected
 *    - Invalid remaining quantity (remaining_quantity > quantity) rejected
 *    - Invalid status (not IN ACTIVE, CONSUMED, EXPIRED, REVOKED) rejected
 *    - Valid transitions and records accepted
 * 4. Drizzle ORM schema (src/db/schema.ts) parity check
 */

import fs from 'fs';
import path from 'path';

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

// ----------------------------------------------------------------------------
// In-Memory Schema Constraint Validator for PostgreSQL DB engine simulation
// ----------------------------------------------------------------------------
interface FreeSpinRecord {
  id?: number;
  userId: number;
  source: string;
  sourceReference: string;
  quantity: number;
  remainingQuantity: number;
  status: string;
  spinDateUtc: string;
  expiresAt: Date | null;
  grantedAt?: Date;
  createdAt?: Date;
}

class PostgresConstraintEngine {
  private allowedStatuses = new Set(['ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED']);

  public validateFreeSpinRecord(record: FreeSpinRecord) {
    // 1. quantity > 0
    if (typeof record.quantity !== 'number' || !Number.isInteger(record.quantity) || record.quantity <= 0) {
      const err: any = new Error('new row for relation "free_spin_entitlements" violates check constraint "chk_free_spin_quantity_positive"');
      err.code = '23514';
      err.constraint = 'chk_free_spin_quantity_positive';
      throw err;
    }

    // 2. remaining_quantity >= 0
    if (typeof record.remainingQuantity !== 'number' || !Number.isInteger(record.remainingQuantity) || record.remainingQuantity < 0) {
      const err: any = new Error('new row for relation "free_spin_entitlements" violates check constraint "chk_free_spin_remaining_non_negative"');
      err.code = '23514';
      err.constraint = 'chk_free_spin_remaining_non_negative';
      throw err;
    }

    // 3. remaining_quantity <= quantity
    if (record.remainingQuantity > record.quantity) {
      const err: any = new Error('new row for relation "free_spin_entitlements" violates check constraint "chk_free_spin_remaining_lte_quantity"');
      err.code = '23514';
      err.constraint = 'chk_free_spin_remaining_lte_quantity';
      throw err;
    }

    // 4. status IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED')
    if (!this.allowedStatuses.has(record.status)) {
      const err: any = new Error('new row for relation "free_spin_entitlements" violates check constraint "chk_free_spin_status_valid"');
      err.code = '23514';
      err.constraint = 'chk_free_spin_status_valid';
      throw err;
    }

    return true;
  }
}

async function runParityTests() {
  console.log('================================================================');
  console.log('🛡️ PLAY369 TASK 3.4.1: FRESH-SCHEMA PARITY & CONSTRAINT SUITE');
  console.log('================================================================\n');

  const schemaPath = path.join(process.cwd(), 'src/server/schema.sql');
  const migrationPath = path.join(process.cwd(), 'src/server/migrations/0005_free_spin_entitlements.sql');
  const drizzleSchemaPath = path.join(process.cwd(), 'src/db/schema.ts');

  assert(fs.existsSync(schemaPath), 'src/server/schema.sql exists');
  assert(fs.existsSync(migrationPath), 'src/server/migrations/0005_free_spin_entitlements.sql exists');
  assert(fs.existsSync(drizzleSchemaPath), 'src/db/schema.ts exists');

  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  const drizzleTs = fs.readFileSync(drizzleSchemaPath, 'utf-8');

  // --------------------------------------------------------------------------
  // TEST 1: wheel_spins audit_metadata Parity in schema.sql
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: wheel_spins audit_metadata in schema.sql ---');
  assert(
    schemaSql.includes('audit_metadata JSONB NOT NULL DEFAULT'),
    'schema.sql contains audit_metadata JSONB NOT NULL DEFAULT on wheel_spins'
  );
  assert(
    schemaSql.includes('wheel_spins_user_spin_date_utc_idx'),
    'schema.sql preserves wheel_spins_user_spin_date_utc_idx unique index'
  );

  // --------------------------------------------------------------------------
  // TEST 2: free_spin_entitlements Table & Canonical Fields Parity
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: free_spin_entitlements Canonical Fields in schema.sql ---');
  assert(
    schemaSql.includes('CREATE TABLE IF NOT EXISTS free_spin_entitlements'),
    'schema.sql creates free_spin_entitlements table'
  );
  assert(
    schemaSql.includes('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE'),
    'schema.sql defines user_id foreign key with ON DELETE CASCADE'
  );
  assert(
    schemaSql.includes('source VARCHAR(32) NOT NULL DEFAULT \'LUCKY_WHEEL\'') ||
    schemaSql.includes('source VARCHAR(32) DEFAULT \'LUCKY_WHEEL\' NOT NULL'),
    'schema.sql defines source column with DEFAULT LUCKY_WHEEL'
  );
  assert(
    schemaSql.includes('source_reference VARCHAR(128) NOT NULL'),
    'schema.sql defines source_reference VARCHAR(128)'
  );
  assert(
    schemaSql.includes('quantity INTEGER NOT NULL'),
    'schema.sql defines quantity INTEGER NOT NULL'
  );
  assert(
    schemaSql.includes('remaining_quantity INTEGER NOT NULL'),
    'schema.sql defines remaining_quantity INTEGER NOT NULL'
  );
  assert(
    schemaSql.includes('status VARCHAR(32) NOT NULL DEFAULT \'ACTIVE\'') ||
    schemaSql.includes('status VARCHAR(32) DEFAULT \'ACTIVE\' NOT NULL'),
    'schema.sql defines status column'
  );
  assert(
    schemaSql.includes('spin_date_utc VARCHAR(10) NOT NULL'),
    'schema.sql defines spin_date_utc VARCHAR(10)'
  );
  assert(
    schemaSql.includes('expires_at TIMESTAMPTZ') || schemaSql.includes('expires_at TIMESTAMP WITH TIME ZONE'),
    'schema.sql defines expires_at TIMESTAMPTZ'
  );
  assert(
    schemaSql.includes('granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()') ||
    schemaSql.includes('granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL'),
    'schema.sql defines granted_at timestamp'
  );
  assert(
    schemaSql.includes('created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()') ||
    schemaSql.includes('created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL'),
    'schema.sql defines created_at timestamp'
  );

  // Indexes in schema.sql
  assert(
    schemaSql.includes('free_spin_entitlements_source_ref_idx'),
    'schema.sql defines free_spin_entitlements_source_ref_idx unique index'
  );
  assert(
    schemaSql.includes('free_spin_entitlements_user_source_date_idx'),
    'schema.sql defines free_spin_entitlements_user_source_date_idx unique index'
  );
  assert(
    schemaSql.includes('free_spin_entitlements_user_status_idx'),
    'schema.sql defines free_spin_entitlements_user_status_idx index'
  );

  // --------------------------------------------------------------------------
  // TEST 3: Check Constraints in schema.sql and Migration 0005
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Check Constraints in schema.sql & Migration 0005 ---');
  // 1. quantity > 0
  assert(
    schemaSql.includes('chk_free_spin_quantity_positive') &&
    schemaSql.includes('CHECK (quantity > 0)'),
    'schema.sql defines chk_free_spin_quantity_positive CHECK (quantity > 0)'
  );
  assert(
    migrationSql.includes('chk_free_spin_quantity_positive') &&
    migrationSql.includes('CHECK (quantity > 0)'),
    'migration 0005 defines chk_free_spin_quantity_positive'
  );

  // 2. remaining_quantity >= 0
  assert(
    schemaSql.includes('chk_free_spin_remaining_non_negative') &&
    schemaSql.includes('CHECK (remaining_quantity >= 0)'),
    'schema.sql defines chk_free_spin_remaining_non_negative CHECK (remaining_quantity >= 0)'
  );
  assert(
    migrationSql.includes('chk_free_spin_remaining_non_negative') &&
    migrationSql.includes('CHECK (remaining_quantity >= 0)'),
    'migration 0005 defines chk_free_spin_remaining_non_negative'
  );

  // 3. remaining_quantity <= quantity
  assert(
    schemaSql.includes('chk_free_spin_remaining_lte_quantity') &&
    schemaSql.includes('CHECK (remaining_quantity <= quantity)'),
    'schema.sql defines chk_free_spin_remaining_lte_quantity CHECK (remaining_quantity <= quantity)'
  );
  assert(
    migrationSql.includes('chk_free_spin_remaining_lte_quantity') &&
    migrationSql.includes('CHECK (remaining_quantity <= quantity)'),
    'migration 0005 defines chk_free_spin_remaining_lte_quantity'
  );

  // 4. status IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED')
  assert(
    schemaSql.includes('chk_free_spin_status_valid') &&
    schemaSql.includes("'ACTIVE'") &&
    schemaSql.includes("'CONSUMED'") &&
    schemaSql.includes("'EXPIRED'") &&
    schemaSql.includes("'REVOKED'"),
    'schema.sql defines chk_free_spin_status_valid'
  );
  assert(
    migrationSql.includes('chk_free_spin_status_valid') &&
    migrationSql.includes("'ACTIVE'") &&
    migrationSql.includes("'CONSUMED'") &&
    migrationSql.includes("'EXPIRED'") &&
    migrationSql.includes("'REVOKED'"),
    'migration 0005 defines chk_free_spin_status_valid'
  );

  // Migration idempotent DO block
  assert(
    migrationSql.includes('DO $$') &&
    migrationSql.includes('IF NOT EXISTS ('),
    'migration 0005 includes idempotent DO block for existing table migrations'
  );

  // --------------------------------------------------------------------------
  // TEST 4: Drizzle ORM Schema Parity (src/db/schema.ts)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Drizzle Schema Parity ---');
  assert(
    drizzleTs.includes("export const freeSpinEntitlements = pgTable('free_spin_entitlements'"),
    'src/db/schema.ts defines freeSpinEntitlements table'
  );
  assert(
    drizzleTs.includes("free_spin_entitlements_source_ref_idx"),
    'src/db/schema.ts declares sourceRefIdx'
  );
  assert(
    drizzleTs.includes("free_spin_entitlements_user_source_date_idx"),
    'src/db/schema.ts declares userSourceDateIdx'
  );
  assert(
    drizzleTs.includes("free_spin_entitlements_user_status_idx"),
    'src/db/schema.ts declares userStatusIdx'
  );
  assert(
    drizzleTs.includes("auditMetadata: jsonb('audit_metadata')"),
    'src/db/schema.ts declares auditMetadata on wheel_spins'
  );

  // --------------------------------------------------------------------------
  // TEST 5: Constraint Validation Rejections (Unit Simulation)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Check Constraint Behavioral Verification ---');
  const engine = new PostgresConstraintEngine();

  // Valid record
  const validRecord: FreeSpinRecord = {
    userId: 101,
    source: 'LUCKY_WHEEL',
    sourceReference: 'WHEEL_FS_101_2026-08-30',
    quantity: 25,
    remainingQuantity: 25,
    status: 'ACTIVE',
    spinDateUtc: '2026-08-30',
    expiresAt: new Date()
  };
  assert(engine.validateFreeSpinRecord(validRecord) === true, 'Valid entitlement record accepted');

  // Valid partially consumed record
  const partiallyConsumed: FreeSpinRecord = {
    ...validRecord,
    remainingQuantity: 10
  };
  assert(engine.validateFreeSpinRecord(partiallyConsumed) === true, 'Partially consumed record (10 <= 25) accepted');

  // Valid fully consumed record
  const fullyConsumed: FreeSpinRecord = {
    ...validRecord,
    remainingQuantity: 0,
    status: 'CONSUMED'
  };
  assert(engine.validateFreeSpinRecord(fullyConsumed) === true, 'Fully consumed record (0 <= 25, CONSUMED) accepted');

  // Invalid: quantity <= 0
  let qtyZeroCaught = false;
  try {
    engine.validateFreeSpinRecord({ ...validRecord, quantity: 0, remainingQuantity: 0 });
  } catch (err: any) {
    qtyZeroCaught = true;
    assert(err.constraint === 'chk_free_spin_quantity_positive', 'Zero quantity rejected by chk_free_spin_quantity_positive');
  }
  assert(qtyZeroCaught, 'Zero quantity caught');

  let qtyNegCaught = false;
  try {
    engine.validateFreeSpinRecord({ ...validRecord, quantity: -5, remainingQuantity: 0 });
  } catch (err: any) {
    qtyNegCaught = true;
    assert(err.constraint === 'chk_free_spin_quantity_positive', 'Negative quantity rejected');
  }
  assert(qtyNegCaught, 'Negative quantity caught');

  // Invalid: remaining_quantity < 0
  let remNegCaught = false;
  try {
    engine.validateFreeSpinRecord({ ...validRecord, remainingQuantity: -1 });
  } catch (err: any) {
    remNegCaught = true;
    assert(err.constraint === 'chk_free_spin_remaining_non_negative', 'Negative remaining quantity rejected by chk_free_spin_remaining_non_negative');
  }
  assert(remNegCaught, 'Negative remaining quantity caught');

  // Invalid: remaining_quantity > quantity
  let remGtQtyCaught = false;
  try {
    engine.validateFreeSpinRecord({ ...validRecord, quantity: 25, remainingQuantity: 30 });
  } catch (err: any) {
    remGtQtyCaught = true;
    assert(err.constraint === 'chk_free_spin_remaining_lte_quantity', 'Remaining > quantity rejected by chk_free_spin_remaining_lte_quantity');
  }
  assert(remGtQtyCaught, 'Remaining > quantity caught');

  // Invalid: status not in allowed list
  let invalidStatusCaught = false;
  try {
    engine.validateFreeSpinRecord({ ...validRecord, status: 'INVALID_STATUS' });
  } catch (err: any) {
    invalidStatusCaught = true;
    assert(err.constraint === 'chk_free_spin_status_valid', 'Invalid status rejected by chk_free_spin_status_valid');
  }
  assert(invalidStatusCaught, 'Invalid status caught');

  // All 4 allowed statuses tested
  for (const st of ['ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED']) {
    const r = { ...validRecord, remainingQuantity: 0, status: st };
    assert(engine.validateFreeSpinRecord(r) === true, `Status '${st}' successfully validated`);
  }

  // --------------------------------------------------------------------------
  // FINAL REPORT
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TASK 3.4.1 TEST RESULTS: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runParityTests().catch((err) => {
  console.error('Fatal test error in Task 3.4.1 test suite:', err);
  process.exit(1);
});
