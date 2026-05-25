const { PRODUCT_STATUS, PAYMENT_STATUS } = require('../../config/appConstants');
const paymentRepository = require('../../repositories/paymentRepository');
const { serviceUnavailable } = require('../../utils/errors');
const logger = require('../../utils/logger');

const getCheckoutPage = async (req, res, next) => {
  try {
    const product = await paymentRepository.findCheckoutProductById(req.params.productId);

    if (!product) {
      return res.status(404).render('error', {
        title: 'Product not found - Campus Marketplace',
        message: 'Product not found',
        user: req.user,
      });
    }

    if (String(product.seller._id) === String(req.user._id)) {
      return res.redirect(`/products/${product._id}`);
    }

    if (product.status === PRODUCT_STATUS.SOLD || (typeof product.quantity === 'number' && product.quantity <= 0)) {
      return res.redirect(`/products/${product._id}`);
    }

    return res.render('checkout', {
      title: `Checkout - ${product.title}`,
      product,
      user: req.user,
    });
  } catch (error) {
    return next(error);
  }
};

const getPaymentPage = async (req, res, next) => {
  try {
    const payment = await paymentRepository.findPaymentPageById(req.params.paymentId);

    if (!payment) {
      return res.status(404).render('error', {
        title: 'Payment not found - Campus Marketplace',
        message: 'Payment not found',
        user: req.user,
      });
    }

    if (String(payment.buyer) !== String(req.user._id)) {
      return res.status(403).render('error', {
        title: 'Forbidden - Campus Marketplace',
        message: 'Unauthorized',
        user: req.user,
      });
    }

    if (payment.status === PAYMENT_STATUS.EXPIRED || payment.status === PAYMENT_STATUS.FAILED) {
      return res.redirect(`/orders/tracking/${payment.order._id}`);
    }

    const platformBank = {
      bankName: process.env.SEPAY_QR_BANK || process.env.SEPAY_BANK_CODE || 'BIDV',
      accountNumber: process.env.SEPAY_QR_ACC || process.env.SEPAY_ACCOUNT_NUMBER || '',
      accountName: process.env.SEPAY_ACCOUNT_NAME || 'SMART CAMPUS MARKETPLACE',
    };

    const qrUrl = payment.sepayQrUrl || payment.qrUrl;

    if (!qrUrl) {
      logger.warn('payment.qr_url_missing', { paymentId: String(payment._id) });
      return next(serviceUnavailable('Payment QR could not be generated. Please contact support.'));
    }

    return res.render('payment', {
      title: 'Payment - QR Transfer',
      payment,
      platformBank,
      qrUrl,
      isAlreadyPaid: payment.status === PAYMENT_STATUS.PAID,
      user: req.user,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getCheckoutPage, getPaymentPage };
