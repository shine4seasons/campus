const jwt = require('jsonwebtoken');
const User = require('../models/User');

const userFromToken = async (token) => {
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    return await User.findById(sub).select('-__v -googleId').lean();
  } catch {
    return null;
  }
};

module.exports = { userFromToken };
