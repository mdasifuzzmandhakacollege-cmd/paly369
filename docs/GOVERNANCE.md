# Repository Governance & Delivery Pipeline

## 1. Overview & Governance Architecture

To maintain strict production reliability, compliance, and supply-chain integrity across the **PLAY369** platform, all changes must pass through a controlled Pull Request (PR) and Continuous Integration (CI) verification gate before reaching production.

### Policy vs. Server-Side Enforcement Distinction

> [!IMPORTANT]
> **Policy & Convention vs. GitHub Server-Side Enforcement**:
> - **Repository Governance Policy (This Document & `.github/` configurations)**: Defines the authoritative engineering rules, code ownership (`CODEOWNERS`), required automated gates, and pull request review workflows for all contributors.
> - **GitHub Server-Side Enforcement (Repository Settings)**: The `main` branch is only *technically* enforced against direct pushes once the repository administrator enables a **GitHub Ruleset** or **Branch Protection Rule** in the GitHub repository settings UI (requiring status checks to pass and PR reviews before merging).
> - Until server-side branch protection rules are activated in GitHub repository settings, all contributors must strictly adhere to this governance policy via disciplined PR-driven workflows.

---

## 2. Core Repository Governance Rules

1. **`main` Branch Protection Policy**:
   - Direct commits and direct pushes to the `main` branch are strictly prohibited by repository policy.
   - All production deployments are sourced strictly from verified commits on `main`.

2. **Branching Strategy**:
   - All work must be developed in dedicated feature, bugfix, or chore branches (`feat/*`, `fix/*`, `chore/*`, `sec/*`).
   - Short-lived branches with clear, linear commit history are required.

3. **Mandatory Pull Request Workflow & Quality Gates**:
   - Every merge into `main` must occur via a Pull Request.
   - Pull Requests require passing all CI verification gates across all supported Node.js runtimes (Node 20.x and 22.x).
   - Zero bypass of failing automated tests or security audits.

---

## 3. GitHub Server-Side Ruleset Configuration Guide

To enable server-side technical enforcement on GitHub:
1. Navigate to **GitHub Repository Settings** $\rightarrow$ **Rules** $\rightarrow$ **Rulesets** (or **Branches** $\rightarrow$ **Branch protection rules**).
2. Target branch: `main` (or default branch).
3. Enable enforcement rules:
   - **Restrict deletions**: Enabled.
   - **Require a pull request before merging**: Enabled (Require review from Code Owners).
   - **Require status checks to pass before merging**:
     - `build (20.x)`
     - `build (22.x)`
   - **Block force pushes**: Enabled.
   - **Require linear history**: Recommended.

---

## 4. Automated CI Verification Gates

Every Pull Request and commit to `main` triggers automated verification executing the following fail-closed steps:

| Gate | Command | Description | Failure Policy |
|---|---|---|---|
| **1. Dependency Audit** | `npm audit --audit-level=high` | Automated supply-chain vulnerability scan. | **Fail-closed** on any High or Critical advisory. |
| **2. TypeScript Lint & Typecheck** | `npm run lint` (`tsc --noEmit`) | Strict static type validation. | **Fail-closed** on any type mismatch or lint error. |
| **3. Security & Regression Gate** | `npm test` (`tsx src/server/__tests__/runAllTests.ts`) | Hermetic test suite covering Task A1, A2, A3, and A4 invariants. | **Fail-closed** on any test failure or credential leak. |
| **4. Production Build** | `npm run build` | Full Vite client and esbuild server compilation. | **Fail-closed** on any compilation error. |

---

## 5. Pull Request Protocol & Checklist

When opening a Pull Request, engineers must fill out the standard PR template (`.github/pull_request_template.md`), addressing:
- **Change Summary**: Clear description of functional or technical modifications.
- **Security Impact**: Evaluation of auth, permissions, input sanitization, and data exposure.
- **Database / Schema Impact**: Details of PostgreSQL (Drizzle) or Firestore schema adjustments and backwards compatibility.
- **Rollback Plan**: Concrete procedure to revert changes safely if an issue arises post-merge.
- **Tests Executed**: Evidence of test execution and coverage.
- **Secrets Invariant**: Explicit confirmation that no credentials, tokens, or private keys are introduced.
- **CI Status**: Verification that GitHub Actions CI matrix is completely green.

---

## 6. Code Ownership & Review Boundaries

Code ownership is mapped via `.github/CODEOWNERS` with registered repository owner `@mdasifuzzmandhakacollege-cmd` to ensure critical paths receive mandatory review:
- **Global Catch-All**: `*`
- **CI / CD Pipelines**: `/.github/`, `/.github/workflows/`
- **Security & Access Control**: `/src/middleware/auth.ts`, `/src/lib/firebase-admin.ts`, `/firestore.rules`, `/firebase-blueprint.json`
- **Server & API Controllers**: `/server.ts`, `/src/server/`
- **Database & Schemas**: `/src/db/`, `/drizzle.config.ts`
- **Configuration & Dependencies**: `/package.json`, `/package-lock.json`, `/tsconfig.json`, `/vite.config.ts`, `/.github/CODEOWNERS`

---

## 7. Emergency Hotfix Procedure

In the event of a critical production incident:
1. Create a `hotfix/<incident-id>` branch from the latest stable `main` commit.
2. Apply the minimal necessary patch.
3. Open an expedited PR adhering to the same CI verification gates.
4. Verify all tests and builds pass.
5. Merge into `main` and trigger release validation according to `docs/PRODUCTION_READINESS.md`.

