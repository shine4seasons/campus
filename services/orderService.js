const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Message = require('../models/Message');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');

const { findOrCreateConversation } = require('../controllers/chat/conversation');
const {
  ORDER_STATUS,
  PRODUCT_STATUS,
  DELIVERY_MODES,
  PAYMENT_MODES,
  PAYMENT_STATUS,
  TRANSITIONS,
  ORDER_ROLES,
  USER_ROLES,
  NOTIFICATION_TYPES
} = require('../config/appConstants');
const sepayService = require('./sepayService');
const { releaseProductForOrder } = require('./inventoryService');
const logger = require('../utils/logger');

class DomainError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'DomainError';
    this.status = status;
  }
}

function normalizeCreateOrderInput(dto = {}) {
  const {
    productId,
    quantity = 1,
    deliveryMode,
    paymentMode,
    note = '',
    shippingAddress = null,
    pickupLocation = null
  } = dto;

  return {
    productId,
    quantity: Number.parseInt(quantity, 10),
    deliveryMode,
    paymentMode,
    note: String(note || ''),
    shippingAddress,
    pickupLocation
  };
}

async function adjustCounters({ sellerId, buyerId, quantityDelta, orderDelta }) {
  const settled = await Promise.allSettled([
    User.findByIdAndUpdate(sellerId, { $inc: { totalSales: quantityDelta } }),
    User.findByIdAndUpdate(buyerId, { $inc: { totalOrders: orderDelta } })
  ]);
  settled
    .filter((r) => r.status === 'rejected')
    .forEach((r) => logger.error('orders.counter_update_failed', {
      err: r.reason?.message || String(r.reason),
      sellerId: String(sellerId),
      buyerId: String(buyerId),
      quantityDelta,
      orderDelta
    }));
}

async function claimStock({ productId, buyerId, quantity }) {
  return Product.findOneAndUpdate(
    {
      _id: productId,
      status: PRODUCT_STATUS.ACTIVE,
      seller: { $ne: buyerId },
      $or: [
        { quantity: { $gte: quantity } },
        ...(quantity === 1 ? [{ quantity: { $exists: false } }] : [])
      ]
    },
    [
      {
        $set: {
          quantity: { $subtract: [{ $ifNull: ['$quantity', 1] }, quantity] },
          status: {
            $cond: [
              { $lte: [{ $subtract: [{ $ifNull: ['$quantity', 1] }, quantity] }, 0] },
              PRODUCT_STATUS.SOLD,
              PRODUCT_STATUS.ACTIVE
            ]
          },
          buyer: {
            $cond: [
              { $lte: [{ $subtract: [{ $ifNull: ['$quantity', 1] }, quantity] }, 0] },
              buyerId,
              '$buyer'
            ]
          },
          soldAt: {
            $cond: [
              { $lte: [{ $subtract: [{ $ifNull: ['$quantity', 1] }, quantity] }, 0] },
              new Date(),
              '$soldAt'
            ]
          }
        }
      }
    ],
    { new: true }
  );
}

async function restoreOrderStockByOrder(orderLikeDoc) {
  return releaseProductForOrder(orderLikeDoc);
}

async function reclaimOrderStockByOrder(orderLikeDoc) {
  const quantityToReserve = orderLikeDoc.quantity || 1;
  const reclaimedProduct = await Product.findOneAndUpdate(
    { _id: orderLikeDoc.product, status: PRODUCT_STATUS.ACTIVE, quantity: { $gte: quantityToReserve } },
    [
      {
        $set: {
          quantity: { $subtract: ['$quantity', quantityToReserve] },
          status: {
            $cond: [
              { $lte: [{ $subtract: ['$quantity', quantityToReserve] }, 0] },
              PRODUCT_STATUS.SOLD,
              PRODUCT_STATUS.ACTIVE
            ]
          },
          buyer: {
            $cond: [
              { $lte: [{ $subtract: ['$quantity', quantityToReserve] }, 0] },
              orderLikeDoc.buyer,
              '$buyer'
            ]
          },
          soldAt: {
            $cond: [
              { $lte: [{ $subtract: ['$quantity', quantityToReserve] }, 0] },
              new Date(),
              '$soldAt'
            ]
          }
        }
      }
    ],
    { new: true }
  );

  if (!reclaimedProduct) {
    throw new DomainError(409, 'Not enough quantity available to reopen this order');
  }

  await adjustCounters({
    sellerId: orderLikeDoc.seller,
    buyerId: orderLikeDoc.buyer,
    quantityDelta: quantityToReserve,
    orderDelta: 1
  });

  return reclaimedProduct;
}

async function createSePayPayment({ order, buyerId, sellerId, orderTotal }) {
  const paymentCode = `SMP${String(order._id).toUpperCase()}`;
  try {
    const sepayPayment = await sepayService.createSePayPayment(order, orderTotal, paymentCode);
    const paymentData = {
      order: order._id,
      buyer: buyerId,
      seller: sellerId,
      amount: orderTotal,
      sepayQrUrl: sepayPayment.qrUrl,
      sepayReferenceCode: sepayPayment.referenceCode,
      paymentCode,
      status: PAYMENT_STATUS.PENDING,
      expiredAt: new Date(Date.now() + 15 * 60000)
    };
    if (sepayPayment.sepayPaymentId) paymentData.sepayPaymentId = sepayPayment.sepayPaymentId;
    return Payment.create(paymentData);
  } catch (err) {
    throw new DomainError(503, `Cannot create SePay QR: ${err.message}`);
  }
}

async function createOrderConversation({ buyerId, sellerId, productId, product, order, buyerDisplayName, quantity, deliveryMode, shippingAddress, paymentMode, note }) {
  try {
    const conv = await findOrCreateConversation(buyerId, sellerId, productId);
    const deliveryText = deliveryMode === 'ship'
      ? `Delivery to: ${shippingAddress?.street || ''}, ${shippingAddress?.city || ''}`
      : 'Method: Pickup';
    const payText = paymentMode === 'cash' ? 'Payment: Cash' : 'Payment: QR Transfer';
    const orderTotal = product.price * quantity;

    const autoMsg =
      `[ORDER] *New order from ${buyerDisplayName}*\n` +
      `Product: ${product.title}\n` +
      `Quantity: ${quantity}\n` +
      `Total: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(orderTotal)}\n` +
      deliveryText + '\n' +
      payText +
      (note.trim() ? `\nNote: ${note.trim()}` : '');

    const msg = await Message.create({
      conversationId: conv._id,
      sender: buyerId,
      text: autoMsg,
      isRead: false
    });

    try {
      const { getIO } = require('../utils/socketServer');
      const io = getIO();
      if (io) {
        const populatedMsg = await Message.findById(msg._id).populate('sender', 'name nickname avatar').lean();
        io.to(`conv_${String(conv._id)}`).emit('message', populatedMsg);
      }
    } catch (e) {
      console.error('Socket emit error (autoMsg):', e.message);
    }

    conv.lastMessage = `New order - ${product.title}`;
    conv.updatedAt = new Date();
    await conv.save();
    await Order.findByIdAndUpdate(order._id, { conversation: conv._id });

    const { sendNotification } = require('../utils/notifService');
    await sendNotification({
      recipient: sellerId,
      sender: buyerId,
      type: NOTIFICATION_TYPES.ORDER,
      title: 'New Order',
      message: `${buyerDisplayName} placed an order for ${quantity} x "${product.title}"`,
      link: '/orders-seller'
    });

    return conv;
  } catch (err) {
    console.error('[checkout] Auto-message error:', err);
    return null;
  }
}

async function rollbackCreateOrder({ order, claimedProduct, quantity }) {
  if (order) {
    try {
      await Payment.deleteMany({ order: order._id });
      await Order.findByIdAndDelete(order._id);
    } catch (cleanupErr) {
      console.error('[checkout] order cleanup failed:', cleanupErr.message);
    }
  }

  if (claimedProduct) {
    try {
      await Product.findByIdAndUpdate(claimedProduct._id, {
        $inc: { quantity: order?.quantity || quantity || 1 },
        $set: { status: PRODUCT_STATUS.ACTIVE, buyer: null, soldAt: null }
      });
    } catch (rollbackErr) {
      console.error('[checkout] rollback failed:', rollbackErr);
    }
  }
}

exports.createOrder = async function createOrder({ buyer, dto }) {
  let claimedProduct = null;
  let order = null;
  let normalized;

  try {
    normalized = normalizeCreateOrderInput(dto);
    const buyerId = buyer && buyer._id;
    const buyerDisplayName = buyer?.nickname || buyer?.name || 'Buyer';

    if (!normalized.productId) throw new DomainError(400, 'Missing productId');
    if (!Number.isFinite(normalized.quantity) || normalized.quantity < 1) {
      throw new DomainError(400, 'Quantity must be at least 1');
    }
    if (!DELIVERY_MODES.includes(normalized.deliveryMode)) throw new DomainError(400, 'Invalid deliveryMode');
    if (!PAYMENT_MODES.includes(normalized.paymentMode)) throw new DomainError(400, 'Invalid paymentMode');

    if (normalized.deliveryMode === 'ship') {
      const a = normalized.shippingAddress || {};
      if (!a.name || !a.phone || !a.street || !a.city) {
        throw new DomainError(400, 'Please fill in all shipping address fields');
      }
    }

    claimedProduct = await claimStock({
      productId: normalized.productId,
      buyerId,
      quantity: normalized.quantity
    });

    if (!claimedProduct) {
      const existing = await Product.findById(normalized.productId).select('seller status quantity').lean();
      if (!existing) throw new DomainError(404, 'Product not found');
      if (String(existing.seller) === String(buyerId)) throw new DomainError(400, 'You cannot purchase your own product');
      if ((existing.quantity || 0) < normalized.quantity) throw new DomainError(409, 'Not enough quantity available');
      throw new DomainError(409, 'This product is already sold or unavailable');
    }

    const sellerId = claimedProduct.seller;
    const orderTotal = claimedProduct.price * normalized.quantity;
    const isQrPayment = normalized.paymentMode === 'qr';
    const initialStatus = isQrPayment ? ORDER_STATUS.PENDING_PAYMENT : ORDER_STATUS.PENDING;

    order = await Order.create({
      product: normalized.productId,
      buyer: buyerId,
      seller: sellerId,
      priceSnapshot: orderTotal,
      quantity: normalized.quantity,
      deliveryMode: normalized.deliveryMode,
      paymentMode: normalized.paymentMode,
      note: normalized.note.trim().substring(0, 500),
      shippingAddress: normalized.deliveryMode === 'ship' ? normalized.shippingAddress : null,
      pickupLocation: normalized.deliveryMode === 'pickup' ? normalized.pickupLocation : null,
      status: initialStatus,
      timeline: [{
        event: initialStatus,
        actor: buyerId,
        at: new Date(),
        note: 'Order placed'
      }]
    });

    const payment = isQrPayment
      ? await createSePayPayment({ order, buyerId, sellerId, orderTotal })
      : null;

    adjustCounters({
      sellerId,
      buyerId,
      quantityDelta: normalized.quantity,
      orderDelta: 1
    });

    const conv = await createOrderConversation({
      buyerId,
      sellerId,
      productId: normalized.productId,
      product: claimedProduct,
      order,
      buyerDisplayName,
      quantity: normalized.quantity,
      deliveryMode: normalized.deliveryMode,
      shippingAddress: normalized.shippingAddress,
      paymentMode: normalized.paymentMode,
      note: normalized.note
    });

    return { order, payment, conversation: conv };
  } catch (err) {
    await rollbackCreateOrder({
      order,
      claimedProduct,
      quantity: normalized?.quantity || 1
    });
    throw err;
  }
};

exports.updateOrderStatus = async function updateOrderStatus({ actor, orderId, status }) {
  const uid = String(actor._id);
  const order = await Order.findById(orderId);
  if (!order) throw new DomainError(404, 'Order not found');

  const isSeller = String(order.seller) === uid;
  const isBuyer = String(order.buyer) === uid;
  if (!isSeller && !isBuyer && actor.role !== USER_ROLES.ADMIN) throw new DomainError(403, 'Unauthorized');

  const role = isSeller ? ORDER_ROLES.SELLER : ORDER_ROLES.BUYER;
  const isAdminOrSeller = isSeller || actor.role === 'admin';
  if (!isAdminOrSeller) {
    const allowed = TRANSITIONS[role]?.[order.status] || [];
    if (!allowed.includes(status)) {
      throw new DomainError(400, `Cannot transition from "${order.status}" to "${status}"`);
    }
  }

  const prevStatus = order.status;
  if (prevStatus === status) return { order, isSeller };

  const now = new Date();
  const updates = {
    status,
    confirmedAt: status === ORDER_STATUS.CONFIRMED ? now : null,
    completedAt: status === ORDER_STATUS.COMPLETED ? now : null,
    cancelledAt: status === ORDER_STATUS.CANCELLED ? now : null
  };

  const noteByStatus = {
    [ORDER_STATUS.CONFIRMED]: isSeller ? 'Seller confirmed the order' : (actor.role === 'admin' ? 'Admin confirmed the order' : 'Buyer confirmed the order'),
    [ORDER_STATUS.COMPLETED]: isSeller ? 'Seller marked as completed' : (actor.role === 'admin' ? 'Admin marked as completed' : 'Buyer marked as completed'),
    [ORDER_STATUS.CANCELLED]: isSeller ? 'Cancelled by seller' : (actor.role === 'admin' ? 'Cancelled by admin' : 'Cancelled by buyer'),
    [ORDER_STATUS.PENDING]: 'Order reopened to pending',
  };

  const updatedOrder = await Order.findOneAndUpdate(
    { _id: order._id, status: prevStatus },
    {
      $set: updates,
      $push: {
        timeline: {
          event: status,
          actor: actor._id,
          at: now,
          note: noteByStatus[status] || `Status changed to ${status}`
        }
      }
    },
    { new: true }
  );

  if (!updatedOrder) {
    throw new DomainError(409, 'Order status was changed by another request. Please refresh and try again.');
  }

  if (status === ORDER_STATUS.CANCELLED && prevStatus !== ORDER_STATUS.CANCELLED) {
    await releaseProductForOrder(updatedOrder);
  } else if (prevStatus === ORDER_STATUS.CANCELLED && status !== ORDER_STATUS.CANCELLED) {
    await reclaimOrderStockByOrder(updatedOrder);
  }

  if (status === ORDER_STATUS.COMPLETED && prevStatus !== ORDER_STATUS.COMPLETED) {
    try {
      const amount = updatedOrder.priceSnapshot || 0;
      if (amount > 0) {
        const walletInc = {
          availableBalance: amount,
          totalSales: amount
        };
        if (updatedOrder.paymentMode === 'qr') {
          walletInc.pendingBalance = -amount;
        }

        const wallet = await Wallet.findOneAndUpdate(
          { user: updatedOrder.seller },
          {
            $inc: walletInc,
            $setOnInsert: {
              user: updatedOrder.seller
            }
          },
          { new: true, upsert: true }
        );

        await WalletTransaction.create({
          wallet: wallet._id,
          user: updatedOrder.seller,
          type: 'DEPOSIT',
          amount,
          description: `Order #${updatedOrder._id.toString().slice(-8).toUpperCase()} completed`,
          status: 'COMPLETED',
          referenceId: updatedOrder._id,
          referenceType: 'Order',
          idempotencyKey: `ORDER_COMPLETE:${updatedOrder._id}`
        });
      }
    } catch (walletErr) {
      console.error('[orders] wallet settlement error:', walletErr.message);
    }
  }

  try {
    const { sendNotification } = require('../utils/notifService');
    const recipientId = isSeller ? updatedOrder.buyer : updatedOrder.seller;
    const statusText = status === ORDER_STATUS.CONFIRMED ? 'has been confirmed' : (status === ORDER_STATUS.COMPLETED ? 'has been completed' : (status === ORDER_STATUS.CANCELLED ? 'has been cancelled' : `moved to "${status}"`));
    const prod = await Product.findById(updatedOrder.product);

    let msg = `Your order for "${prod.title}" ${statusText}`;
    if (status === ORDER_STATUS.COMPLETED) {
      msg += '. Please leave a review for your partner!';
    }

    await sendNotification({
      recipient: recipientId,
      sender: uid,
      type: status === ORDER_STATUS.COMPLETED ? NOTIFICATION_TYPES.RATING : NOTIFICATION_TYPES.ORDER,
      title: status === ORDER_STATUS.COMPLETED ? 'Rate your trade!' : 'Order Update',
      message: msg,
      link: isSeller ? `/orders/tracking/${updatedOrder._id}` : '/orders-seller'
    });
  } catch (notifErr) {
    console.error('Status change notification error:', notifErr);
  }

  return { order: updatedOrder, isSeller };
};

exports.DomainError = DomainError;
exports.restoreOrderStockByOrder = restoreOrderStockByOrder;
exports.reclaimOrderStockByOrder = reclaimOrderStockByOrder;
