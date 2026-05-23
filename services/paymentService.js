const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_STATUS, USER_ROLES } = require('../config/appConstants');
const { sendNotification } = require('../utils/notifService');
const sepayService = require('./sepayService');
const { releaseProductForOrder } = require('./inventoryService');
const logger = require('../utils/logger');
const paymentRepository = require('../repositories/paymentRepository');
const orderRepository = require('../repositories/orderRepository');
const walletRepository = require('../repositories/walletRepository');

class DomainError extends Error {
  constructor(status, message, payload) {
    super(message);
    this.name = 'DomainError';
    this.status = status;
    this.payload = payload || null;
  }
}

async function cancelOrderAndRestoreStock(orderId) {
  const now = new Date();
  const order = await orderRepository.cancelOrderIfNotCancelled({
    orderId,
    now,
    note: 'Payment session expired'
  });
  if (!order) return;
  await releaseProductForOrder(order);
}

async function processPaidPayment({
  paymentId,
  paidNote,
  bankTransactionId = null
}) {
  const session = await mongoose.startSession();
  let result = { alreadyProcessed: false, payment: null, order: null };

  try {
    await session.withTransaction(async () => {
      const paymentSet = {
        status: PAYMENT_STATUS.PAID,
        paidAt: new Date(),
      };
      if (bankTransactionId) paymentSet.bankTransactionId = bankTransactionId;

      const payment = await paymentRepository.markPaymentPaid({
        paymentId,
        paymentSet,
        session
      });

      if (!payment) {
        result.alreadyProcessed = true;
        return;
      }

      const order = await orderRepository.updateOrderAfterPayment({
        orderId: payment.order,
        paidNote,
        session
      });

      if (!order) {
        throw new DomainError(404, 'Order not found for payment');
      }

      const wallet = await walletRepository.upsertWalletForUser(payment.seller, {
        $inc: { pendingBalance: payment.amount },
        $setOnInsert: {
          user: payment.seller,
          availableBalance: 0,
          totalSales: 0
        }
      }, { session });

      await walletRepository.createWalletTransactions([{
        wallet: wallet._id,
        user: payment.seller,
        type: 'DEPOSIT',
        amount: payment.amount,
        status: 'COMPLETED',
        description: `Payment for order ${order._id} via QR`,
        referenceId: order._id,
        referenceType: 'Order',
        idempotencyKey: `PAYMENT_PAID:${payment._id}`
      }], session);

      result.payment = payment;
      result.order = order;
    });
  } finally {
    session.endSession();
  }

  return result;
}

exports.getPaymentStatus = async function getPaymentStatus({ paymentId, buyerId }) {
  const payment = await paymentRepository.findBuyerPaymentById(paymentId, buyerId);
  if (!payment) throw new DomainError(404, 'Payment not found');

  const status = payment.status === PAYMENT_STATUS.PENDING && new Date() > payment.expiredAt
    ? PAYMENT_STATUS.EXPIRED
    : payment.status;
  return { status };
};

exports.webhook = async function webhook({ paymentCode, amount, status }) {
  const normalizedAmount = Number(amount);
  if (status !== PAYMENT_STATUS.PAID && status !== 'SUCCESS') {
    throw new DomainError(400, 'Ignored status');
  }

  const payment = await paymentRepository.findPaymentByCode(paymentCode);
  if (!payment) throw new DomainError(404, 'Payment not found');

  if (!Number.isFinite(normalizedAmount) || payment.amount !== normalizedAmount) {
    logger.warn('payment.webhook_amount_mismatch', {
      paymentCode,
      expected: payment.amount,
      actual: amount
    });
    throw new DomainError(400, 'Amount mismatch');
  }

  const processed = await processPaidPayment({
    paymentId: payment._id,
    paidNote: 'Payment successful (Webhook)'
  });
  if (processed.alreadyProcessed) return { alreadyProcessed: true };

  await sendNotification({
    recipient: payment.seller,
    sender: payment.buyer,
    type: 'order',
    title: 'Payment Received',
    message: 'Buyer has paid for order. Please process it.',
    link: `/orders/tracking/${processed.order._id}`
  });

  return { success: true };
};

exports.checkPaymentViaSePay = async function checkPaymentViaSePay({ paymentId, actor }) {
  const payment = await paymentRepository.findPaymentWithRelationsById(paymentId);

  if (!payment) {
    throw new DomainError(404, 'Payment not found', {
      success: false,
      status: 'NOT_FOUND',
      message: 'Payment not found'
    });
  }

  const actorId = actor?._id ? String(actor._id) : null;
  const isAdmin = actor?.role === USER_ROLES.ADMIN;
  const isBuyer = actorId && String(payment.buyer?._id || payment.buyer) === actorId;
  const isSeller = actorId && String(payment.seller?._id || payment.seller) === actorId;
  if (!isAdmin && !isBuyer && !isSeller) {
    throw new DomainError(403, 'Forbidden', {
      success: false,
      status: 'FORBIDDEN',
      message: 'You do not have permission to access this payment'
    });
  }

  if (payment.status === PAYMENT_STATUS.PAID) {
    return { success: true, status: PAYMENT_STATUS.PAID, message: 'Payment confirmed', paidAt: payment.paidAt };
  }

  if (new Date() > payment.expiredAt) {
    await paymentRepository.markPaymentExpired(payment._id);

    if (payment.order) {
      await cancelOrderAndRestoreStock(payment.order._id);
    }

    return { success: true, status: PAYMENT_STATUS.EXPIRED, message: 'Payment session expired' };
  }

  let transactions = [];
  try {
    transactions = await sepayService.getRecentTransactionsCached(1, 100);
  } catch (err) {
    logger.error('payment.sepay_api_error', { err: err.message, paymentId: String(paymentId) });
    return { success: true, status: PAYMENT_STATUS.PENDING, message: 'Checking payment status...' };
  }

  const matchedTransaction = sepayService.findMatchingTransaction(payment, transactions);
  if (!matchedTransaction) {
    return { success: true, status: PAYMENT_STATUS.PENDING, message: 'Waiting for payment...' };
  }

  const isDuplicate = await paymentRepository.findDuplicateBankTransaction(matchedTransaction.id, paymentId);

  if (isDuplicate) {
    logger.warn('payment.sepay_tx_duplicate', { transactionId: matchedTransaction.id, paymentId: String(paymentId) });
    return { success: true, status: PAYMENT_STATUS.PENDING, message: 'Payment verification in progress...' };
  }

  let processed;
  try {
    processed = await processPaidPayment({
      paymentId: payment._id,
      paidNote: 'Payment confirmed via SePay',
      bankTransactionId: matchedTransaction.id
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return { success: true, status: PAYMENT_STATUS.PENDING, message: 'Payment verification in progress...' };
    }
    throw err;
  }

  if (processed.alreadyProcessed) {
    const latest = await paymentRepository.findPaymentStatusSnapshot(payment._id);
    return {
      success: true,
      status: latest?.status || PAYMENT_STATUS.PAID,
      message: 'Payment already confirmed',
      paidAt: latest?.paidAt || payment.paidAt
    };
  }

  if (payment.seller && payment.buyer && payment.order) {
    await sendNotification({
      recipient: payment.seller._id,
      sender: payment.buyer._id,
      type: 'order',
      title: 'Payment Received',
      message: 'Payment confirmed for your product. Please process the order.',
      link: `/orders/tracking/${processed.order._id}`
    });
  }

  return { success: true, status: PAYMENT_STATUS.PAID, message: 'Payment confirmed', paidAt: processed.payment.paidAt };
};

exports.DomainError = DomainError;
