const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Report = require('../models/Report');
const Wallet = require('../models/Wallet');
const PayoutRequest = require('../models/PayoutRequest');
const WalletTransaction = require('../models/WalletTransaction');
const {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PRODUCT_STATUS,
  USER_ROLES
} = require('../config/appConstants');

const SEED_PREFIX = process.env.RUNTIME_SEED_PREFIX || 'runtime-seed';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function tokenFor(userId) {
  return jwt.sign({ sub: String(userId) }, requireEnv('JWT_SECRET'), {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
}

function csrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

function cookieFor(userId) {
  const csrf = csrfToken();
  const token = tokenFor(userId);
  return {
    token,
    csrf,
    header: `token=${token}; csrf=${csrf}`
  };
}

async function upsertUser(key, role, fields = {}) {
  return User.findOneAndUpdate(
    { googleId: `${SEED_PREFIX}-${key}` },
    {
      $set: {
        email: `${SEED_PREFIX}-${key}@example.test`,
        name: fields.name || `${key} User`,
        nickname: fields.nickname || key,
        university: fields.university || 'Runtime University',
        studentId: fields.studentId || `${SEED_PREFIX}-${key}`,
        phone: fields.phone || '0900000000',
        bio: fields.bio || 'Runtime fixture account',
        avatar: fields.avatar || null,
        profileComplete: true,
        isNewUser: false,
        banned: false,
        role,
        location: fields.location || { lat: 21.0285, lng: 105.8542 }
      },
      $setOnInsert: {
        totalSales: 0,
        totalOrders: 0,
        rating: 5,
        ratingCount: 0
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function upsertProduct({ key, seller, title, quantity = 5, status = PRODUCT_STATUS.ACTIVE }) {
  return Product.findOneAndUpdate(
    { seller: seller._id, title },
    {
      $set: {
        title,
        description: `${title} seeded for runtime benchmark and concurrency checks.`,
        price: 125000,
        quantity,
        category: 'books',
        condition: 'good',
        images: [],
        seller: seller._id,
        status,
        reported: false,
        location: {
          address: 'Runtime Campus Gate',
          lat: 21.0285,
          lng: 105.8542
        }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function upsertOrder({ key, product, buyer, seller, status, paymentMode = 'cash' }) {
  return Order.findOneAndUpdate(
    {
      product: product._id,
      buyer: buyer._id,
      seller: seller._id,
      note: `${SEED_PREFIX}:${key}`
    },
    {
      $set: {
        product: product._id,
        buyer: buyer._id,
        seller: seller._id,
        priceSnapshot: product.price,
        quantity: 1,
        deliveryMode: 'pickup',
        paymentMode,
        note: `${SEED_PREFIX}:${key}`,
        status,
        pickupLocation: product.location,
        timeline: [{
          event: status,
          actor: buyer._id,
          at: new Date(),
          note: 'Runtime fixture order'
        }]
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function upsertPayment({ order, buyer, seller }) {
  return Payment.findOneAndUpdate(
    { paymentCode: `${SEED_PREFIX}-${order._id}` },
    {
      $set: {
        order: order._id,
        buyer: buyer._id,
        seller: seller._id,
        amount: order.priceSnapshot,
        status: PAYMENT_STATUS.PENDING,
        paymentCode: `${SEED_PREFIX}-${order._id}`,
        sepayReferenceCode: `${SEED_PREFIX}-${String(order._id).slice(-8)}`,
        sepayQrUrl: null,
        expiredAt: new Date(Date.now() + 30 * 60 * 1000),
        paidAt: null
      },
      $unset: {
        bankTransactionId: '',
        sepayPaymentId: ''
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function upsertReport({ reporter, product }) {
  return Report.findOneAndUpdate(
    {
      reporter: reporter._id,
      targetType: 'product',
      targetId: product._id,
      reason: 'other'
    },
    {
      $set: {
        reporter: reporter._id,
        targetType: 'product',
        targetId: product._id,
        reason: 'other',
        content: 'Runtime fixture report',
        status: 'pending',
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function upsertPayout({ seller }) {
  const wallet = await Wallet.findOneAndUpdate(
    { user: seller._id },
    {
      $set: {
        availableBalance: 250000,
        pendingBalance: 0,
        totalSales: 250000
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const payout = await PayoutRequest.findOneAndUpdate(
    {
      user: seller._id,
      'bankInfo.accountNumber': `${SEED_PREFIX}-001`,
      status: 'PENDING'
    },
    {
      $set: {
        user: seller._id,
        amount: 50000,
        bankInfo: {
          bankName: 'Runtime Bank',
          accountNumber: `${SEED_PREFIX}-001`,
          accountName: 'RUNTIME SELLER'
        },
        status: 'PENDING',
        adminNote: '',
        processedAt: null,
        processedBy: null,
        transferReference: '',
        transferNote: ''
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await WalletTransaction.deleteMany({
    user: seller._id,
    referenceId: payout._id,
    referenceType: 'PayoutRequest'
  });

  return { wallet, payout };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  requireEnv('JWT_SECRET');

  await mongoose.connect(process.env.MONGODB_URI, {
    retryWrites: true,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 15000,
    autoIndex: false
  });

  try {
    const [buyer, seller, admin] = await Promise.all([
      upsertUser('buyer', USER_ROLES.USER, { name: 'Runtime Buyer', nickname: 'buyer' }),
      upsertUser('seller', USER_ROLES.USER, { name: 'Runtime Seller', nickname: 'seller' }),
      upsertUser('admin', USER_ROLES.ADMIN, { name: 'Runtime Admin', nickname: 'admin' })
    ]);

    const [feedProduct, concurrencyProduct] = await Promise.all([
      upsertProduct({ key: 'feed', seller, title: `${SEED_PREFIX} feed product`, quantity: 5 }),
      upsertProduct({ key: 'concurrency', seller, title: `${SEED_PREFIX} concurrency product`, quantity: 1 })
    ]);

    const [cashOrder, qrOrder] = await Promise.all([
      upsertOrder({ key: 'cash-order', product: feedProduct, buyer, seller, status: ORDER_STATUS.PENDING, paymentMode: 'cash' }),
      upsertOrder({ key: 'qr-order', product: feedProduct, buyer, seller, status: ORDER_STATUS.PENDING_PAYMENT, paymentMode: 'qr' })
    ]);
    const payment = await upsertPayment({ order: qrOrder, buyer, seller });
    const report = await upsertReport({ reporter: buyer, product: feedProduct });
    const { wallet, payout } = await upsertPayout({ seller });

    const buyerCookie = cookieFor(buyer._id);
    const sellerCookie = cookieFor(seller._id);
    const adminCookie = cookieFor(admin._id);

    const output = {
      ok: true,
      prefix: SEED_PREFIX,
      ids: {
        buyer: String(buyer._id),
        seller: String(seller._id),
        admin: String(admin._id),
        feedProduct: String(feedProduct._id),
        concurrencyProduct: String(concurrencyProduct._id),
        cashOrder: String(cashOrder._id),
        qrOrder: String(qrOrder._id),
        payment: String(payment._id),
        report: String(report._id),
        wallet: String(wallet._id),
        payout: String(payout._id)
      },
      cookies: {
        buyer: buyerCookie.header,
        seller: sellerCookie.header,
        admin: adminCookie.header
      },
      env: {
        BENCH_BUYER_COOKIE: buyerCookie.header,
        BENCH_ADMIN_COOKIE: adminCookie.header,
        CONC_VERIFY_PRODUCT_ID: String(concurrencyProduct._id),
        CONC_VERIFY_PAYMENT_ID: String(payment._id),
        CONC_VERIFY_PAYOUT_ID: String(payout._id),
        CONC_VERIFY_USER_ID: String(seller._id)
      },
      commands: {
        benchmark: 'npm run bench:p95:local',
        orderInvariant: `npm run test:concurrency:verify -- --scenario=order-create --product-id=${concurrencyProduct._id} --max-open-orders=1`,
        paymentInvariant: `npm run test:concurrency:verify -- --scenario=payment-paid --payment-id=${payment._id}`,
        payoutInvariant: `npm run test:concurrency:verify -- --scenario=payout-refund --payout-id=${payout._id} --user-id=${seller._id}`
      }
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message || String(err) }, null, 2));
  process.exit(1);
});
