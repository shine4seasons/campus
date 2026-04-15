const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Đọc JWT từ httpOnly cookie → đính vào res.locals.user
 * Mọi EJS template đều dùng được: <%= user?.name %>
 */
const injectUser = async (req, res, next) => {
  res.locals.user = null;
  
  // Helper to render stars in EJS
  res.locals.renderStars = (score, size = 16) => {
    const s = parseFloat(score || 0);
    const fullStars = Math.floor(s);
    const hasHalf = s % 1 >= 0.5;
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        html += `<span class="star star-filled" style="font-size:${size}px">★</span>`;
      } else if (i === fullStars + 1 && hasHalf) {
        html += `<span class="star star-half" style="font-size:${size}px">★</span>`;
      } else {
        html += `<span class="star star-empty" style="font-size:${size}px">★</span>`;
      }
    }
    return html;
  };

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
