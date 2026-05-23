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

module.exports = {
  findCheckoutProductById,
  findPaymentPageById
};
