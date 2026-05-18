const mongoose = require('mongoose');

const repairPaymentIndexes = async () => {
  const db = mongoose.connection.db;
  const collections = await db.listCollections({ name: 'payments' }).toArray();

  if (!collections.length) {
    return;
  }

  const collection = db.collection('payments');

  // Older writes stored null explicitly, which breaks unique optional fields.
  await collection.updateMany(
    { bankTransactionId: null },
    { $unset: { bankTransactionId: '' } }
  );

  await collection.updateMany(
    { sepayPaymentId: null },
    { $unset: { sepayPaymentId: '' } }
  );

  const indexes = await collection.indexes();

  if (indexes.some(index => index.name === 'bankTransactionId_1')) {
    await collection.dropIndex('bankTransactionId_1');
  }

  if (indexes.some(index => index.name === 'sepayPaymentId_1')) {
    await collection.dropIndex('sepayPaymentId_1');
  }

  await collection.createIndex(
    { bankTransactionId: 1 },
    {
      name: 'bankTransactionId_1',
      unique: true,
      partialFilterExpression: { bankTransactionId: { $type: 'string' } }
    }
  );

  await collection.createIndex(
    { sepayPaymentId: 1 },
    {
      name: 'sepayPaymentId_1',
      unique: true,
      partialFilterExpression: { sepayPaymentId: { $type: 'string' } }
    }
  );
};

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
  };

  try {
    await mongoose.connect(uri, options);
    console.log('MongoDB connected successfully');

    try {
      await repairPaymentIndexes();
      console.log('[Database] Payment indexes repaired');
    } catch (indexErr) {
      console.error('[Database] Payment index repair error:', indexErr.message);
    }
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.log('Retrying connection in 2 seconds...');
    setTimeout(() => connectDB(), 2000);
  }
};

module.exports = connectDB;
