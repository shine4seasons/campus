const User = require('../models/User');

function findUserById(userId) {
  return User.findById(userId);
}

function updateUserProfileById(userId, updates) {
  return User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-__v -googleId');
}

module.exports = {
  findUserById,
  updateUserProfileById
};
