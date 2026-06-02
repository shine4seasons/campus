# Operator Runbook

Last updated: 2026-06-02

This is the canonical operating flow for local setup, validation gates, database/index work, runtime evidence, and release checks.

## Local Setup

1. Copy `.env.example` to `.env` and fill provider/database secrets.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev` for local development or `npm start` for a production-like boot.
4. Startup config validation runs from `config/env.js`; fix any reported missing or inconsistent environment values before continuing.

## Daily Validation Gate

Run this before claiming a hardening or rubric score improvement:

```sh
npm run test:gates
```

This runs lint, smoke tests, hardening controls, security integration-lite, ownership checks, request validation checks, concurrency controls, and the static security check.

Useful focused gates:

```sh
npm run test:validation:request
npm run test:architecture:repositories
npm run test:security:ownership
npm run test:concurrency:controls
npm run security-check
```

## Database And Index Changes

Index changes are migration-driven. Do not rely on production auto-index creation.

```sh
npm run migrate:indexes
```

Before release, review:

- `docs/index-catalog.md`
- generated index snapshots under `docs/index-snapshots/` when present

## Runtime Evidence

Runtime evidence requires a reachable app and seeded data. Seed fixtures first when needed:

```sh
npm run seed:runtime
```

Collect benchmark and concurrency artifacts:

```sh
npm run evidence:runtime
```

For authenticated p95 checks, set the relevant benchmark cookies/headers described in `docs/perf-endpoint-matrix.local.json`, then run:

```sh
npm run bench:p95:local
npm run bench:p95:budget
```

Evidence is valid only when endpoints have meaningful samples, error rates stay under budget, and invariant verification exits successfully.

## Release Verification

Before presenting the project as 9+ quality:

1. Run `npm run test:gates`.
2. Run `npm run migrate:indexes` against the intended database target.
3. Capture or refresh runtime evidence with `npm run evidence:runtime`.
4. Confirm p95 budget artifacts under `docs/evidence/` are meaningful and passing.
5. Confirm concurrency invariant artifacts under `docs/evidence/` show no broken order/payment/payout invariant.
6. Update `docs/hardening-final-report.md` and `docs/hardening-kpi.md` with the new evidence date and residual risks.

## Rubric Evidence Map

| Rubric area | Primary proof |
|---|---|
| Folder organization | repository/service/controller layout, `HARDENING_BACKLOG.md` |
| Architecture | `npm run test:architecture:repositories` |
| API design | `docs/openapi.yaml`, route-level validation, response/error contracts |
| Database & queries | `docs/index-catalog.md`, `npm run test:concurrency:controls`, runtime invariant artifacts |
| Performance | `npm run bench:p95:local`, `npm run bench:p95:budget`, `docs/evidence/perf-*` |
| Constants/config | `config/env.js`, `config/appConstants.js`, `.env.example` |
| Validation/error handling | `docs/validation-coverage-matrix.md`, `npm run test:validation:request` |
| Security | `npm run test:security:lite`, `npm run test:security:ownership`, `npm run security-check` |
| Documentation/DX | this runbook plus `ENV_SETUP.md` |
