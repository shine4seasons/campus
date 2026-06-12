const { authStateFromToken, TOKEN_AUTH_REASONS } = require('./resolveUser');
const { getAuthCookieOptions, getCsrfCookieOptions } = require('../utils/authSecurity');

function clearAuthCookies(res) {
  const authOptions = getAuthCookieOptions();
  const csrfOptions = getCsrfCookieOptions();
  res.clearCookie('token', {
    httpOnly: authOptions.httpOnly,
    secure: authOptions.secure,
    sameSite: authOptions.sameSite
  });
  res.clearCookie('csrf', {
    httpOnly: csrfOptions.httpOnly,
    secure: csrfOptions.secure,
    sameSite: csrfOptions.sameSite
  });
}

const protect = async (req, res, next) => {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const { user, reason } = await authStateFromToken(token);
  req.user = user;
  if (!req.user) {
    if (reason === TOKEN_AUTH_REASONS.ACCOUNT_BANNED) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        code: TOKEN_AUTH_REASONS.ACCOUNT_BANNED,
        message: 'This account has been banned'
      });
    }
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
  next();
};

const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};

module.exports = { protect, restrictTo };
