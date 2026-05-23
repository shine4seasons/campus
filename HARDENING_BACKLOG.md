# HARDENING BACKLOG TO 9.5

Status legend: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`

This file contains only the remaining work required to push each rubric category to 9.5.

## P0 - Mandatory blockers for 9.5

### ARCH-201 Full repository layer rollout
- Status: DONE
- Progress notes:
1. Added repository modules for `products`, `orders`, `chat`, `wallet`, `notifications`, `payments`, and `ratings` under `repositories/`.
2. Added `repositories/adminRepository.js` and moved admin user/product/order moderation lists, analytics aggregates, report assembly, settings persistence, and payout persistence behind repository methods.
3. Added `repositories/authRepository.js`, and moved auth profile/user fetch persistence from `controllers/auth/index.js` into repository methods.
4. Added `repositories/pageRepository.js`, and moved page-facing query/aggregate logic from `controllers/pageController.js` into repository methods for product/search/profile/dashboard/orders/tracking flows.
5. `controllers/product/index.js`, `controllers/orders/index.js`, `controllers/orders/dispute.js`, `controllers/chat/index.js`, `controllers/chat/conversation.js`, `controllers/walletController.js`, `controllers/notificationController.js`, `controllers/checkout/index.js`, `controllers/rating/index.js`, `controllers/admin/index.js`, `controllers/auth/index.js`, and `controllers/pageController.js` now route critical query construction through repositories instead of controller-owned model queries.
6. `scripts/test-architecture-repositories.js` now enforces repository usage across the extracted API/controllers and verifies core repository filter/query helpers.
- Why it matters:
1. Current service layer is better, but data access still leaks into controllers/services in too many places.
- Required work:
1. Create `repositories/` for `orders`, `payments`, `products`, `chat`, `ratings`, `notifications`, `wallet`.
2. Move query construction, populate/projection, aggregate pipelines, and ownership-scoped fetches into repositories.
3. Keep controllers free of direct model calls except trivial page rendering cases, then remove those too.
- Evidence required:
1. Search result showing controller direct model usage is near-zero for API controllers.
2. Unit tests for repository methods on critical flows.

### FE-201 Eliminate unsafe DOM string rendering project-wide
- Status: DONE
- Progress notes:
1. `public/js/` and `views/` now have zero remaining `innerHTML`, `outerHTML`, and `insertAdjacentHTML` usage.
2. Repo-wide DOM HTML API inventory is now snapshotted in `docs/evidence/fe-201-dom-usage.txt` and enforced by `scripts/audit-dom-html-apis.js`.
3. High-risk user-data renderers across search, ratings, notifications, favorites, dashboard tables, checkout, sell, disputes, profile, payment, login, order-tracking, and the home page catalog are now using DOM node construction instead of HTML string sinks.
- Why it matters:
1. Current hardening covered selected modules, but many `innerHTML` and `insertAdjacentHTML` usages remain in page scripts.
- Required work:
1. Audit every `innerHTML`, `outerHTML`, and `insertAdjacentHTML` usage under `public/js/` and `views/`.
2. Replace user-data paths with DOM API or centralized sanitization helper.
3. Ban new unsafe HTML APIs in lint/security checks.
- Evidence required:
1. `rg` report with only approved static-only usages remaining, or zero dynamic usages.
2. Security test payload matrix covering chat, notifications, search, favorites, dashboard tables, and seller flows.

### PERF-201 Baseline vs improved p95 report
- Status: IN_PROGRESS
- Progress notes:
1. Fixed `scripts/benchmark-p95.js` default endpoint set to required scope (`/api/products`, `/api/chat`, `/api/orders`, `/api/admin/reports`) and hardened pass/fail so zero-sample runs fail.
2. Added `scripts/evaluate-p95-budgets.js` plus `npm run bench:p95:budget` to enforce explicit endpoint p95/error budgets and emit evidence artifacts under `docs/evidence/`.
3. Collected two fresh benchmark artifacts on 2026-05-23 and generated a budget report; `/api/products` is still unreachable in current local runtime due missing DB-ready seeded baseline, so PERF-201 cannot be marked done yet.
4. Extended `scripts/benchmark-p95.js` to support authenticated and reproducible captures (`--header`, `--cookie`, `BENCH_HEADERS_JSON`, `BENCH_AUTH_BEARER`, `BENCH_COOKIE`) plus warmup requests.
- Why it matters:
1. Current score cannot reach 9.5 without measured performance gains.
- Required work:
1. Run `bench:p95` on baseline-like and hardened states against stable seeded data.
2. Produce before/after p95 results for `/api/products`, `/api/chat`, `/api/orders`, `/api/admin/reports`.
3. Add explicit performance budget thresholds and pass/fail rules.
- Evidence required:
1. JSON artifacts under `docs/evidence/`.
2. Summary report with p50/p95/error rate and interpretation.

### DB-201 Runtime concurrency proof
- Status: IN_PROGRESS
- Progress notes:
1. Hardened `scripts/test-concurrency-runtime.js` to avoid false positives by enforcing explicit reachability, error-rate budget checks, and optional status allowlist checks.
2. Updated runtime evidence defaults in `scripts/collect-runtime-evidence.js` to use explicit error-rate and success/conflict expectations.
3. Extended hardening controls (`scripts/test-hardening-controls.js`) to verify DB-201 runtime harness guards are present and test-enforced.
4. Captured fresh local runtime harness output on 2026-05-23; current environment still reports `unreachable_target_or_all_requests_failed` for `/api/orders`, so DB-201 remains blocked pending seeded reachable runtime.
- Why it matters:
1. Control markers are not enough for a 9.5-grade score.
- Required work:
1. Run real runtime concurrency tests for order create, payment replay, payout reject refund, wallet payout request.
2. Seed dedicated test fixtures for stock=1, duplicate webhook, repeated payout action, and wallet threshold checks.
3. Persist evidence and invariants after each run.
- Evidence required:
1. Runtime concurrency artifacts showing no invariant break.
2. Post-run DB consistency checks.

### SEC-201 Security posture beyond core controls
- Status: DONE
- Progress notes:
1. Added centralized security middleware in `middleware/security.js` with enforced CSP and baseline response security headers.
2. Added targeted rate limiting controls for auth routes, chat send, AI describe, payment status checks, and report submission.
3. Added abuse logging hooks for repeated `401/403` authz failures and suspicious webhook secret failures.
4. Added explicit auth token rotation/session policy controls (`AUTH_REFRESH_ROTATE_WINDOW_SECONDS`, `AUTH_SESSION_MAX_AGE_SECONDS`) and enforced refresh-window checks in `controllers/auth/index.js`.
5. Centralized auth cookie policy controls (`AUTH_COOKIE_MAX_AGE_MS`, `AUTH_COOKIE_SAMESITE`, `FORCE_SECURE_COOKIES`) via `utils/authSecurity.js` and reused them in auth flows.
6. Extended hardening controls and security checks (`scripts/security-check.js`, `scripts/test-security-integration-lite.js`, `scripts/test-hardening-controls.js`) so these controls fail fast when missing.
7. Added endpoint-level rate-limit integration test (`scripts/test-security-rate-limit-endpoints.js`) and wired it into hardening controls to verify real `429` behavior on mounted API paths.
- Why it matters:
1. CSRF and ownership are good, but 9.5 requires a more complete posture.
- Required work:
1. Add CSP.
2. Add rate limiting for login, chat send, AI endpoint, payment check, and report submission.
3. Add abuse logging for repeated authz failures and suspicious webhook access.
4. Review cookie flags, session lifetime, and token rotation rules.
- Evidence required:
1. Security checklist with pass/fail lines.
2. Integration tests for rate-limited and header-enforced flows.

## P1 - High-value improvements

### API-201 Full OpenAPI coverage for critical surface
- Status: TODO
- Required work:
1. Cover auth, products, orders, chat, payments, ratings, notifications, admin moderation, wallet, and reports.
2. Define shared schemas for pagination, error envelope, ownership failures, validation failures.
3. Make docs match actual status codes and examples.
- Evidence required:
1. OpenAPI lint/validation pass.
2. Contract presence check in CI.

### VAL-201 Validate params, query, and multipart with same rigor as body
- Status: TODO
- Required work:
1. Add param schemas for every `:id` route.
2. Add query schemas for filters, pagination, sort, and dashboard analytics inputs.
3. Normalize upload validation results into same error envelope shape.
- Evidence required:
1. Coverage matrix includes body, params, query, and upload.
2. Negative tests prove all invalid path/query values fail early.

### ARCH-202 Remove business logic from page controllers and view helpers
- Status: TODO
- Required work:
1. Move page data assembly and permission logic into services.
2. Keep page controllers focused on request parsing and rendering only.
3. Reduce giant page-specific branches in `pageController.js`.
- Evidence required:
1. `pageController.js` shrinks materially.
2. Page services are independently testable.

### PERF-202 Frontend render cost reduction
- Status: TODO
- Required work:
1. Move remaining heavy inline logic out of EJS.
2. Reduce table/list rendering churn on dashboard, index, seller pages, and notifications.
3. Avoid repeated full-container re-renders where incremental updates are enough.
- Evidence required:
1. Largest page scripts are smaller and more modular.
2. Simple browser-profile notes recorded in docs.

### DB-202 Explain-plan review on hot queries
- Status: TODO
- Required work:
1. Record explain output for top list/read queries.
2. Verify each hot query uses intended index.
3. Remove any index that adds write cost without measurable read benefit.
- Evidence required:
1. Explain-plan appendix in `docs/index-catalog.md`.
2. Query-to-index mapping table.

## P2 - Cleanup needed for 9.5 polish

### FO-201 Frontend asset rationalization
- Status: TODO
- Required work:
1. Merge or reorganize page CSS into shared, layout, and feature layers.
2. Remove dead or duplicate client code.
3. Standardize naming and placement for utility/page scripts.
- Evidence required:
1. Short asset map doc.
2. Fewer orphaned CSS and JS files.

### CONF-201 Startup config validation
- Status: DONE
- Progress notes:
1. Added centralized startup env schema validation in `config/env.js` using `zod`, with fail-fast error reporting.
2. Wired `validateEnv()` into app bootstrap in `app.js` before DB connection and route initialization.
3. Implemented production-only required config gates plus provider-specific AI key requirements.
4. Aligned `.env.example` and `ENV_SETUP.md` with runtime validation knobs and failure expectations.
5. Extended hardening/security checks (`scripts/security-check.js`, `scripts/test-hardening-controls.js`) so config-validation controls fail fast if removed.
- Required work:
1. Validate env vars on startup using schema.
2. Fail fast on missing or inconsistent config.
3. Separate development-only and production-required env rules.
- Evidence required:
1. Startup validation module.
2. `.env.example` and `ENV_SETUP.md` aligned with runtime checks.

### DOC-201 Single operator runbook
- Status: TODO
- Required work:
1. Create one runbook for local setup, test gates, migrations, evidence collection, and release checks.
2. Link all scripts and docs from one place.
- Evidence required:
1. One canonical runbook path.
2. All commands verified against repo scripts.

## Stretch work for 9.5+

### SEC-202 Threat model and residual risk register
- Status: TODO
- Required work:
1. Document assets, trust boundaries, actors, abuse cases, and mitigations.
2. Keep residual risks explicit instead of implied.

### QA-201 Release-quality gate suite
- Status: TODO
- Required work:
1. Add one command that runs lint, smoke, hardening, ownership, concurrency-runtime, and p95 evidence collection for staging.
2. Publish release gate output artifact.
