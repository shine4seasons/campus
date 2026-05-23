# CONF-201 Startup Config Validation

Date: 2026-05-23
Status: Completed

## Implemented controls

1. Startup env schema validator added at `config/env.js`.
2. App bootstrap now executes `validateEnv()` in `app.js` before DB connect and route setup.
3. Validation enforces:
   - core required config and type/format checks
   - production-only required variables
   - provider-specific AI key requirements
4. Validation fails fast with explicit `Environment validation failed: ...` messages.

## Verification

1. `node scripts/security-check.js` passed.
2. `node scripts/test-hardening-controls.js` passed, including:
   - `CONF-201 startup env validator exists`
   - `CONF-201 app boots with env validation`
3. `node scripts/test-smoke.js` passed.

## Operator alignment

1. `.env.example` contains validator-aligned keys and defaults.
2. `ENV_SETUP.md` documents startup validation behavior and production-only requirements.
