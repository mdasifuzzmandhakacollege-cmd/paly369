# PLAY369 Project Checkpoint

Last updated: 2026-08-30
Branch: `main`
Latest verified implementation checkpoint before this roadmap update: `9639ad89c3c7191fc6935fc194bbae33e6bacf4c`

## Purpose
This file is the persistent source-of-truth checkpoint for PLAY369. Before assigning any new implementation task, verify the latest GitHub `main` state and continue from this checkpoint instead of restarting or repeating completed work.

## Current Position

### LOCKED / VERIFIED FOUNDATION
- React/Vite PLAY369 frontend with Emerald/Gold visual system.
- Firebase authentication foundation.
- PostgreSQL wallet-ledger foundation.
- Seamless wallet `/balance`, `/bet`, `/win`, `/refund` controller foundation.
- HMAC SHA-256 provider middleware foundation.
- New-user production zero-balance defaults.
- Canonical wallet schema aligned to PLAY369 integer/serial identities.
- `balance_minor` uses scale-4 BIGINT semantics.
- Existing-wallet migration supports safe NUMERIC -> BIGINT conversion.
- Wallet `version` aligned to BIGINT.
- Migration is designed to preserve existing balances and be idempotent.
- Admin/Audit/Workbench navigation hidden from standard PLAYER/VIP accounts.
- Privileged frontend access is based on server-verified role state.
- Privileged backend routes use server-side RBAC (`requireAdmin`).
- Legacy admin payment/stat routes were protected.
- Promotion authentication/identity binding completed.
- Promotion client-side financial fallback credit removed.
- Affiliate authentication/identity binding completed.
- Affiliate commission accrual hardened with authoritative source transaction validation, scale-4 math, row locking and idempotency.
- Affiliate commission claim hardened around exact SETTLED entries, deterministic claim identity and production WalletLedgerService wiring.
- Task 2.4 backend referral binding implemented: authenticated server bind endpoint, immutable parent relationship, self-referral/cycle/reassignment rejection, ACID row locking and idempotent same-parent retry.

### Important verified commits
- `99e6b8dd999a0c8debd870dcbc7234843a016561` — promotion integrity / BigInt work.
- `acee908295303c1d4342891ee90da40b190c0995` — atomic affiliate commission claim.
- `d5c34468a65518441abdc836306b0b131429ebc6` — affiliate claim routed through WalletLedgerService.
- `dafc213bae536a13a74f7f0e519fb4b6651bc631` — production ledger injection / fail-closed affiliate claim wiring.
- `2d59c0227a625a18ebe6dd1657cfbd7c6587a186` — authoritative server-side RBAC.
- `e59507903eee1cfc7aedf111fee24534187e429f` — canonical schema / zero-balance production defaults.
- `d740b20d70defe679ee7797f275f087dd787d271` — final wallet migration compatibility / BIGINT versioning.
- `9639ad89c3c7191fc6935fc194bbae33e6bacf4c` — immutable server-side referral binding.

# CURRENT ACTIVE TASK

## Gate 1 — Affiliate Final Cleanup / Production UI Authority
Status: **ACTIVE / NEXT IMPLEMENTATION TASK**

Task 2.4 backend relationship binding is verified, but the affiliate frontend/service still contains legacy local/demo authority that must be removed before the affiliate chapter is locked.

Required cleanup:
- AffiliateDashboard must load referral counts, commission totals, referral code/link and claimable amount from authenticated server APIs.
- Remove production use of localStorage referral records as affiliate truth.
- Remove synthetic/random 30-day affiliate financial/member data from production mode.
- Remove client-side fake claim success and local claimed-state mutation; commission claim must call the authenticated `/api/affiliate/claim` endpoint.
- Disable/remove production test click/conversion/commission simulators.
- Referral sharing may remain client-side, but it must use the authoritative server-issued referral code.
- Client localStorage may carry only a temporary incoming referral code until server binding; it cannot establish relationship, money, counts or claim state.
- No client-generated referral bonus, commission or financial notification may represent a real credit.
- Re-run affiliate auth, binding, accrual, claim, cycle, concurrency and idempotency tests.

Exit criteria:
- Affiliate relationship, accrual, claim and displayed financial/member state are server-authoritative.
- No client path can create, fake, or credit affiliate money.
- No production UI claims synthetic member/commission activity as real.

# ROAD TO LIVE — REMAINING SEQUENCE

## Gate 2 — Promotions / Rewards Final Hardening
- Add DB-level uniqueness/constraints for daily check-in and wheel claims.
- Define one authoritative daily time boundary/timezone.
- Add durable idempotency keys for reward operations.
- Route all monetary rewards through the canonical WalletLedgerService.
- Replace `Math.random()` for financial/reward RNG with cryptographically secure RNG.
- If the product says “provably fair,” implement a real verifiable seed/commit/reveal model; otherwise remove that claim.
- Make offers, eligibility, expiry and wagering rules server-configured and server-authoritative.

Exit criteria:
- No duplicate rewards under retries, double-clicks or concurrent requests.
- No client-generated prize or reward balance.

## Gate 3 — VIP + Wagering Integrity
- Bind VIP progression to authoritative deposit/bet ledger events.
- Harden VIP level-up bonus, cashback and periodic rewards with idempotency and ledger credit.
- Make wagering/rollover progress derive from valid settled game transactions only.
- Enforce expiry, completion and conversion states server-side.
- Remove synthetic/demo VIP progress and reward counters.

Exit criteria:
- VIP and wagering balances/progress reconcile to real ledger events.

## Gate 4 — Cashier / Payment Productionization
- Remove all `autoApprove` production behavior.
- Never trust client-supplied `userId` for deposit/withdraw ownership.
- Bind cashier requests to authenticated user identity.
- Replace direct floating-point wallet mutation with canonical WalletLedgerService / scale-4 integer money.
- Use ACID transactions, `SELECT ... FOR UPDATE`, durable transaction idempotency and reconciliation.
- Integrate official/approved bKash/Nagad/Rocket provider or aggregator adapters.
- Verify provider webhooks/signatures before wallet credit.
- Add deposit/withdraw state machine: PENDING -> VERIFIED/APPROVED -> SETTLED/FAILED/REVERSED.
- Protect withdrawal from replay, double-submit and race conditions.

Exit criteria:
- A client request alone can never create money.
- Only verified payment confirmation can credit a deposit.
- Withdrawal debit/payout/reversal is recoverable and exactly-once.

## Gate 5 — Game Provider Sandbox + Seamless Wallet Certification
- Obtain sandbox/test credentials only after core financial paths are ready.
- Register callback URLs and supported currency.
- Integrate the final approved provider/aggregator adapter.
- Validate exact provider contract for `/balance`, `/bet`, `/win`, `/refund`.
- HMAC SHA-256, timestamp/replay protection, correlation IDs and secret isolation.
- Strict transaction idempotency.
- Row-level locking for financial mutations.
- Reconciliation for retries, late wins/refunds and provider duplicates.
- Load/latency tests with endpoint response target under 4 seconds.

Exit criteria:
- Provider sandbox end-to-end transaction lifecycle passes with zero double debit/credit.

## Gate 6 — Production UI / Live-Data / Mobile Finalization
- Remove all remaining fake/demo counters, fake activity, placeholder jackpots and synthetic financial values from production mode.
- All wallet, affiliate, promo, VIP, cashier and transaction screens read live authoritative APIs.
- Keep Emerald Green & Gold design.
- Final responsive/mobile pass with >=48px touch targets.
- Safe-area handling for Capacitor Android.
- Loading, empty, retry and error states.
- PWA manifest/favicon/app icons and Android adaptive icon integration.
- Performance/code-splitting and asset optimization.

Exit criteria:
- A new real account sees only real zero/live state and no operator/developer surfaces.

## Gate 7 — Staging, Security Audit & Production Launch Gate
- Full fresh-user registration/login/logout/session test.
- Role escalation / RBAC regression test.
- Wallet reconciliation and migration verification against staging PostgreSQL.
- Deposit/withdraw webhook and reversal tests.
- Affiliate referral/accrual/claim tests.
- Reward/VIP/wagering duplicate/concurrency tests.
- Provider `/balance -> /bet -> /win -> /refund` E2E sandbox test.
- HMAC/replay/idempotency/rate-limit/security-log tests.
- SQL injection, race-condition and authorization audit.
- Secret scan: no `.env`, live provider/payment keys or credentials committed.
- Load/concurrency/SLA test.
- Backup/restore and reconciliation procedure.
- Production health checks, observability and rollback plan.
- Final production build and live-route smoke test.

Exit criteria:
- No critical/high financial or authorization blockers.
- Reconciliation passes.
- Production environment variables/secrets configured outside source control.
- Provider/payment integrations explicitly approved for production.
- Only then mark PLAY369 **LIVE READY**.

# Live-Readiness Summary
From the current checkpoint, the road is:

`Affiliate Final Cleanup -> Promotions/Rewards -> VIP/Wagering -> Cashier/Payments -> Provider Sandbox/Seamless Certification -> UI/Mobile Finalization -> Staging/Security/Launch Gate -> LIVE`

These are release gates, not a promise that each gate requires only one prompt. If GitHub verification reveals a production blocker, use a narrowly scoped corrective subtask before advancing.

## Non-Negotiable Production Rules
- PostgreSQL/GamePlay365 is the financial source of truth.
- No client-side authoritative credit/debit.
- No floating-point authoritative money movement.
- All financial mutations require ACID behavior, row locking where applicable and strict idempotency.
- Provider callbacks require HMAC SHA-256 and replay protection.
- Seamless wallet endpoints target <4 second response time.
- No live secrets in GitHub or chat.
- No production payment/provider enablement before sandbox/security/reconciliation gates pass.
- GitHub `main` is the implementation source of truth; screenshots are supporting evidence only.

## Resume Rule
When asked “where are we now?”, “what remains?”, or “what is the next task?” :
1. Read this checkpoint.
2. Inspect latest GitHub `main` commits/files.
3. Confirm Affiliate Final Cleanup status.
4. Continue from the first unfinished gate only.
5. Never restart or repeat a locked gate unless GitHub verification shows a regression.
