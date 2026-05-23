# HARDENING EXECUTION PLAN TO 9.5

Date: 2026-05-23
Branch: `hardening-rubric-remediation-v1`

## Objective

Raise every rubric category to 9.5 by focusing only on the remaining gaps.

## Non-negotiable acceptance rules

1. No category is upgraded by documentation alone.
2. Every score increase must be backed by code plus tests plus evidence.
3. Runtime evidence is mandatory for security, concurrency, and performance claims.
4. Architecture claims are only valid if the code structure visibly enforces them.

## Execution order

### Wave 1 - Remove score ceilings

These are the items currently preventing 9.5 even if smaller fixes land elsewhere.

1. `FE-201` Eliminate unsafe DOM string rendering project-wide.
2. `ARCH-201` Roll out repository layer for critical domains.
3. `DB-201` Produce runtime concurrency proof.
4. `PERF-201` Produce before/after p95 report.
5. `SEC-201` Add CSP, rate limiting, and abuse controls.

Definition of success for Wave 1:
1. No major rubric category remains capped by a known structural gap.

### Wave 2 - Normalize depth and consistency

1. `API-201` Expand OpenAPI coverage.
2. `VAL-201` Validate params/query/upload rigorously.
3. `ARCH-202` Remove business logic from page controllers.
4. `DB-202` Capture explain-plan evidence on hot queries.
5. `PERF-202` Reduce frontend render cost.

Definition of success for Wave 2:
1. Quality becomes consistent across the whole codebase, not only critical paths.

### Wave 3 - Polish to 9.5 standard

1. `FO-201` Rationalize frontend assets and file layout.
2. `CONF-201` Add startup config validation.
3. `DOC-201` Publish single operator runbook.
4. `SEC-202` Publish threat model and residual risk register.
5. `QA-201` Add release-grade one-command validation flow.

Definition of success for Wave 3:
1. The repo looks and operates like a mature, release-ready system.

## Category-specific improvement plan

### Folder organization: 8.0 -> 9.5

Required changes:
1. Introduce `repositories/` as a first-class backend layer.
2. Group frontend code into `pages/`, `components/`, `utils/`, and `vendor/` with clear boundaries.
3. Reduce scatter of page-specific CSS and move shared patterns into stable shared files.

Evidence:
1. Final folder map in runbook.
2. Reduced orphaned or one-off files.

### Architecture: 7.5 -> 9.5

Required changes:
1. Remove direct model access from API controllers wherever business logic exists.
2. Centralize ownership checks, state transitions, and notification orchestration in services.
3. Move query logic into repositories.

Evidence:
1. Controller-level grep shows minimal direct `Model.find*` usage.
2. Service and repository tests cover core flows.

### API design: 8.0 -> 9.5

Required changes:
1. Finish OpenAPI coverage for critical surface.
2. Standardize params, query, pagination, filters, and error envelope.
3. Remove any remaining overloaded semantics.

Evidence:
1. OpenAPI contract matches implementation.
2. Contract checks run in CI.

### Database & queries: 7.5 -> 9.5

Required changes:
1. Run real concurrency scenarios and store artifacts.
2. Benchmark hot reads with explain-plan evidence.
3. Keep index catalog lean and measured.

Evidence:
1. Runtime concurrency artifacts.
2. Explain-plan appendix.
3. p95 and query-count improvements.

### Performance: 6.5 -> 9.5

Required changes:
1. Measure p50/p95 before and after.
2. Reduce unnecessary full DOM rerenders.
3. Add cache/timeout/fallback strategy for slow external integrations.
4. Define explicit budgets for critical endpoints and pages.

Evidence:
1. Benchmark report.
2. Runtime evidence under seeded load.

### Constants/enums/config: 8.5 -> 9.5

Required changes:
1. Add startup env schema validation.
2. Audit remaining raw literals for business statuses, roles, and config-like strings.

Evidence:
1. Config validation module.
2. Literal audit notes.

### Validation/error handling: 8.5 -> 9.5

Required changes:
1. Validate route params and query consistently.
2. Normalize multipart validation into same contract.
3. Publish stable error code reference.

Evidence:
1. Expanded validation matrix.
2. Error-code contract table.

### Security: 8.0 -> 9.5

Required changes:
1. Finish project-wide XSS hardening.
2. Add CSP and rate limiting.
3. Add abuse detection and stronger integration coverage.
4. Publish threat model and residual risks.

Evidence:
1. Negative integration tests.
2. Security checklist and threat model.

### Documentation/DX: 9.0 -> 9.5

Required changes:
1. Replace split operational docs with one canonical runbook.
2. Ensure every script named in docs is verified and current.

Evidence:
1. Single runbook path.
2. One-command validation flow.

## Implementation checkpoints

### Checkpoint A

Must be true before claiming 8.5+ overall:
1. All existing hardening gates pass.
2. Runtime concurrency suite has passed at least once on seeded environment.
3. p95 evidence exists for core APIs.

### Checkpoint B

Must be true before claiming 9.0+ overall:
1. Repository layer exists for critical domains.
2. OpenAPI coverage is broad and current.
3. Frontend dynamic HTML risk is reduced to approved static-only cases.

### Checkpoint C

Must be true before claiming 9.5:
1. No major category has a known structural gap left open.
2. Final evidence report contains security, concurrency, performance, and architecture proof.
3. A reviewer can inspect the repo and see mature boundaries without relying on explanation.

## Review standard

A category does not get 9.5 if:
1. The implementation works only on critical paths but not consistently.
2. The repo has docs claiming work that runtime tests do not prove.
3. The architecture is still dependent on team discipline rather than code structure.

## Immediate next tasks

1. Start with `FE-201`, because project-wide unsafe DOM APIs still cap both Security and Frontend quality.
2. Then do `ARCH-201`, because without repositories Architecture and Folder organization will stay below 9.5.
3. Then run `DB-201` and `PERF-201`, because without runtime evidence Database and Performance cannot be honestly scored at 9.5.
