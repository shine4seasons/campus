const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not defined in environment');
  }

  const options = {
    retryWrites: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 45000,
    autoIndex: process.env.NODE_ENV !== 'production',
  };

  try {
    await mongoose.connect(uri, options);
    logger.info('database.connected');
  } catch (err) {
    logger.error('database.connection_failed', { err: err.message, stack: err.stack });
    logger.info('database.retry_scheduled', { delayMs: 2000 });
    setTimeout(() => connectDB(), 2000);
  }
};

module.exports = connectDB;
