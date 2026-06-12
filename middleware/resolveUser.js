const jwt = require('jsonwebtoken');
const User = require('../models/User');

const TOKEN_AUTH_REASONS = Object.freeze({
  MISSING_TOKEN: 'MISSING_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_USER: 'INVALID_USER',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',
});

const authStateFromToken = async (token) => {
  if (!token) return { user: null, reason: TOKEN_AUTH_REASONS.MISSING_TOKEN };
  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(sub).select('-__v -googleId').lean();
    if (!user) return { user: null, reason: TOKEN_AUTH_REASONS.INVALID_USER };
    if (user.banned) return { user: null, reason: TOKEN_AUTH_REASONS.ACCOUNT_BANNED };
    return { user, reason: null };
  } catch {
    return { user: null, reason: TOKEN_AUTH_REASONS.INVALID_TOKEN };
  }
};

const userFromToken = async (token) => {
  const { user } = await authStateFromToken(token);
  return user;
};

module.exports = { authStateFromToken, userFromToken, TOKEN_AUTH_REASONS };
