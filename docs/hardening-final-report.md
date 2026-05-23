# Hardening Final Report (Phase 9)

Report date: 2026-05-22
Baseline: 6.8/10
Target: >= 8.0/10

## Summary

- Core remediation workstreams are implemented and verified with automated hardening gates.
- Security, validation, error contract, ownership scoping, and key idempotency controls are covered by test scripts in CI.
- Remaining gap is full production-like load testing and E2E negative coverage breadth.

## Evidence Snapshot

- `npm run test:gates` passes (`lint`, `test`, `test:hardening`, `test:security:lite`, `test:security:ownership`, `security-check`).
- `npm run test:concurrency:controls` passes for DB-001 control markers.
- CI workflows:
  - `.github/workflows/hardening-gates.yml`
  - `.github/workflows/playwright.yml`

## KPI Re-Score (Current)

| KPI | Baseline | Current | Target | Status |
|---|---:|---:|---:|---|
| KPI-SEC-01 High-risk security findings open | >0 | 0 (repo-known) | 0 | Met |
| KPI-SEC-02 Owner-scoped object-by-id endpoints | partial | 100 | 100 | Met |
| KPI-VAL-01 Mutable route schema validation | partial | 100 | >=95 | Met |
| KPI-ERR-01 Raw internal error leaks | present | 0 (tested contract) | 0 | Met |
| KPI-DB-01 Critical flow tx/idempotency | partial | controls complete, load test pending | 100 | Partial |
| KPI-PERF-01 p95 critical APIs | baseline current | measurement script added | improved | In progress |
| KPI-DX-01 onboarding flow | unstable | scripted checks + docs | 100 | Partial |
| KPI-RUB-01 overall rubric score | 6.8 | pending formal panel re-score | >=8.0 | In progress |

## Residual Risks

1. Full concurrency/load validation (20-50 parallel business actions) is not yet executed against a real runtime/database target.
2. Full E2E negative scenarios across all security matrix rows are not yet implemented in browser/API integration suites.
3. p95 performance improvement is not yet reported with before/after benchmark artifacts.

## Next Closure Steps

1. Run `npm run bench:p95` against staging, store JSON artifact, update `docs/hardening-kpi.md`.
2. Add runtime concurrency scenario suite for order create/webhook replay/wallet actions against a seeded test database.
3. Expand Playwright/API integration tests for remaining SEC negative matrix rows.

## Runtime Commands (Ready)

1. `npm run bench:p95 -- --base=http://localhost:5000 --endpoints=/api/products,/api/chat,/api/orders --requests=50 --concurrency=10`
2. `npm run test:concurrency:runtime -- --base=http://localhost:5000 --endpoint=/api/orders --method=POST --total=20 --concurrency=10 --expect-max-2xx=1 --expect-min-conflict=10 --body="{\"productId\":\"<seed_id>\",\"quantity\":1,\"deliveryMode\":\"pickup\",\"paymentMode\":\"cash\"}" --headers="{\"content-type\":\"application/json\",\"cookie\":\"token=<jwt>; csrf=<csrf>\",\"x-csrf-token\":\"<csrf>\"}"`
3. `npm run evidence:runtime` to auto-save benchmark/concurrency outputs under `docs/evidence/`.
4. Runtime evidence is considered valid only when benchmark endpoints are reachable (`samples > 0`) and concurrency run is not all-request failures.
