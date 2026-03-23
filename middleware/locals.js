const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Đọc JWT từ httpOnly cookie → đính vào res.locals.user
 * Mọi EJS template đều dùng được: <%= user?.name %>
 */
const injectUser = async (req, res, next) => {
  res.locals.user = null;
  const token = req.cookies?.token;
  if (!token) return next();

  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    res.locals.user = await User.findById(sub).select('-__v').lean();
  } catch {
    // Token hết hạn hoặc không hợp lệ → xóa cookie
    res.clearCookie('token');
  }

  next();
};

module.exports = injectUser;
