const User = require('../models/User');

function incrementUserById(userId, delta, options = {}) {
  const query = User.findByIdAndUpdate(userId, { $inc: delta }, options);
  return query;
}

module.exports = {
  incrementUserById
};
