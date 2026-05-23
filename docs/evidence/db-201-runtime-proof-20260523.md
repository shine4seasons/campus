# DB-201 Runtime Concurrency Proof

Date: 2026-05-23
Status: In progress

## What changed in this pass

1. `scripts/test-concurrency-runtime.js` now enforces stronger runtime invariants:
   - fails when target is unreachable (`responded === 0`)
   - enforces error-rate budget (`expectMaxErrorRate`)
   - supports min/max `2xx` constraints
   - supports optional explicit status allowlist checks
2. `scripts/collect-runtime-evidence.js` default concurrency args now include explicit error-rate expectation.
3. `scripts/test-hardening-controls.js` now includes DB-201 checks for runtime harness safety guards.
4. `scripts/verify-concurrency-invariants.js` now verifies seeded post-run data invariants for:
   - `order-create`
   - `payment-paid`
   - `payout-refund`
5. `scripts/collect-runtime-evidence.js` can now persist a `concurrency-invariants-*.json` artifact when `EVIDENCE_VERIFY_ARGS` is provided.

## Verification in current local environment

1. `node scripts/test-concurrency-runtime.js --base=http://127.0.0.1:5000 --endpoint=/api/orders --method=POST --total=10 --concurrency=5 --expect-min-2xx=0 --expect-max-2xx=1 --expect-min-conflict=0 --expect-max-error-rate=0.2`
2. Result: `pass=false`, `reason=unreachable_target_or_all_requests_failed`

This is expected in current local context and is now correctly reported as failure (no false pass).

## Remaining blocker for DB-201 completion

1. Need seeded, reachable runtime scenarios for:
   - order create (stock=1 race)
   - payment replay/idempotency
   - payout reject refund replay
   - wallet payout threshold races
2. Need final runtime executions that produce non-empty invariant artifacts against a reachable app + DB.
