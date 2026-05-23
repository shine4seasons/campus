const DEFAULT_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_REFRESH_ROTATION_WINDOW_SECONDS = 24 * 60 * 60;
const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getCookieSameSite() {
  const raw = String(process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase();
  if (raw === 'strict' || raw === 'lax' || raw === 'none') return raw;
  return 'lax';
}

function useSecureCookies() {
  if (String(process.env.FORCE_SECURE_COOKIES || '').toLowerCase() === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

function getAuthCookieMaxAgeMs() {
  return readPositiveInt(process.env.AUTH_COOKIE_MAX_AGE_MS, DEFAULT_COOKIE_MAX_AGE_MS);
}

function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: getCookieSameSite(),
    maxAge: getAuthCookieMaxAgeMs()
  };
}

function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: useSecureCookies(),
    sameSite: getCookieSameSite(),
    maxAge: getAuthCookieMaxAgeMs()
  };
}

function getRefreshRotationWindowSeconds() {
  return readPositiveInt(process.env.AUTH_REFRESH_ROTATE_WINDOW_SECONDS, DEFAULT_REFRESH_ROTATION_WINDOW_SECONDS);
}

function getSessionMaxAgeSeconds() {
  return readPositiveInt(process.env.AUTH_SESSION_MAX_AGE_SECONDS, DEFAULT_SESSION_MAX_AGE_SECONDS);
}

function shouldAllowRefresh(decodedToken, nowSeconds = Math.floor(Date.now() / 1000)) {
  const exp = Number(decodedToken?.exp);
  const iat = Number(decodedToken?.iat);
  if (!Number.isFinite(exp) || !Number.isFinite(iat)) {
    return { ok: false, reason: 'INVALID_TOKEN_TIMESTAMPS' };
  }

  const sessionAgeSeconds = Math.max(0, nowSeconds - iat);
  if (sessionAgeSeconds > getSessionMaxAgeSeconds()) {
    return { ok: false, reason: 'SESSION_MAX_AGE_EXCEEDED' };
  }

  const secondsUntilExpiry = exp - nowSeconds;
  if (secondsUntilExpiry > getRefreshRotationWindowSeconds()) {
    return { ok: false, reason: 'TOKEN_NOT_IN_ROTATION_WINDOW' };
  }

  return { ok: true };
}

module.exports = {
  getAuthCookieOptions,
  getCsrfCookieOptions,
  shouldAllowRefresh
};
