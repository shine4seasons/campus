const Payment = require('../models/Payment');
const Product = require('../models/Product');

function findCheckoutProductById(productId) {
  return Product.findById(productId)
    .populate('seller', 'name nickname avatar university phone');
}

function findPaymentPageById(paymentId) {
  return Payment.findById(paymentId)
    .populate('order')
    .populate('seller', 'name nickname');
}

async function createPayment(data, options = {}) {
  if (options.session) {
    const [payment] = await Payment.create([data], { session: options.session });
    return payment;
  }
  return Payment.create(data);
}

function deletePaymentsByOrder(orderId, options = {}) {
  return Payment.deleteMany({ order: orderId }, options);
}

function markPaymentPaid({ paymentId, paymentSet, session }) {
  return Payment.findOneAndUpdate(
    { _id: paymentId, status: 'PENDING' },
    { $set: paymentSet },
    { new: true, session }
  );
}

function findBuyerPaymentById(paymentId, buyerId) {
  return Payment.findOne({ _id: paymentId, buyer: buyerId });
}

function findPaymentByCode(paymentCode) {
  return Payment.findOne({ paymentCode });
}

function findPaymentWithRelationsById(paymentId) {
  return Payment.findById(paymentId)
    .populate('order')
    .populate('buyer', 'name nickname avatar email')
    .populate('seller', 'name nickname avatar email');
}

function markPaymentExpired(paymentId) {
  return Payment.updateOne(
    { _id: paymentId, status: 'PENDING' },
    { $set: { status: 'EXPIRED' } }
  );
}

function findDuplicateBankTransaction(bankTransactionId, paymentId) {
  return Payment.findOne({
    bankTransactionId,
    _id: { $ne: paymentId }
  });
}

function findPaymentStatusSnapshot(paymentId) {
  return Payment.findById(paymentId).select('status paidAt').lean();
}

module.exports = {
  findCheckoutProductById,
  findPaymentPageById,
  createPayment,
  deletePaymentsByOrder,
  markPaymentPaid,
  findBuyerPaymentById,
  findPaymentByCode,
  findPaymentWithRelationsById,
  markPaymentExpired,
  findDuplicateBankTransaction,
  findPaymentStatusSnapshot
};
