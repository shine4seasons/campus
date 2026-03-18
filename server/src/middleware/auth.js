const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect — bắt buộc phải có JWT hợp lệ.
 * Token được đọc từ: 1) cookie  2) Authorization header
 */
const protect = async (req, res, next) => {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(sub).select('-__v').lean();

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    res.status(401).json({ success: false, message: msg });
  }
};

/**
 * restrictTo(...roles) — phân quyền theo role.
 * Dùng sau protect.
 * Ví dụ: router.delete('/:id', protect, restrictTo('admin'), handler)
 */
const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};

module.exports = { protect, restrictTo };