const jwt  = require('jsonwebtoken');
const crypto = require('crypto');
const { ALLOWED_PROFILE_FIELDS } = require('./constants');
const authRepository = require('../../repositories/authRepository');
const {
  getAuthCookieOptions,
  getCsrfCookieOptions,
  shouldAllowRefresh
} = require('../../utils/authSecurity');

const signToken = (userId) =>
  jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

const sendTokenCookie = (res, token) => {
  res.cookie('token', token, getAuthCookieOptions());
  res.cookie('csrf', crypto.randomBytes(24).toString('hex'), getCsrfCookieOptions());
};

const clearAuthCookies = (res) => {
  // Keep cookie options aligned with issue options so clearCookie targets the same cookie shape.
  res.clearCookie('token', {
    httpOnly: getAuthCookieOptions().httpOnly,
    secure: getAuthCookieOptions().secure,
    sameSite: getAuthCookieOptions().sameSite
  });
  res.clearCookie('csrf', {
    httpOnly: getCsrfCookieOptions().httpOnly,
    secure: getCsrfCookieOptions().secure,
    sameSite: getCsrfCookieOptions().sameSite
  });
};

// GET /api/auth/google/callback
const googleCallback = async (req, res) => {
  const token = signToken(req.user._id);
  sendTokenCookie(res, token);

  const user = await authRepository.findUserById(req.user._id);
  const isProfileComplete = user?.profileComplete || false;

  const redirectPath = !isProfileComplete
    ? `${process.env.CLIENT_URL}/login?step=setup`
    : `${process.env.CLIENT_URL}/`;

  res.redirect(redirectPath);
};

// GET /api/auth/me
const getMe = (req, res) => {
  res.json({ success: true, data: req.user });
};

// POST /api/auth/logout
const logout = (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true });
};

// Clear auth cookie and redirect to login (used by server-rendered pages)
const logoutRedirect = (req, res) => {
  clearAuthCookies(res);
  res.redirect('/login');
};

// POST /api/auth/refresh
const refresh = (req, res) => {
  const old = req.cookies?.token;
  if (!old) return res.status(401).json({ success: false });
  try {
    const decoded = jwt.verify(old, process.env.JWT_SECRET);
    const refreshPolicy = shouldAllowRefresh(decoded);
    if (!refreshPolicy.ok) {
      return res.status(401).json({
        success: false,
        code: refreshPolicy.reason,
        message: 'Refresh denied by token rotation policy'
      });
    }
    const { sub } = decoded;
    const newToken = signToken(sub);
    sendTokenCookie(res, newToken);
    res.json({ success: true, token: newToken });
  } catch {
    clearAuthCookies(res);
    res.status(401).json({ success: false });
  }
};

// PATCH /api/auth/profile
const updateProfile = async (req, res, next) => {
  const updates = {};
  ALLOWED_PROFILE_FIELDS.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  try {
    const user = await authRepository.updateUserProfileById(req.user._id, updates);

    res.json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
};

module.exports = { googleCallback, getMe, logout, refresh, updateProfile, logoutRedirect };
