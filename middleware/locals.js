const { userFromToken } = require('./resolveUser');

/**
 * Read the JWT from the httpOnly cookie and expose the user on res.locals.
 */
const injectUser = async (req, res, next) => {
  res.locals.user = null;

  const requestedMode = req.cookies?.campus_mode;
  res.locals.mode = requestedMode === 'seller' ? 'seller' : 'buyer';
  req.mode = res.locals.mode;

  res.locals.renderStars = (score, size = 16) => {
    const numericScore = parseFloat(score || 0);
    const fullStars = Math.floor(numericScore);
    const hasHalf = numericScore % 1 >= 0.5;
    let html = '';

    for (let index = 1; index <= 5; index += 1) {
      if (index <= fullStars) {
        html += `<span class="star star-filled" style="font-size:${size}px">&#9733;</span>`;
      } else if (index === fullStars + 1 && hasHalf) {
        html += `<span class="star star-half" style="font-size:${size}px">&#9733;</span>`;
      } else {
        html += `<span class="star star-empty" style="font-size:${size}px">&#9733;</span>`;
      }
    }

    return html;
  };

  res.locals.formatVND = (value) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) || 0);

  const token = req.cookies?.token;
  if (!token) {
    return next();
  }

  res.locals.user = await userFromToken(token);
  req.user = res.locals.user;
  if (!res.locals.user) {
    res.clearCookie('token');
  }

  if (!res.locals.user && res.locals.mode === 'seller') {
    res.locals.mode = 'buyer';
    req.mode = 'buyer';
  }

  return next();
};

module.exports = injectUser;
