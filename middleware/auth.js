const { userFromToken } = require('./resolveUser');

const protect = async (req, res, next) => {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  req.user = await userFromToken(token);
  if (!req.user) {
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
