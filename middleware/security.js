const RATE_STATE = new Map();
const AUTHZ_FAILURE_STATE = new Map();

function readPositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getClientIp(req) {
  const xff = req.get('x-forwarded-for');
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function cleanupState(map, now) {
  for (const [key, bucket] of map.entries()) {
    if (bucket.resetAt <= now) {
      map.delete(key);
    }
  }
}

function createRateLimiter({ name, windowMs, max, keyFn }) {
  if (!name) throw new Error('rate limiter name is required');
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error('windowMs must be > 0');
  if (!Number.isFinite(max) || max <= 0) throw new Error('max must be > 0');

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    if (RATE_STATE.size > 10000) cleanupState(RATE_STATE, now);

    const ip = getClientIp(req);
    const suffix = keyFn ? keyFn(req) : '';
    const key = `${name}:${ip}:${suffix}`;
    const current = RATE_STATE.get(key);

    if (!current || current.resetAt <= now) {
      RATE_STATE.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count <= max) {
      return next();
    }

    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    res.set('Retry-After', String(Math.max(retryAfter, 1)));
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.'
    });
  };
}

function applySecurityHeaders(req, res, next) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline' https:",
    "script-src 'self' 'unsafe-inline' https:",
    "worker-src 'self' blob:",
    "connect-src 'self' https: wss:",
    "font-src 'self' data: https:"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  return next();
}

function monitorAuthzFailures(req, res, next) {
  const startedAt = Date.now();
  const ip = getClientIp(req);
  const path = req.originalUrl || req.url;

  res.on('finish', () => {
    if (res.statusCode !== 401 && res.statusCode !== 403) return;
    const now = Date.now();
    if (AUTHZ_FAILURE_STATE.size > 10000) cleanupState(AUTHZ_FAILURE_STATE, now);

    const key = `${ip}:${path}`;
    const current = AUTHZ_FAILURE_STATE.get(key);
    if (!current || current.resetAt <= now) {
      AUTHZ_FAILURE_STATE.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
      return;
    }

    current.count += 1;
    if (current.count >= 5) {
      const logger = require('../utils/logger');
      logger.warn('security.repeated_authz_failure', {
        ip,
        path,
        method: req.method,
        status: res.statusCode,
        count: current.count,
        latencyMs: Date.now() - startedAt
      });
    }
  });

  return next();
}

const limitAuth = createRateLimiter({
  name: 'auth',
  windowMs: readPositiveIntEnv('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000),
  max: readPositiveIntEnv('RATE_LIMIT_AUTH_MAX', 60)
});
const limitChatSend = createRateLimiter({
  name: 'chat-send',
  windowMs: readPositiveIntEnv('RATE_LIMIT_CHAT_SEND_WINDOW_MS', 60 * 1000),
  max: readPositiveIntEnv('RATE_LIMIT_CHAT_SEND_MAX', 30)
});
const limitAiDescribe = createRateLimiter({
  name: 'ai-describe',
  windowMs: readPositiveIntEnv('RATE_LIMIT_AI_DESCRIBE_WINDOW_MS', 60 * 1000),
  max: readPositiveIntEnv('RATE_LIMIT_AI_DESCRIBE_MAX', 10)
});
const limitPaymentCheck = createRateLimiter({
  name: 'payment-check',
  windowMs: readPositiveIntEnv('RATE_LIMIT_PAYMENT_CHECK_WINDOW_MS', 60 * 1000),
  max: readPositiveIntEnv('RATE_LIMIT_PAYMENT_CHECK_MAX', 20)
});
const limitReportSubmit = createRateLimiter({
  name: 'report-submit',
  windowMs: readPositiveIntEnv('RATE_LIMIT_REPORT_SUBMIT_WINDOW_MS', 10 * 60 * 1000),
  max: readPositiveIntEnv('RATE_LIMIT_REPORT_SUBMIT_MAX', 10)
});

module.exports = {
  applySecurityHeaders,
  monitorAuthzFailures,
  createRateLimiter,
  limitAuth,
  limitChatSend,
  limitAiDescribe,
  limitPaymentCheck,
  limitReportSubmit
};
