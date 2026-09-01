# Production Readiness Checklist

This document establishes the mandatory operational and deployment criteria required before any release of the **PLAY369** gaming and admin operations platform to production.
All production releases must strictly comply with the [System Boundary Specification](./SYSTEM_BOUNDARY.md).

---

## 1. Automated CI Status & Verification Gates
- [ ] **Matrix Verification**: GitHub Actions CI workflow is 100% green across both **Node.js 20.x** and **Node.js 22.x**.
- [ ] **Typecheck & Lint (`npm run lint`)**: 0 TypeScript compilation errors or warnings.
- [ ] **Automated Regression Suite (`npm test`)**: All hermetic test suites pass:
  - **Task A1**: Authoritative Admin Read Model (PostgreSQL aggregation, audit logging).
  - **Task A2**: Authoritative Payment Operations (transaction verification, scale-4 precision).
  - **Task A3**: Authoritative Wallet & Wagering Monitoring (real-time balance reconciliation).
  - **Task A4**: CI Security & Hermetic Firebase Isolation (fail-closed auth, zero GCP ADC dependency).
  - **Task A6**: System Boundary & Environment Compliance Gate (fail-closed runtime validation, capability isolation).
- [ ] **Build Validation (`npm run build`)**: Static frontend bundle and CommonJS server bundle compile cleanly into `dist/`.

---

## 2. System Boundary & Environment Compliance
- [ ] **Explicit Runtime Environment**: Server runtime normalized to `production` via `APP_ENV=production` or `NODE_ENV=production`. Unknown values fail closed at startup.
- [ ] **Capability Boundary Compliance**: System boundary compliance verified against [docs/SYSTEM_BOUNDARY.md](./SYSTEM_BOUNDARY.md) (mock adapters blocked in production, sandbox payments isolated).
- [ ] **Zero Secret Leakage**: Environment validator confirms no credential values or tokens are printed to logs or responses during startup or runtime.

---

## 3. Security & Supply-Chain Audit
- [ ] **Dependency Vulnerability Scan (`npm audit`)**: 0 High or Critical vulnerabilities.
- [ ] **Supply-Chain Integrity**: `package-lock.json` committed with pinned versions and validated overrides.
- [ ] **Role-Based Access Control (RBAC)**: All admin and operations endpoints (`/api/admin/*`) enforce strict role validation (`requireAdmin` / `requireAuth`) with fail-closed 401/403 responses.

---

## 3. Secrets & Credential Management
- [ ] **Zero Hardcoded Secrets**: Verified that no API keys, private tokens, service account JSON files, database passwords, or JWT secrets exist in the codebase.
- [ ] **Environment Configuration**: All runtime secrets are passed via secure environment variables (`GEMINI_API_KEY`, `POSTGRES_URL`, etc.) declared in `.env.example`.
- [ ] **Client Exposure Prevention**: Verified that server-only environment variables are never prefixed with `VITE_` or exposed to client-side bundles.

---

## 4. Database Migrations & Data Integrity
- [ ] **Schema Backward Compatibility**: All PostgreSQL schema migrations (Drizzle ORM) are backwards-compatible with running application versions.
- [ ] **Scale-4 Decimal Storage**: Financial balances, payouts, wagers, and transaction amounts utilize exact `numeric(18, 4)` / string formatting with zero IEEE-754 floating-point drift.
- [ ] **Migration Dry-Run**: Schema updates verified in staging before applying to production.

---

## 5. Rollback & Deployment Safety
- [ ] **Rollback Strategy Defined**: Concrete plan in place to revert code via git revert or container rollback.
- [ ] **Zero Downtime Deployments**: Application instances handle graceful shutdown without dropping in-flight WebSocket connections or HTTP requests.
- [ ] **Static Asset Versioning**: Asset hashing enabled to prevent caching stale client bundles.

---

## 6. Observability, Logging & Monitoring
- [ ] **Structured Logging**: Server logs capture API errors, auth failures, and database timeouts without logging sensitive user credentials or tokens.
- [ ] **Health Endpoint**: `/api/health` returns HTTP 200 with operational subsystem status.
- [ ] **Latency & Capacity Monitoring**: Server latency metrics and TPS capacity gauge operational.

---

## 7. Backup & Disaster Recovery Verification
- [ ] **Database Snapshots**: Automated point-in-time recovery (PITR) enabled on Cloud SQL PostgreSQL.
- [ ] **Firestore Backups**: Scheduled daily exports configured for Firestore collections.
- [ ] **Recovery Drill**: Documented restore procedure verified within acceptable RTO (< 1 hour) and RPO (< 5 minutes).

---

## 8. Incident Response Protocol
- [ ] **On-Call Escalation**: Designated security and engineering response leads identified.
- [ ] **Circuit Breakers**: Payment and wagering gateways support emergency maintenance mode flags.
- [ ] **Audit Trail**: Administrative actions logged immutably with timestamp, actor UID, IP, and action payload in the audit log collection.

---

## 9. Deployment Verification
- [ ] **Smoke Test**: Post-deployment verification of core user journeys (Lobby navigation, Wallet view, Live Casino streams, Admin dashboard).
- [ ] **Admin Read-Only Invariant**: Verification that admin monitoring dashboards reflect live PostgreSQL state without mutation permissions.
- [ ] **Sign-Off**: Production release approved by authorized release owner.
