const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const PayoutRequest = require('../models/PayoutRequest');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../config/appConstants');

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseArgs() {
  const out = {
    scenario: process.env.CONC_VERIFY_SCENARIO || '',
    productId: process.env.CONC_VERIFY_PRODUCT_ID || '',
    paymentId: process.env.CONC_VERIFY_PAYMENT_ID || '',
    payoutId: process.env.CONC_VERIFY_PAYOUT_ID || '',
    userId: process.env.CONC_VERIFY_USER_ID || '',
    maxOpenOrders: readPositiveInt(process.env.CONC_VERIFY_MAX_OPEN_ORDERS, 1),
    expectPaymentPaid: String(process.env.CONC_VERIFY_EXPECT_PAYMENT_PAID || '').toLowerCase() === 'true',
    expectPayoutRejected: String(process.env.CONC_VERIFY_EXPECT_PAYOUT_REJECTED || '').toLowerCase() === 'true',
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--scenario=')) out.scenario = arg.slice('--scenario='.length);
    if (arg.startsWith('--product-id=')) out.productId = arg.slice('--product-id='.length);
    if (arg.startsWith('--payment-id=')) out.paymentId = arg.slice('--payment-id='.length);
    if (arg.startsWith('--payout-id=')) out.payoutId = arg.slice('--payout-id='.length);
    if (arg.startsWith('--user-id=')) out.userId = arg.slice('--user-id='.length);
    if (arg.startsWith('--max-open-orders=')) out.maxOpenOrders = readPositiveInt(arg.slice('--max-open-orders='.length), out.maxOpenOrders);
    if (arg.startsWith('--expect-payment-paid=')) out.expectPaymentPaid = arg.slice('--expect-payment-paid='.length) === 'true';
    if (arg.startsWith('--expect-payout-rejected=')) out.expectPayoutRejected = arg.slice('--expect-payout-rejected='.length) === 'true';
  });

  return out;
}

function pushCheck(checks, name, pass, details) {
  checks.push({ name, pass: Boolean(pass), details: details || '' });
}

async function verifyOrderCreate(cfg, checks) {
  if (!cfg.productId) {
    throw new Error('order-create scenario requires --product-id');
  }

  const product = await Product.findById(cfg.productId).lean();
  pushCheck(checks, 'product_exists', Boolean(product), `productId=${cfg.productId}`);
  if (!product) return;

  pushCheck(checks, 'product_quantity_non_negative', Number(product.quantity) >= 0, `quantity=${product.quantity}`);
  pushCheck(
    checks,
    'sold_status_matches_zero_quantity',
    product.status !== 'sold' || Number(product.quantity) === 0,
    `status=${product.status} quantity=${product.quantity}`
  );

  const openStatuses = [
    ORDER_STATUS.PENDING_PAYMENT,
    ORDER_STATUS.PENDING,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.COMPLETED,
  ].filter(Boolean);

  const openOrders = await Order.find({
    product: cfg.productId,
    status: { $in: openStatuses }
  }).select('_id status buyer seller').lean();

  pushCheck(
    checks,
    'open_order_count_within_budget',
    openOrders.length <= cfg.maxOpenOrders,
    `openOrders=${openOrders.length} max=${cfg.maxOpenOrders}`
  );

  const distinctBuyers = new Set(openOrders.map((order) => String(order.buyer)));
  pushCheck(
    checks,
    'distinct_open_buyers_within_budget',
    distinctBuyers.size <= cfg.maxOpenOrders,
    `buyers=${distinctBuyers.size} max=${cfg.maxOpenOrders}`
  );
}

async function verifyPaymentPaid(cfg, checks) {
  if (!cfg.paymentId) {
    throw new Error('payment-paid scenario requires --payment-id');
  }

  const payment = await Payment.findById(cfg.paymentId).lean();
  pushCheck(checks, 'payment_exists', Boolean(payment), `paymentId=${cfg.paymentId}`);
  if (!payment) return;

  if (cfg.expectPaymentPaid) {
    pushCheck(checks, 'payment_marked_paid', payment.status === PAYMENT_STATUS.PAID, `status=${payment.status}`);
  }

  const idempotencyKey = `PAYMENT_PAID:${payment._id}`;
  const creditTxCount = await WalletTransaction.countDocuments({ idempotencyKey });
  pushCheck(checks, 'single_payment_credit_tx', creditTxCount === 1, `idempotencyKey=${idempotencyKey} count=${creditTxCount}`);

  if (payment.bankTransactionId) {
    const duplicateBankTxCount = await Payment.countDocuments({ bankTransactionId: payment.bankTransactionId });
    pushCheck(
      checks,
      'bank_transaction_id_unique',
      duplicateBankTxCount === 1,
      `bankTransactionId=${payment.bankTransactionId} count=${duplicateBankTxCount}`
    );
  }

  const order = await Order.findById(payment.order).select('status timeline').lean();
  pushCheck(checks, 'linked_order_exists', Boolean(order), `orderId=${payment.order}`);
  if (order) {
    pushCheck(
      checks,
      'paid_payment_not_left_in_pending_payment',
      !cfg.expectPaymentPaid || order.status !== ORDER_STATUS.PENDING_PAYMENT,
      `orderStatus=${order.status}`
    );
  }
}

async function verifyPayoutRefund(cfg, checks) {
  if (!cfg.payoutId) {
    throw new Error('payout-refund scenario requires --payout-id');
  }

  const payout = await PayoutRequest.findById(cfg.payoutId).lean();
  pushCheck(checks, 'payout_exists', Boolean(payout), `payoutId=${cfg.payoutId}`);
  if (!payout) return;

  if (cfg.expectPayoutRejected) {
    pushCheck(checks, 'payout_marked_rejected', payout.status === 'REJECTED', `status=${payout.status}`);
  }

  const refundKey = `PAYOUT_REJECT_REFUND:${payout._id}`;
  const refundTxCount = await WalletTransaction.countDocuments({ idempotencyKey: refundKey });
  pushCheck(checks, 'single_refund_credit_tx', refundTxCount === 1, `idempotencyKey=${refundKey} count=${refundTxCount}`);

  const withdrawTxCount = await WalletTransaction.countDocuments({
    referenceId: payout._id,
    referenceType: 'PayoutRequest',
    type: 'WITHDRAW',
    status: 'FAILED'
  });
  pushCheck(checks, 'withdraw_tx_failed_once', withdrawTxCount === 1, `count=${withdrawTxCount}`);

  const wallet = await Wallet.findOne({ user: cfg.userId || payout.user }).lean();
  pushCheck(checks, 'wallet_exists', Boolean(wallet), `userId=${cfg.userId || payout.user}`);
  if (wallet) {
    pushCheck(checks, 'wallet_available_balance_non_negative', Number(wallet.availableBalance) >= 0, `available=${wallet.availableBalance}`);
  }
}

async function main() {
  const cfg = parseArgs();
  if (!cfg.scenario) {
    throw new Error('Missing --scenario (order-create | payment-paid | payout-refund)');
  }
  if (!['order-create', 'payment-paid', 'payout-refund'].includes(cfg.scenario)) {
    throw new Error(`Unsupported scenario: ${cfg.scenario}`);
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not defined');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    retryWrites: true,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 15000,
    autoIndex: false
  });

  const checks = [];
  try {
    if (cfg.scenario === 'order-create') {
      await verifyOrderCreate(cfg, checks);
    } else if (cfg.scenario === 'payment-paid') {
      await verifyPaymentPaid(cfg, checks);
    } else {
      await verifyPayoutRefund(cfg, checks);
    }
  } finally {
    await mongoose.disconnect();
  }

  const pass = checks.length > 0 && checks.every((item) => item.pass);
  const report = {
    date: new Date().toISOString(),
    scenario: cfg.scenario,
    config: cfg,
    pass,
    checks
  };

  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({
    pass: false,
    error: err.message || String(err)
  }, null, 2));
  process.exit(1);
});
