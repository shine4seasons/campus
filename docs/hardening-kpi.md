# Hardening KPI Dashboard

Program date baseline: 2026-05-22

## KPI trend table

| Date | Phase | KPI-SEC-01 (high risk open) | KPI-SEC-02 (owner scope %) | KPI-VAL-01 (mutable validation %) | KPI-ERR-01 (raw 5xx leak %) | KPI-DB-01 (critical flow tx/idempotency %) | KPI-RUB-01 (overall) | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 2026-05-22 | Baseline | >0 | partial | partial | present | partial | 6.8 | Baseline from hardening plan |
| 2026-05-22 | Current | 0 (repo-known) | 100 | 100 | 0 (contract checks) | controls complete, load test pending | pending | Hardening gates + security/concurrency control tests passing |
| 2026-06-02 | 9+ uplift | 0 (repo-known) | 100 | 100 body/upload + critical params/query | 0 (contract checks) | controls + invariant verifier complete, runtime load evidence pending | 9.1 | `test:gates` now includes architecture repository and request validation checks; operator runbook added |

## Measurement sources

1. `docs/ownership-audit-matrix.md` for `KPI-SEC-02`.
2. `docs/validation-coverage-matrix.md` for `KPI-VAL-01`.
3. API error contract checks (`app.js` global mapper + targeted controller audit) for `KPI-ERR-01`.
4. Concurrency/idempotency checklist + test evidence for `KPI-DB-01`.
5. `docs/perf-endpoint-matrix.example.json` + `scripts/benchmark-p95.js` meaningful-run checks for authenticated `PERF-201` measurements.
6. `npm run test:architecture:repositories` for repository-layer coverage.
7. `npm run test:validation:request` and `docs/validation-coverage-matrix.md` for params/query validation evidence.
8. `docs/operator-runbook.md` for `KPI-DX-01`.

## Daily update template

```md
Date:
Owner:

Completed today:
- ISSUE-CODE:

In progress:
- ISSUE-CODE:

Blocked:
- ISSUE-CODE: blocker reason

Next:
- ISSUE-CODE:

KPI delta:
- KPI-XXX: before -> current
```
