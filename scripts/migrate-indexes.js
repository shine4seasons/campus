require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function dropIfExists(collection, indexName) {
  const indexes = await collection.indexes();
  if (indexes.some((idx) => idx.name === indexName)) {
    await collection.dropIndex(indexName);
    console.log(`[drop] ${collection.collectionName}.${indexName}`);
  }
}

async function createIndexSafe(collection, key, options) {
  await collection.createIndex(key, options);
  console.log(`[create] ${collection.collectionName}.${options.name}`);
}

async function migratePaymentIndexes(db) {
  const payments = db.collection('payments');

  await payments.updateMany(
    { bankTransactionId: null },
    { $unset: { bankTransactionId: '' } }
  );
  await payments.updateMany(
    { sepayPaymentId: null },
    { $unset: { sepayPaymentId: '' } }
  );
  await payments.updateMany(
    { paymentCode: null },
    { $unset: { paymentCode: '' } }
  );

  const oldNames = [
    'paymentCode_1',
    'sepayPaymentId_1',
    'bankTransactionId_1',
    'uniq_paymentCode',
    'uniq_sepayPaymentId',
    'uniq_bankTransactionId',
  ];
  for (const name of oldNames) {
    await dropIfExists(payments, name);
  }

  await createIndexSafe(
    payments,
    { paymentCode: 1 },
    {
      name: 'uniq_paymentCode',
      unique: true,
      partialFilterExpression: { paymentCode: { $type: 'string' } }
    }
  );
  await createIndexSafe(
    payments,
    { sepayPaymentId: 1 },
    {
      name: 'uniq_sepayPaymentId',
      unique: true,
      partialFilterExpression: { sepayPaymentId: { $type: 'string' } }
    }
  );
  await createIndexSafe(
    payments,
    { bankTransactionId: 1 },
    {
      name: 'uniq_bankTransactionId',
      unique: true,
      partialFilterExpression: { bankTransactionId: { $type: 'string' } }
    }
  );
}

async function migrateProductIndexes(db) {
  const products = db.collection('products');
  const oldNames = [
    'status_1',
    'reported_1',
    'status_createdAt',
    'status_1_createdAt_-1',
    'category_status',
    'category_1_status_1',
    'seller_status',
    'seller_1_status_1',
  ];
  for (const name of oldNames) {
    await dropIfExists(products, name);
  }

  await createIndexSafe(products, { status: 1, createdAt: -1 }, { name: 'status_createdAt' });
  await createIndexSafe(products, { category: 1, status: 1 }, { name: 'category_status' });
  await createIndexSafe(products, { seller: 1, status: 1 }, { name: 'seller_status' });
}

async function migrateUserIndexes(db) {
  const users = db.collection('users');
  await dropIfExists(users, 'banned_1');

  const indexes = await users.indexes();
  const hasGoogleId = indexes.some((idx) => idx.name === 'googleId_1');
  if (!hasGoogleId) {
    await createIndexSafe(users, { googleId: 1 }, { name: 'googleId_1', unique: true });
  }
}

async function migrateWalletTransactionIndexes(db) {
  const walletTransactions = db.collection('wallettransactions');

  await walletTransactions.updateMany(
    { idempotencyKey: null },
    { $unset: { idempotencyKey: '' } }
  );

  const oldNames = [
    'idempotencyKey_1',
    'uniq_wallet_tx_idempotencyKey',
  ];
  for (const name of oldNames) {
    await dropIfExists(walletTransactions, name);
  }

  await createIndexSafe(
    walletTransactions,
    { idempotencyKey: 1 },
    {
      name: 'uniq_wallet_tx_idempotencyKey',
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: 'string' } }
    }
  );
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not defined');

  await mongoose.connect(uri, {
    retryWrites: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 45000,
    autoIndex: false,
  });

  const db = mongoose.connection.db;
  try {
    await snapshotIndexes(db, ['payments', 'products', 'users', 'wallettransactions']);
    await migratePaymentIndexes(db);
    await migrateProductIndexes(db);
    await migrateUserIndexes(db);
    await migrateWalletTransactionIndexes(db);
    console.log('Index migration completed.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Index migration failed:', err.message);
  process.exitCode = 1;
});

async function snapshotIndexes(db, collections) {
  const snapshotDir = path.join(__dirname, '..', 'docs', 'index-snapshots');
  fs.mkdirSync(snapshotDir, { recursive: true });

  const data = {
    capturedAt: new Date().toISOString(),
    collections: {}
  };

  for (const name of collections) {
    try {
      data.collections[name] = await db.collection(name).indexes();
    } catch (err) {
      data.collections[name] = { error: err.message };
    }
  }

  const filePath = path.join(
    snapshotDir,
    `indexes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[snapshot] ${filePath}`);
}
