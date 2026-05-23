const mongoose = require('mongoose');

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
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.log('Retrying connection in 2 seconds...');
    setTimeout(() => connectDB(), 2000);
  }
};

module.exports = connectDB;
