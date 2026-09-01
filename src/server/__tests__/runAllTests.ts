import { runAdminOpsTaskA1Tests } from './authoritativeAdminOpsReadModelTaskA1.test.js';
import { runTaskA2TestSuite } from './authoritativePaymentOperationsTaskA2.test.js';
import { runAuthoritativeWalletWageringTaskA3Tests } from './authoritativeWalletWageringTaskA3.test.js';
import { runTaskA4CiSecurityGateTests } from './ciSecurityRegressionGateTaskA4.test.js';
import { runTaskA6TestSuite } from './systemBoundaryComplianceTaskA6.test.js';
import { setupHermeticAuthAndDb } from './mockAuthAndDbAdapters.js';

export async function runAllVerificationSuites(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║               PLAY369 CI AUTOMATED VERIFICATION & SECURITY GATE             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Initialize hermetic test adapters (zero GCP / ADC / secret requirement)
  setupHermeticAuthAndDb();

  const startTime = Date.now();
  const results: { name: string; status: 'PASSED' | 'FAILED'; error?: any }[] = [];

  // Suite 1: Task A1 - Authoritative Admin Ops Read Model
  try {
    console.log('>>> [1/5] Executing Task A1 Verification Gate: Authoritative Admin Ops Read Model...');
    await runAdminOpsTaskA1Tests();
    results.push({ name: 'Task A1: Authoritative Admin Ops Read Model', status: 'PASSED' });
    console.log('>>> [1/5] Task A1 Gate PASSED ✅\n');
  } catch (err: any) {
    console.error('>>> [1/5] Task A1 Gate FAILED ❌:', err);
    results.push({ name: 'Task A1: Authoritative Admin Ops Read Model', status: 'FAILED', error: err });
  }

  // Suite 2: Task A2 - Authoritative Payment Operations
  try {
    console.log('>>> [2/5] Executing Task A2 Verification Gate: Authoritative Payment Operations...');
    await runTaskA2TestSuite();
    results.push({ name: 'Task A2: Authoritative Payment Operations', status: 'PASSED' });
    console.log('>>> [2/5] Task A2 Gate PASSED ✅\n');
  } catch (err: any) {
    console.error('>>> [2/5] Task A2 Gate FAILED ❌:', err);
    results.push({ name: 'Task A2: Authoritative Payment Operations', status: 'FAILED', error: err });
  }

  // Suite 3: Task A3 - Authoritative Wallet & Wagering Monitoring
  try {
    console.log('>>> [3/5] Executing Task A3 Verification Gate: Authoritative Wallet & Wagering Monitoring...');
    await runAuthoritativeWalletWageringTaskA3Tests();
    results.push({ name: 'Task A3: Authoritative Wallet & Wagering Monitoring', status: 'PASSED' });
    console.log('>>> [3/5] Task A3 Gate PASSED ✅\n');
  } catch (err: any) {
    console.error('>>> [3/5] Task A3 Gate FAILED ❌:', err);
    results.push({ name: 'Task A3: Authoritative Wallet & Wagering Monitoring', status: 'FAILED', error: err });
  }

  // Suite 4: Task A4 - CI Security & Regression Verification Gate
  try {
    console.log('>>> [4/5] Executing Task A4 Verification Gate: CI Security & Regression Invariants...');
    await runTaskA4CiSecurityGateTests();
    results.push({ name: 'Task A4: CI Security & Regression Invariants', status: 'PASSED' });
    console.log('>>> [4/5] Task A4 Gate PASSED ✅\n');
  } catch (err: any) {
    console.error('>>> [4/5] Task A4 Gate FAILED ❌:', err);
    results.push({ name: 'Task A4: CI Security & Regression Invariants', status: 'FAILED', error: err });
  }

  // Suite 5: Task A6 - System Boundary & Environment Compliance Gate
  try {
    console.log('>>> [5/5] Executing Task A6 Verification Gate: System Boundary & Environment Compliance...');
    await runTaskA6TestSuite();
    results.push({ name: 'Task A6: System Boundary & Environment Compliance', status: 'PASSED' });
    console.log('>>> [5/5] Task A6 Gate PASSED ✅\n');
  } catch (err: any) {
    console.error('>>> [5/5] Task A6 Gate FAILED ❌:', err);
    results.push({ name: 'Task A6: System Boundary & Environment Compliance', status: 'FAILED', error: err });
  }

  const durationMs = Date.now() - startTime;
  const failedSuites = results.filter((r) => r.status === 'FAILED');

  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log(`CI GATE VERIFICATION REPORT (${durationMs}ms)`);
  console.log('════════════════════════════════════════════════════════════════════════════════');
  for (const res of results) {
    console.log(`${res.status === 'PASSED' ? '✅' : '❌'} ${res.name}: ${res.status}`);
  }
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  if (failedSuites.length > 0) {
    console.error(`🚨 FAIL-CLOSED: ${failedSuites.length} test suite(s) failed.`);
    process.exit(1);
  }

  console.log('🎉 ALL CI SECURITY & REGRESSION VERIFICATION GATES PASSED DETERMINISTICALLY.');
  process.exit(0);
}

runAllVerificationSuites().catch((err) => {
  console.error('Unexpected runner crash:', err);
  process.exit(1);
});
