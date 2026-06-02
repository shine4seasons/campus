const mongoose = require('mongoose');
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
const orderRepository = require('../repositories/orderRepository');
const productRepository = require('../repositories/productRepository');
const paymentRepository = require('../repositories/paymentRepository');
const walletRepository = require('../repositories/walletRepository');
const chatRepository = require('../repositories/chatRepository');
const userRepository = require('../repositories/userRepository');

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

async function adjustCounters({ sellerId, buyerId, quantityDelta, orderDelta, options = {} }) {
  const settled = await Promise.allSettled([
    userRepository.incrementUserById(sellerId, { totalSales: quantityDelta }, options),
    userRepository.incrementUserById(buyerId, { totalOrders: orderDelta }, options)
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

async function claimStock({ productId, buyerId, quantity, options = {} }) {
  return productRepository.claimActiveStock({
    productId,
    buyerId,
    quantity,
    soldStatus: PRODUCT_STATUS.SOLD,
    activeStatus: PRODUCT_STATUS.ACTIVE,
    options
  });
}

async function restoreOrderStockByOrder(orderLikeDoc) {
  return releaseProductForOrder(orderLikeDoc);
}

async function reclaimOrderStockByOrder(orderLikeDoc) {
  const quantityToReserve = orderLikeDoc.quantity || 1;
  const reclaimedProduct = await productRepository.reclaimReservedProduct({
    productId: orderLikeDoc.product,
    buyerId: orderLikeDoc.buyer,
    quantity: quantityToReserve,
    activeStatus: PRODUCT_STATUS.ACTIVE,
    soldStatus: PRODUCT_STATUS.SOLD
  });

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

async function createSePayPayment({ order, buyerId, sellerId, orderTotal, options = {} }) {
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
    return paymentRepository.createPayment(paymentData, options);
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

    const msg = await chatRepository.createMessage({
      conversationId: conv._id,
      sender: buyerId,
      text: autoMsg,
      imageUrl: null,
      isRead: false
    });

    try {
      const { getIO } = require('../utils/socketServer');
      const io = getIO();
      if (io) {
        const populatedMsg = await chatRepository.findMessageByIdWithSender(msg._id);
        io.to(`conv_${String(conv._id)}`).emit('message', populatedMsg);
      }
    } catch (e) {
      logger.error('orders.auto_message_socket_emit_failed', { err: e.message, orderId: String(order._id) });
    }

    conv.lastMessage = `New order - ${product.title}`;
    conv.updatedAt = new Date();
    await conv.save();
    await orderRepository.linkConversation(order._id, conv._id);

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
    logger.error('orders.auto_message_failed', { err: err.message, stack: err.stack, orderId: order?._id ? String(order._id) : null });
    return null;
  }
}

exports.createOrder = async function createOrder({ buyer, dto }) {
  let claimedProduct = null;
  let order = null;
  let payment = null;
  let normalized;
  const session = await mongoose.startSession();

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

    await session.withTransaction(async () => {
      const txOptions = { session };
      claimedProduct = await claimStock({
        productId: normalized.productId,
        buyerId,
        quantity: normalized.quantity,
        options: txOptions
      });

      if (!claimedProduct) {
        const existing = await productRepository.findProductOwnershipSnapshot(normalized.productId);
        if (!existing) throw new DomainError(404, 'Product not found');
        if (String(existing.seller) === String(buyerId)) throw new DomainError(400, 'You cannot purchase your own product');
        if ((existing.quantity || 0) < normalized.quantity) throw new DomainError(409, 'Not enough quantity available');
        throw new DomainError(409, 'This product is already sold or unavailable');
      }

      const sellerId = claimedProduct.seller;
      const orderTotal = claimedProduct.price * normalized.quantity;
      const isQrPayment = normalized.paymentMode === 'qr';
      const initialStatus = isQrPayment ? ORDER_STATUS.PENDING_PAYMENT : ORDER_STATUS.PENDING;

      order = await orderRepository.createOrder({
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
      }, txOptions);

      payment = isQrPayment
        ? await createSePayPayment({ order, buyerId, sellerId, orderTotal, options: txOptions })
        : null;

      await adjustCounters({
        sellerId,
        buyerId,
        quantityDelta: normalized.quantity,
        orderDelta: 1,
        options: txOptions
      });
    });

    const conv = await createOrderConversation({
      buyerId,
      sellerId: claimedProduct.seller,
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
    throw err;
  } finally {
    session.endSession();
  }
};

exports.updateOrderStatus = async function updateOrderStatus({ actor, orderId, status }) {
  const uid = String(actor._id);
  const order = await orderRepository.findOrderById(orderId);
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

  const timeline = {
      event: status,
      actor: actor._id,
      at: now,
      note: noteByStatus[status] || `Status changed to ${status}`
  };

  let updatedOrder;
  if (status === ORDER_STATUS.COMPLETED && prevStatus !== ORDER_STATUS.COMPLETED) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        updatedOrder = await orderRepository.updateOrderStatusWithTimeline({
          orderId: order._id,
          prevStatus,
          setFields: updates,
          timeline,
          session
        });

        if (!updatedOrder) return;

        const amount = updatedOrder.priceSnapshot || 0;
        if (amount > 0) {
          const settlementKey = `ORDER_COMPLETE:${updatedOrder._id}`;
          const existingSettlement = await walletRepository.findTransactionByIdempotencyKey(settlementKey, session);
          if (existingSettlement) {
            logger.info('orders.wallet_settlement_skipped', {
              orderId: String(updatedOrder._id),
              idempotencyKey: settlementKey
            });
            return;
          }

          const walletInc = {
            availableBalance: amount,
            totalSales: amount
          };
          if (updatedOrder.paymentMode === 'qr') {
            walletInc.pendingBalance = -amount;
          }

          const wallet = await walletRepository.upsertWalletForUser(updatedOrder.seller, {
            $inc: walletInc,
            $setOnInsert: {
              user: updatedOrder.seller
            }
          }, { session });

          await walletRepository.createWalletTransaction({
            wallet: wallet._id,
            user: updatedOrder.seller,
            type: 'DEPOSIT',
            amount,
            description: `Order #${updatedOrder._id.toString().slice(-8).toUpperCase()} completed`,
            status: 'COMPLETED',
            referenceId: updatedOrder._id,
            referenceType: 'Order',
            idempotencyKey: settlementKey
          }, session);
        }
      });
    } catch (walletErr) {
      logger.error('orders.wallet_settlement_failed', {
        err: walletErr.message,
        stack: walletErr.stack,
        orderId: String(order._id)
      });
      throw walletErr;
    } finally {
      session.endSession();
    }
  } else {
    updatedOrder = await orderRepository.updateOrderStatusWithTimeline({
      orderId: order._id,
      prevStatus,
      setFields: updates,
      timeline
    });
  }

  if (!updatedOrder) {
    throw new DomainError(409, 'Order status was changed by another request. Please refresh and try again.');
  }

  if (status === ORDER_STATUS.CANCELLED && prevStatus !== ORDER_STATUS.CANCELLED) {
    await releaseProductForOrder(updatedOrder);
  } else if (prevStatus === ORDER_STATUS.CANCELLED && status !== ORDER_STATUS.CANCELLED) {
    await reclaimOrderStockByOrder(updatedOrder);
  }

  try {
    const { sendNotification } = require('../utils/notifService');
    const recipientId = isSeller ? updatedOrder.buyer : updatedOrder.seller;
    const statusText = status === ORDER_STATUS.CONFIRMED ? 'has been confirmed' : (status === ORDER_STATUS.COMPLETED ? 'has been completed' : (status === ORDER_STATUS.CANCELLED ? 'has been cancelled' : `moved to "${status}"`));
    const prod = await productRepository.findProductById(updatedOrder.product);

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
    logger.error('orders.status_notification_failed', {
      err: notifErr.message,
      stack: notifErr.stack,
      orderId: String(updatedOrder._id)
    });
  }

  return { order: updatedOrder, isSeller };
};

exports.DomainError = DomainError;
exports.restoreOrderStockByOrder = restoreOrderStockByOrder;
exports.reclaimOrderStockByOrder = reclaimOrderStockByOrder;
