const { csrfGuard } = require('../middleware/csrf');
const { applySecurityHeaders, createRateLimiter } = require('../middleware/security');
const { shouldAllowRefresh } = require('../utils/authSecurity');

let failed = 0;

function check(name, cond, detail = '') {
  if (cond) {
    console.log(`[PASS] ${name}`);
    return;
  }
  failed += 1;
  console.error(`[FAIL] ${name}${detail ? ` :: ${detail}` : ''}`);
}

function runCsrfGuardCases() {
  const mkRes = () => {
    const out = { statusCode: null, body: null };
    out.status = (code) => {
      out.statusCode = code;
      return out;
    };
    out.json = (payload) => {
      out.body = payload;
      return out;
    };
    return out;
  };

  // Safe method should pass through.
  {
    const req = { method: 'GET', cookies: {}, get() { return undefined; } };
    const res = mkRes();
    let nextCalled = false;
    csrfGuard(req, res, () => { nextCalled = true; });
    check('CSRF safe method pass-through', nextCalled && res.statusCode === null);
  }

  // No cookie-auth should pass through (token auth not cookie-based).
  {
    const req = { method: 'POST', cookies: {}, get() { return undefined; } };
    const res = mkRes();
    let nextCalled = false;
    csrfGuard(req, res, () => { nextCalled = true; });
    check('CSRF skip when no cookie auth', nextCalled && res.statusCode === null);
  }

  // Cookie auth + missing header should fail.
  {
    const req = { method: 'POST', cookies: { token: 't', csrf: 'a' }, get() { return undefined; } };
    const res = mkRes();
    let nextCalled = false;
    csrfGuard(req, res, () => { nextCalled = true; });
    check('CSRF reject missing header token', !nextCalled && res.statusCode === 403);
  }

  // Cookie auth + mismatch should fail.
  {
    const req = { method: 'PATCH', cookies: { token: 't', csrf: 'a' }, get() { return 'b'; } };
    const res = mkRes();
    let nextCalled = false;
    csrfGuard(req, res, () => { nextCalled = true; });
    check('CSRF reject mismatched token', !nextCalled && res.statusCode === 403);
  }

  // Cookie auth + match should pass.
  {
    const req = { method: 'DELETE', cookies: { token: 't', csrf: 'a' }, get() { return 'a'; } };
    const res = mkRes();
    let nextCalled = false;
    csrfGuard(req, res, () => { nextCalled = true; });
    check('CSRF accept matching token', nextCalled && res.statusCode === null);
  }
}

function runSecurityHeaderChecks() {
  const req = { get() { return undefined; } };
  const headers = {};
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    }
  };
  let nextCalled = false;
  applySecurityHeaders(req, res, () => { nextCalled = true; });

  check('SEC-201 security header middleware calls next', nextCalled);
  check('SEC-201 sets CSP header', typeof headers['Content-Security-Policy'] === 'string' && headers['Content-Security-Policy'].includes("default-src 'self'"));
  check('SEC-201 sets nosniff header', headers['X-Content-Type-Options'] === 'nosniff');
}

function runRateLimiterChecks() {
  const limiter = createRateLimiter({
    name: 'test-rate',
    windowMs: 1000,
    max: 2
  });

  const mkReq = () => ({
    method: 'POST',
    ip: '127.0.0.1',
    originalUrl: '/api/test',
    url: '/api/test',
    socket: { remoteAddress: '127.0.0.1' },
    get() { return undefined; }
  });

  const mkRes = () => {
    const out = { statusCode: null, body: null, headers: {} };
    out.set = (name, value) => {
      out.headers[name] = value;
      return out;
    };
    out.status = (code) => {
      out.statusCode = code;
      return out;
    };
    out.json = (payload) => {
      out.body = payload;
      return out;
    };
    return out;
  };

  {
    const req = mkReq();
    const res = mkRes();
    let nextCalled = false;
    limiter(req, res, () => { nextCalled = true; });
    check('SEC-201 rate limiter first request allowed', nextCalled && res.statusCode === null);
  }

  {
    const req = mkReq();
    const res = mkRes();
    let nextCalled = false;
    limiter(req, res, () => { nextCalled = true; });
    check('SEC-201 rate limiter second request allowed', nextCalled && res.statusCode === null);
  }

  {
    const req = mkReq();
    const res = mkRes();
    let nextCalled = false;
    limiter(req, res, () => { nextCalled = true; });
    check('SEC-201 rate limiter blocks over limit', !nextCalled && res.statusCode === 429 && res.body?.code === 'RATE_LIMITED');
  }
}

function runTokenRefreshPolicyChecks() {
  const now = 1_700_000_000;

  {
    const result = shouldAllowRefresh({ exp: now + 300, iat: now - 3600 }, now);
    check('SEC-201 refresh policy allows near-expiry token', result.ok === true);
  }

  {
    const result = shouldAllowRefresh({ exp: now + 3 * 24 * 3600, iat: now - 3600 }, now);
    check('SEC-201 refresh policy blocks early refresh', result.ok === false && result.reason === 'TOKEN_NOT_IN_ROTATION_WINDOW');
  }

  {
    const result = shouldAllowRefresh({ exp: now + 300, iat: now - 31 * 24 * 3600 }, now);
    check('SEC-201 refresh policy enforces max session age', result.ok === false && result.reason === 'SESSION_MAX_AGE_EXCEEDED');
  }
}

function main() {
  runCsrfGuardCases();
  runSecurityHeaderChecks();
  runRateLimiterChecks();
  runTokenRefreshPolicyChecks();
  if (failed > 0) {
    console.error(`\nSecurity integration-lite test failed: ${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nSecurity integration-lite test passed.');
}

main();
