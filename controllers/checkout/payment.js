const Payment = require('../../models/Payment');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const WalletTransaction = require('../../models/WalletTransaction');
const { ORDER_STATUS, PRODUCT_STATUS } = require('../../config/appConstants');
const { sendNotification } = require('../../utils/notifService');
const sepayService = require('../../services/sepayService');

async function cancelOrderAndRestoreStock(orderId) {
  const order = await Order.findById(orderId);
  if (!order || order.status === ORDER_STATUS.CANCELLED) return;

  order.status = ORDER_STATUS.CANCELLED;
  order.cancelledAt = new Date();
  order.timeline.push({
    event: ORDER_STATUS.CANCELLED,
    actor: null,
    at: new Date(),
    note: 'Payment session expired'
  });
  await order.save();

  await Product.findByIdAndUpdate(order.product, {
    $inc: { quantity: order.quantity || 1 },
    $set: { status: PRODUCT_STATUS.ACTIVE, buyer: null, soldAt: null }
  });

  await Promise.all([
    User.findByIdAndUpdate(order.seller, { $inc: { totalSales: -(order.quantity || 1) } }),
    User.findByIdAndUpdate(order.buyer, { $inc: { totalOrders: -1 } })
  ]).catch(() => {});
}

exports.getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.status === 'PENDING' && new Date() > payment.expiredAt) {
      payment.status = 'EXPIRED';
      await payment.save();
      await cancelOrderAndRestoreStock(payment.order);
    }

    res.json({ success: true, data: { status: payment.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.webhook = async (req, res) => {
  try {
    const { paymentCode, amount, status } = req.body;
    const normalizedAmount = Number(amount);

    if (status !== 'PAID' && status !== 'SUCCESS') {
      return res.status(400).json({ success: false, message: 'Ignored status' });
    }

    const payment = await Payment.findOne({ paymentCode });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.status !== 'PENDING') {
      return res.json({ success: true, message: 'Already processed' });
    }

    if (!Number.isFinite(normalizedAmount) || payment.amount !== normalizedAmount) {
      console.warn(`[Webhook] Amount mismatch for ${paymentCode}: expected ${payment.amount}, got ${amount}`);
      return res.status(400).json({ success: false, message: 'Amount mismatch' });
    }

    payment.status = 'PAID';
    payment.paidAt = new Date();
    await payment.save();

    const order = await Order.findById(payment.order);
    if (order) {
      order.status = ORDER_STATUS.PENDING;
      order.timeline.push({
        event: ORDER_STATUS.PENDING,
        actor: null,
        at: new Date(),
        note: 'Payment successful (Webhook)'
      });
      await order.save();
    }

    let wallet = await Wallet.findOne({ user: payment.seller });
    if (!wallet) {
      wallet = await Wallet.create({ user: payment.seller });
    }

    wallet.pendingBalance += payment.amount;
    await wallet.save();

    await WalletTransaction.create({
      wallet: wallet._id,
      user: payment.seller,
      type: 'DEPOSIT',
      amount: payment.amount,
      status: 'COMPLETED',
      description: `Payment for order ${order._id} via QR`,
      referenceId: order._id,
      referenceType: 'Order'
    });

    await sendNotification({
      recipient: payment.seller,
      sender: payment.buyer,
      type: 'order',
      title: 'Payment Received',
      message: 'Buyer has paid for order. Please process it.',
      link: `/orders/tracking/${order._id}`
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.checkPaymentViaSePay = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate('order')
      .populate('buyer', 'name nickname avatar email')
      .populate('seller', 'name nickname avatar email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        status: 'NOT_FOUND',
        message: 'Payment not found'
      });
    }

    if (payment.status === 'PAID') {
      return res.json({
        success: true,
        status: 'PAID',
        message: 'Payment confirmed',
        paidAt: payment.paidAt
      });
    }

    if (new Date() > payment.expiredAt) {
      payment.status = 'EXPIRED';
      await payment.save();

      if (payment.order) {
        await cancelOrderAndRestoreStock(payment.order._id);
      }

      return res.json({
        success: true,
        status: 'EXPIRED',
        message: 'Payment session expired'
      });
    }

    let transactions = [];
    try {
      transactions = await sepayService.getRecentTransactions(1, 100);
    } catch (err) {
      console.error('[Payment Check] SePay API error:', err.message);
      return res.json({
        success: true,
        status: 'PENDING',
        message: 'Checking payment status...'
      });
    }

    const matchedTransaction = sepayService.findMatchingTransaction(payment, transactions);
    if (!matchedTransaction) {
      return res.json({
        success: true,
        status: 'PENDING',
        message: 'Waiting for payment...'
      });
    }

    const isDuplicate = await Payment.findOne({
      bankTransactionId: matchedTransaction.id,
      _id: { $ne: paymentId }
    });

    if (isDuplicate) {
      console.warn(`[Payment Check] Transaction ${matchedTransaction.id} already processed`);
      return res.json({
        success: true,
        status: 'PENDING',
        message: 'Payment verification in progress...'
      });
    }

    payment.status = 'PAID';
    payment.paidAt = new Date();
    payment.bankTransactionId = matchedTransaction.id;
    await payment.save();

    if (payment.order) {
      await Order.findByIdAndUpdate(payment.order._id, {
        status: ORDER_STATUS.PENDING
      });

      const order = await Order.findById(payment.order._id);
      if (order) {
        order.timeline.push({
          event: ORDER_STATUS.PENDING,
          actor: null,
          at: new Date(),
          note: 'Payment confirmed via SePay'
        });
        await order.save();
      }
    }

    if (payment.seller) {
      let wallet = await Wallet.findOne({ user: payment.seller._id });
      if (!wallet) {
        wallet = await Wallet.create({ user: payment.seller._id });
      }

      wallet.pendingBalance += payment.amount;
      await wallet.save();

      await WalletTransaction.create({
        wallet: wallet._id,
        user: payment.seller._id,
        type: 'DEPOSIT',
        amount: payment.amount,
        status: 'COMPLETED',
        description: 'Payment for order via QR transfer',
        referenceId: payment.order._id,
        referenceType: 'Order'
      });
    }

    if (payment.seller && payment.buyer && payment.order) {
      await sendNotification({
        recipient: payment.seller._id,
        sender: payment.buyer._id,
        type: 'order',
        title: 'Payment Received',
        message: 'Payment confirmed for your product. Please process the order.',
        link: `/orders/tracking/${payment.order._id}`
      });
    }

    return res.json({
      success: true,
      status: 'PAID',
      message: 'Payment confirmed',
      paidAt: payment.paidAt
    });
  } catch (err) {
    console.error('[Payment Check] Error:', err);
    res.status(500).json({
      success: false,
      message: 'Payment verification error'
    });
  }
};
