# System Boundary & Environment Compliance Specification

This document is the authoritative specification for runtime environments, capability matrices, security invariants, and authentication boundaries for the **PLAY369** gaming and admin operations platform.

---

## 1. Runtime Environments

The platform defines exactly four normalized runtime environments. Any unrecognized or invalid environment value must **fail closed** immediately at startup.

| Environment | Identifier | Purpose & Boundary Constraints |
|---|---|---|
| **Development** | `development` | Local development, unit/integration testing, and hermetic CI pipelines. Mock and in-memory adapters permitted. Zero real credentials. Zero external financial transactions. Zero live network calls in CI. |
| **Sandbox** | `sandbox` | Integration testing with provider/payment sandbox APIs. Simulated test balances and fake payment rails. Zero production settlement or real-money risk. Provider sandbox session tokens only. |
| **Staging** | `staging` | Production-equivalent pre-release validation. Isolated staging database. Controlled external sandbox/partner test integrations. Zero production financial activation or live payment routing. |
| **Production** | `production` | Live customer-facing environment. Disabled by default unless explicitly configured via secure secret managers. Authoritative PostgreSQL ledger for all financial transactions. Real credentials passed exclusively via container environment variables. |

---

## 2. Environment Capability Matrix

For each platform capability, the allowed status and authoritative data source are strictly defined:

| Capability | Development | Sandbox | Staging | Production | Authoritative Data Source | Boundary Notes |
|---|---|---|---|---|---|---|
| **Authentication** | Allowed (Mock / Firebase) | Allowed (Firebase Auth) | Allowed (Firebase Auth) | Allowed (Firebase Auth) | Firebase Auth / PostgreSQL Users | Dual Phone / Email unique identity boundary. |
| **Phone OTP (A6.0)** | Allowed (Mock / Test OTP) | Allowed (Sandbox SMS Gateway) | Allowed (Staging SMS Gateway) | Allowed (Production SMS Gateway) | PostgreSQL `user_auth_factors` / Redis | Enforces 1 phone number $\leftrightarrow$ 1 account invariant. |
| **Email Verification** | Allowed (Mock / Auto-verify) | Allowed (Sandbox Mailer) | Allowed (Staging Mailer) | Allowed (Production Mailer) | Firebase Auth / PostgreSQL | Enforces 1 email address $\leftrightarrow$ 1 account invariant. |
| **PostgreSQL Ledger** | Allowed (In-Memory / Local Pool) | Allowed (Isolated Sandbox DB) | Allowed (Staging Cloud SQL) | Allowed (Production Cloud SQL) | PostgreSQL (`wallets`, `transactions`, `ledger`) | Immutable double-entry ledger with scale-4 precision. |
| **Firebase Auth** | Allowed (Hermetic Mock / Local) | Allowed (Firebase Project) | Allowed (Firebase Staging) | Allowed (Firebase Production) | Firebase Auth Service | Token verification with fail-closed RBAC claims. |
| **Firestore (Non-Financial)** | Allowed (Hermetic Mock / Local) | Allowed (Sandbox Firestore) | Allowed (Staging Firestore) | Allowed (Production Firestore) | Google Cloud Firestore | Profile metadata, banners, announcements, app config only. |
| **Payment Adapter** | Allowed (Mock Adapter) | Allowed (Sandbox Provider Adapters) | Allowed (Sandbox/Staging Gateway) | Allowed (Production Gateway) | PostgreSQL `payment_requests` / `transactions` | Production requires explicit approval and credentials. |
| **Payment Webhook Receiver** | Blocked (Except local test fixtures) | Allowed (Sandbox Webhook Endpoint) | Allowed (Staging Webhook Endpoint) | Allowed (HMAC-Verified Production Endpoint) | PostgreSQL `payment_requests` | Strict HMAC-SHA256 signature verification. |
| **Provider API Adapter** | Blocked (Mock responses only) | Allowed (Provider Sandbox Endpoints) | Allowed (Provider Staging Endpoints) | Conditional (Approved Live Providers) | PostgreSQL `seamless_transactions` | Disabled by default via `PROVIDER_*_ENABLED=false`. |
| **Provider Demo / Sandbox** | Allowed (Deterministic fixtures) | Allowed (Provider Demo Launch URLs) | Allowed (Provider Demo Launch URLs) | Allowed (Free-to-Play Demo Mode) | In-Memory / Ephemeral Session Store | Never alters PostgreSQL wallet balances. |
| **Referral / Affiliate** | Allowed (Mock calculations) | Allowed (Sandbox Attribution) | Allowed (Staging Attribution) | Allowed (Production Attribution) | PostgreSQL `affiliate_commissions` / `referrals` | Tier-based commission calculations with scale-4 precision. |
| **Admin Monitoring** | Allowed (Hermetic Mock Read Model) | Allowed (Sandbox Admin Portal) | Allowed (Staging Admin Portal) | Allowed (Production Admin Portal) | PostgreSQL Direct Authoritative Aggregations | Read-only invariant: zero balance mutation routes. |
| **Financial Mutation** | Blocked (Simulation / Rollback only) | Blocked (Simulated fake balances only) | Blocked (Test credits only) | Conditional (Authoritative Ledger Transactions) | PostgreSQL Ledger via ACID Transactions | Strictly audited with immutable transaction hashes. |

---

## 3. Strict Runtime Environment Guards

### 3.1 Normalized Runtime Definition
The server evaluates `process.env.APP_ENV` (fallback: `process.env.NODE_ENV`) against the four allowed strings:
`development`, `sandbox`, `staging`, `production`.

- **Fail-Closed Rule**: Any unrecognized environment value (e.g., `prod`, `dev`, `local`, `qa`, `testing`, `unknown`) causes an immediate startup exception (`EnvironmentValidationError`).
- **No Silent Fallback**: An invalid or missing environment value is never silently defaulted to `production`.

### 3.2 Configuration Validation at Startup
During boot, `validateRuntimeEnvironmentConfig()` validates:
1. **Environment Compatibility**:
   - `development`: Live production provider keys and live payment credentials are strictly blocked.
   - `sandbox`: Production settlement keys are blocked.
   - `production`: `DATABASE_URL` is required; debug mock adapters are strictly blocked.
2. **Zero Secret Exposure**:
   - Validation logs and error messages must **never** print secret keys, tokens, or connection strings.
   - Only structural flags (e.g., `isConfigured: true`, `length: 32`) are validated.

---

## 4. Authentication Boundary Specification (Upcoming A6.0 Model)

To prepare for Task A6.0 (Unified Authentication & Identity Management), the following boundaries are established:

1. **Dual-Factor Identity Resolution**:
   - A user may register and authenticate using a **verified phone number** OR a **verified email address**.
2. **Strict Uniqueness Invariants**:
   - **One Phone $\leftrightarrow$ One Account**: A single phone number can belong to exactly one player identity. Re-registration with an existing phone number is blocked.
   - **One Email $\leftrightarrow$ One Account**: A single email address can belong to exactly one player identity.
3. **Shared IP Address Policy**:
   - A shared IP address (e.g. university campus, mobile carrier NAT, public Wi-Fi, shared household) **must NOT** automatically block legitimate multiple users from registering or playing.
   - IP address and device fingerprinting are treated strictly as **security and risk signals** (for velocity limits and anomalous fraud detection), never as a hard binary identity constraint.
4. **Zero Risk Telemetry Exposure**:
   - Risk scores, fraud telemetry, device trust scores, and security flags must **never** be exposed to end users in client responses or UI components.

---

## 5. Security & Architectural Invariants

1. **PostgreSQL Authority**: PostgreSQL remains the sole source of truth for all balances, financial ledger entries, wager records, and transaction states.
2. **Zero Financial Fabrication**: No financial values or wallet balances may fall back to fake or hardcoded numbers in non-sandbox routes. If the database fails, endpoints fail closed with HTTP 500.
3. **Zero Secret Exposure**: No API keys, service account JSON files, private keys, or passwords may exist in client bundles, log outputs, HTTP responses, or git history.
4. **Strict RBAC**: Admin routes enforce `requireAdmin` with verification against authoritative roles (`ADMIN`, `OPERATOR`, `SUPER_ADMIN`). Non-privileged users receive HTTP 403.
5. **Hermetic CI Isolation**: Automated test suites must run completely offline without Google Application Default Credentials (ADC) or external network dependencies.
6. **Scale-4 Precision**: All currency amounts, odds calculations, and balances must be stored and computed with exact 4-decimal precision (`numeric(18, 4)` / decimal strings).
