# SEC-201 Security Posture Checklist

Date: 2026-05-23
Status: Completed

## Implemented controls

1. CSP + baseline security headers are enforced globally via `middleware/security.js` and mounted in `app.js`.
2. Route-level rate limiting is enforced for:
   - `POST /api/chat/:id/messages`
   - `POST /api/ai/describe`
   - `GET /api/payments/:paymentId/check`
   - `POST /api/report`
   - `/api/auth/*` surface
3. Abuse monitoring:
   - repeated `401/403` responses are tracked and logged (`monitorAuthzFailures`)
   - invalid webhook secret attempts are logged as `suspicious_webhook_access`
4. Auth refresh-token rotation policy is enforced via `shouldAllowRefresh`:
   - refresh only within `AUTH_REFRESH_ROTATE_WINDOW_SECONDS`
   - hard cap via `AUTH_SESSION_MAX_AGE_SECONDS`
5. Auth cookie policy is centralized (`AUTH_COOKIE_MAX_AGE_MS`, `AUTH_COOKIE_SAMESITE`, `FORCE_SECURE_COOKIES`) and reused by auth cookie set/clear flows.

## Verification evidence

1. `node scripts/security-check.js` passed.
2. `node scripts/test-security-integration-lite.js` passed, including CSP header and rate-limiter behavior checks.
3. `node scripts/test-hardening-controls.js` passed with SEC-201 checks for CSP, route limiter wiring, and webhook abuse logging marker.
4. `node scripts/test-security-integration-lite.js` includes refresh policy checks for:
   - near-expiry allow
   - early-refresh deny
   - session-max-age deny
5. `node scripts/test-security-rate-limit-endpoints.js` passed with endpoint-level `429` checks for:
   - `POST /api/auth/refresh`
   - `POST /api/chat/:id/messages`
   - `POST /api/ai/describe`
   - `GET /api/payments/:paymentId/check`
   - `POST /api/report`
6. `node scripts/test-hardening-controls.js` now includes and passes `SEC-201 endpoint-level rate-limit integration`.

## Remaining for SEC-201 completion

1. No remaining blockers for SEC-201 in backlog scope.
