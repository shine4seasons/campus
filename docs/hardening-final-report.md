# Hardening Final Report (Phase 9)

Report date: 2026-05-22
Baseline: 6.8/10
Target: >= 8.0/10

## Summary

- Core remediation workstreams are implemented and verified with automated hardening gates.
- Security, validation, error contract, ownership scoping, and key idempotency controls are covered by test scripts in CI.
- DB-201 now includes a post-run invariant verifier for seeded runtime scenarios (`order-create`, `payment-paid`, `payout-refund`).
- Remaining gap is execution of those seeded runtime scenarios against a reachable app/database target and capturing final artifacts.

## Evidence Snapshot

- `npm run test:gates` passes (`lint`, `test`, `test:hardening`, `test:security:lite`, `test:security:ownership`, `security-check`).
- `npm run test:concurrency:controls` passes for DB-001 control markers.
- `npm run test:concurrency:verify -- --scenario=<scenario> ...` is available to assert post-run data invariants.
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
| KPI-DB-01 Critical flow tx/idempotency | partial | controls + invariant verifier complete, seeded runtime execution pending | 100 | Partial |
| KPI-PERF-01 p95 critical APIs | baseline current | measurement script added | improved | In progress |
| KPI-DX-01 onboarding flow | unstable | scripted checks + docs | 100 | Partial |
| KPI-RUB-01 overall rubric score | 6.8 | pending formal panel re-score | >=8.0 | In progress |

## Residual Risks

1. Full concurrency/load validation (20-50 parallel business actions) is not yet executed against a real runtime/database target with seeded scenario IDs.
2. Full E2E negative scenarios across all security matrix rows are not yet implemented in browser/API integration suites.
3. p95 performance improvement is not yet reported with before/after benchmark artifacts for authenticated hot paths using endpoint-specific success-path status budgets.

## Next Closure Steps

1. Run `npm run bench:p95:local` against a running local/staging app after setting `BENCH_BUYER_COOKIE` and `BENCH_ADMIN_COOKIE`. Optionally set `BENCH_BASELINE_ARTIFACT` for comparison.
2. Run seeded runtime concurrency scenario suite for order create/webhook replay/wallet actions and persist `concurrency-invariants-*.json`.
3. Expand Playwright/API integration tests for remaining SEC negative matrix rows.

## Runtime Commands (Ready)

1. `npm run bench:p95 -- --base=http://localhost:5000 --endpoints=/api/products,/api/chat,/api/orders --requests=50 --concurrency=10`
2. `npm run test:concurrency:runtime -- --base=http://localhost:5000 --endpoint=/api/orders --method=POST --total=20 --concurrency=10 --expect-max-2xx=1 --expect-min-conflict=10 --body="{\"productId\":\"<seed_id>\",\"quantity\":1,\"deliveryMode\":\"pickup\",\"paymentMode\":\"cash\"}" --headers="{\"content-type\":\"application/json\",\"cookie\":\"token=<jwt>; csrf=<csrf>\",\"x-csrf-token\":\"<csrf>\"}"`
3. `npm run test:concurrency:verify -- --scenario=order-create --product-id=<seed_product_id> --max-open-orders=1`
4. `npm run evidence:runtime` to auto-save benchmark/concurrency outputs under `docs/evidence/`. Add `EVIDENCE_VERIFY_ARGS` to persist post-run invariant checks.
5. Runtime evidence is considered valid only when benchmark endpoints are reachable (`samples > 0`), concurrency run is not all-request failures, and invariant verifier exits `0`.
