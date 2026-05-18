const Payment = require('../../models/Payment');
const Product = require('../../models/Product');

const getCheckoutPage = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId)
      .populate('seller', 'name nickname avatar university phone');

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

    if (product.status === 'sold' || (typeof product.quantity === 'number' && product.quantity <= 0)) {
      return res.redirect(`/products/${product._id}`);
    }

    return res.render('checkout', {
      title: `Checkout - ${product.title}`,
      product,
      user: req.user,
    });
  } catch (error) {
    console.error('[checkout] getCheckoutPage:', error);
    return res.status(500).render('error', {
      title: 'Checkout error - Campus Marketplace',
      message: error.message,
      user: req.user,
    });
  }
};

const getPaymentPage = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId)
      .populate('order')
      .populate('seller', 'name nickname');

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

    if (payment.status === 'EXPIRED' || payment.status === 'FAILED') {
      return res.redirect(`/orders/tracking/${payment.order._id}`);
    }

    const platformBank = {
      bankName: process.env.SEPAY_QR_BANK || process.env.SEPAY_BANK_CODE || 'BIDV',
      accountNumber: process.env.SEPAY_QR_ACC || process.env.SEPAY_ACCOUNT_NUMBER || '',
      accountName: process.env.SEPAY_ACCOUNT_NAME || 'SMART CAMPUS MARKETPLACE',
    };

    const qrUrl = payment.sepayQrUrl || payment.qrUrl;

    if (!qrUrl) {
      console.warn('[payment] QR URL missing for payment', payment._id);
      return res.status(500).render('error', {
        title: 'Payment QR unavailable - Campus Marketplace',
        message: 'Payment QR could not be generated. Please contact support.',
        user: req.user,
      });
    }

    return res.render('payment', {
      title: 'Payment - QR Transfer',
      payment,
      platformBank,
      qrUrl,
      isAlreadyPaid: payment.status === 'PAID',
      user: req.user,
    });
  } catch (error) {
    console.error('[checkout] getPaymentPage:', error);
    return res.status(500).render('error', {
      title: 'Payment error - Campus Marketplace',
      message: error.message,
      user: req.user,
    });
  }
};

module.exports = { getCheckoutPage, getPaymentPage };
