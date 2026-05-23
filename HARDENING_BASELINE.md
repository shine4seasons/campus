# HARDENING BASELINE TO 9.5

Date: 2026-05-23
Branch: `hardening-rubric-remediation-v1`

## Current score snapshot

| Category | Current | Target |
|---|---:|---:|
| Folder organization | 8.0 | 9.5 |
| Architecture | 7.5 | 9.5 |
| API design | 8.0 | 9.5 |
| Database & queries | 7.5 | 9.5 |
| Performance | 6.5 | 9.5 |
| Constants/enums/config | 8.5 | 9.5 |
| Validation/error handling | 8.5 | 9.5 |
| Security | 8.0 | 9.5 |
| Documentation/DX | 9.0 | 9.5 |
| Overall | 7.9 | 9.5 |

## What this document is for

This baseline is not a freeze plan anymore.
It is a direct statement of the remaining gap between current state and a 9.5-grade project.

## Core rule

No work is considered complete unless it moves one or more rubric categories toward 9.5 with code, tests, and evidence.

## Category gaps to 9.5

### Folder organization

Current gaps:
1. Backend structure is better, but repository boundaries are still inconsistent.
2. Frontend assets are still spread across too many page scripts and CSS files.
3. Large EJS views still hold page logic that should live in modules.

Required end state:
1. `controllers/`, `services/`, and `repositories/` have strict roles.
2. Shared frontend code is centralized under stable utility/component folders.
3. Views are mostly declarative and no longer behave like application controllers.

### Architecture

Current gaps:
1. Some business logic still lives in controllers and page controllers.
2. Service layer exists but is not yet universal.
3. Repository abstraction is still missing for most data access.
4. Cross-cutting concerns such as notifications, ownership checks, and transaction orchestration are not fully normalized.

Required end state:
1. Flow is consistently `route -> controller -> service -> repository`.
2. Controllers become thin orchestration only.
3. Domain policies are reusable and testable in services.
4. Data access patterns are isolated from business logic.

### API design

Current gaps:
1. OpenAPI coverage is still partial.
2. Error envelope is better but not yet fully proven across every route.
3. Some endpoints still mix command semantics, resource semantics, or UI convenience semantics.
4. Pagination/filter conventions are not clearly standardized across all list endpoints.

Required end state:
1. All critical endpoints are documented in OpenAPI.
2. Response schema is predictable across success and failure paths.
3. Commands and resource updates are clearly separated.
4. All public APIs follow one pagination and filtering contract.

### Database and queries

Current gaps:
1. Runtime concurrency evidence is still incomplete.
2. Repository-wide query plans are not benchmarked systematically.
3. Some aggregate/batch improvements exist, but list-heavy flows still need audit.
4. Index policy is documented, but not yet proven minimal and optimal under measured load.

Required end state:
1. Critical write flows are race-safe under repeated runtime tests.
2. Hot read paths have explain-plan evidence.
3. No known N+1 or O(n^2) access pattern remains on critical endpoints.
4. Index set is lean, named, measured, and migration-driven.

### Performance

Current gaps:
1. p95 improvements are not yet demonstrated in a strong before/after report.
2. Frontend still relies on large templates and many DOM string renders.
3. Home/list/search flows still need load-budget targets.
4. External dependency latency handling is still basic for AI/payment flows.

Required end state:
1. p95 is tracked for hot endpoints with documented wins.
2. Rendering cost on large pages is reduced and measurable.
3. Expensive external calls have cache, timeout, and fallback strategy.
4. Hot pages and APIs have explicit performance budgets.

### Constants/enums/config

Current gaps:
1. Centralization is good but not fully enforced.
2. Some literals may still exist outside config boundaries.
3. Environment validation is not yet strict enough at startup.

Required end state:
1. Runtime-critical literals are config-driven.
2. Startup fails fast for invalid env/config.
3. Enums and constants are the only source of truth for business statuses and roles.

### Validation and error handling

Current gaps:
1. Coverage is strong, but validation and error handling are still not proven at every edge path.
2. Error code taxonomy is not yet formally versioned or documented in one contract table.
3. Multipart, querystring, and params validation still need the same rigor as body validation.

Required end state:
1. Body, params, query, and upload inputs are validated consistently.
2. Error codes are stable and documented.
3. Controllers do not handcraft error payloads anymore.

### Security

Current gaps:
1. Core controls are present, but full negative-case integration coverage is still thin.
2. Stored XSS risk is reduced only in selected hardened modules, not all frontend modules.
3. CSP, rate limiting, brute-force protection, and session hardening are not yet first-class.
4. Audit evidence exists, but not enough to claim near-perfect hardening.

Required end state:
1. Authz, CSRF, socket auth, and ownership checks are covered by strong integration tests.
2. User-controlled HTML insertion is eliminated or centrally sanitized project-wide.
3. Security headers and abuse controls are explicit and tested.
4. Threat model and residual risk register are current.

### Documentation and DX

Current gaps:
1. Docs are much stronger, but setup, hardening, runtime evidence, and API docs are still split.
2. There is not yet a single operator runbook that covers local, CI, staging, and release.
3. Some scripts exist without one canonical execution flow.

Required end state:
1. One clear developer runbook exists.
2. One clear release verification flow exists.
3. Docs and scripts map one-to-one.

## 9.5 definition of done

The project reaches 9.5-grade quality only if all of the following are true:
1. No known material gap remains in any rubric category.
2. Every claimed improvement is backed by code plus automated evidence.
3. Runtime evidence exists for security, concurrency, and p95 performance.
4. Architecture quality is visible from the codebase, not only from documentation.
