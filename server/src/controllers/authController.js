const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (userId) =>
  jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

const sendTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });
};

// GET /api/auth/google/callback
const googleCallback = async (req, res) => {
  const token = signToken(req.user._id);

  sendTokenCookie(res, token);

  // Fetch user từ DB để check profileComplete status
  const user = await User.findById(req.user._id);
  const isProfileComplete = user?.profileComplete || false;
console.log("com: "+user?.profileComplete);
console.log("new: "+user?.isNewUser);
  // User chưa hoàn thiện profile → login.html?step=setup để hiện form onboarding
  // User đã hoàn thiện → callback.html để lưu token và vào home
  const redirectPath = !isProfileComplete
    ? `${process.env.CLIENT_URL}/pages/login.html?step=setup&token=${token}`
    : `${process.env.CLIENT_URL}/pages/callback.html?token=${token}`;

  res.redirect(redirectPath);
};

// GET /api/auth/me
const getMe = (req, res) => {
  res.json({ success: true, data: req.user });
};

// POST /api/auth/logout
const logout = (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
};

// POST /api/auth/refresh
const refresh = (req, res) => {
  const old = req.cookies?.token;
  if (!old) return res.status(401).json({ success: false });
  try {
    const { sub } = jwt.verify(old, process.env.JWT_SECRET);
    const newToken = signToken(sub);
    sendTokenCookie(res, newToken);
    res.json({ success: true, token: newToken });
  } catch {
    res.clearCookie('token').status(401).json({ success: false });
  }
};

// PATCH /api/auth/profile — lưu onboarding data
// Không cho phép đổi role, email, googleId qua đây
const updateProfile = async (req, res) => {
  const ALLOWED = ['nickname', 'phone', 'university', 'studentId', 'bio', 'profileComplete'];
  const updates = {};
  ALLOWED.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-__v -googleId');

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { googleCallback, getMe, logout, refresh, updateProfile };
