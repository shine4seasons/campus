const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function issueCsrfCookie(req, res, next) {
  if (!req.cookies?.csrf) {
    res.cookie('csrf', crypto.randomBytes(24).toString('hex'), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  return next();
}

function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const hasCookieAuth = Boolean(req.cookies?.token);
  if (!hasCookieAuth) return next();

  const headerToken = req.get('x-csrf-token');
  const cookieToken = req.cookies?.csrf;
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ success: false, message: 'CSRF check failed' });
  }
  return next();
}

module.exports = { issueCsrfCookie, csrfGuard };

