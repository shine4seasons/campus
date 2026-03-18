const jwt = require('jsonwebtoken');

// ── Helpers ──────────────────────────────────────────────

const signToken = (userId) =>
  jwt.sign(
    { sub: userId.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

const sendTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,                              // XSS protection
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,            // 7 ngày
  });
};

// ── Controllers ──────────────────────────────────────────

/**
 * GET /api/auth/google/callback
 * Passport gọi sau khi Google xác thực xong.
 * Tạo JWT, set cookie, redirect về frontend.
 */
const googleCallback = (req, res) => {
  const token = signToken(req.user._id);
  sendTokenCookie(res, token);

  // Redirect với token trong query (FE sẽ lưu vào memory)
res.redirect(`${process.env.CLIENT_URL}/pages/callback.html?token=${token}`);
};

/**
 * GET /api/auth/me
 * Trả về thông tin user hiện tại (cần JWT).
 */
const getMe = (req, res) => {
  res.json({ success: true, data: req.user });
};

/**
 * POST /api/auth/logout
 * Xoá cookie, phía FE tự clear store.
 */
const logout = (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out' });
};

/**
 * POST /api/auth/refresh
 * Cấp lại token mới nếu cookie còn hợp lệ.
 */
const refresh = (req, res) => {
  const oldToken = req.cookies?.token;
  if (!oldToken) return res.status(401).json({ success: false });

  try {
    const { sub } = jwt.verify(oldToken, process.env.JWT_SECRET);
    const newToken = signToken(sub);
    sendTokenCookie(res, newToken);
    res.json({ success: true, token: newToken });
  } catch {
    res.clearCookie('token').status(401).json({ success: false });
  }
};

module.exports = { googleCallback, getMe, logout, refresh };