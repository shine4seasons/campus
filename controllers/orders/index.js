const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Message = require('../../models/Message');
const Payment = require('../../models/Payment');
const Wallet = require('../../models/Wallet');
const WalletTransaction = require('../../models/WalletTransaction');

const { findOrCreateConversation } = require('../chat/conversation');
const { ORDER_STATUS, PRODUCT_STATUS, DELIVERY_MODES, PAYMENT_MODES, TRANSITIONS, ORDER_ROLES, NOTIFICATION_TYPES } = require('../../config/appConstants');
const sepayService = require('../../services/sepayService');

// Create Order
exports.createOrder = async (req, res) => {
  let claimedProduct = null;
  let order = null;
  let orderQuantity = 1;
  try {
    const buyerId = req.user._id;
    const {
      productId,
      quantity = 1,
      deliveryMode,
      paymentMode,
      note = '',
      shippingAddress = null,
      pickupLocation = null,
    } = req.body;

    if (!productId) return res.status(400).json({ success: false, message: 'Missing productId' });
    orderQuantity = Number.parseInt(quantity, 10);
    if (!Number.isFinite(orderQuantity) || orderQuantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    if (!DELIVERY_MODES.includes(deliveryMode)) return res.status(400).json({ success: false, message: 'Invalid deliveryMode' });
    if (!PAYMENT_MODES.includes(paymentMode)) return res.status(400).json({ success: false, message: 'Invalid paymentMode' });

    if (deliveryMode === 'ship') {
      const a = shippingAddress || {};
      if (!a.name || !a.phone || !a.street || !a.city) {
        return res.status(400).json({ success: false, message: 'Please fill in all shipping address fields' });
      }
    }

    // Atomic claim: only succeeds if product has enough active stock and is not owned by buyer.
    // This prevents overselling when two buyers click "Buy" simultaneously.
    claimedProduct = await Product.findOneAndUpdate(
      {
        _id: productId,
        status: PRODUCT_STATUS.ACTIVE,
        seller: { $ne: buyerId },
        $or: [
          { quantity: { $gte: orderQuantity } },
          ...(orderQuantity === 1 ? [{ quantity: { $exists: false } }] : [])
        ]
      },
      [
        {
          $set: {
            quantity: { $subtract: [{ $ifNull: ['$quantity', 1] }, orderQuantity] },
            status: {
              $cond: [
                { $lte: [{ $subtract: [{ $ifNull: ['$quantity', 1] }, orderQuantity] }, 0] },
                PRODUCT_STATUS.SOLD,
                PRODUCT_STATUS.ACTIVE
              ]
            },
            buyer: {
              $cond: [
                { $lte: [{ $subtract: [{ $ifNull: ['$quantity', 1] }, orderQuantity] }, 0] },
                buyerId,
                '$buyer'
              ]
            },
            soldAt: {
              $cond: [
                { $lte: [{ $subtract: [{ $ifNull: ['$quantity', 1] }, orderQuantity] }, 0] },
                new Date(),
                '$soldAt'
              ]
            }
          }
        }
      ],
      { new: true }
    );

    if (!claimedProduct) {
      // Diagnose why the claim failed
      const existing = await Product.findById(productId).select('seller status quantity').lean();
      if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });
      if (String(existing.seller) === String(buyerId)) return res.status(400).json({ success: false, message: 'You cannot purchase your own product' });
      if ((existing.quantity || 0) < orderQuantity) return res.status(409).json({ success: false, message: 'Not enough quantity available' });
      return res.status(409).json({ success: false, message: 'This product is already sold or unavailable' });
    }

    const sellerId = claimedProduct.seller;
    const orderTotal = claimedProduct.price * orderQuantity;

    const isQrPayment = paymentMode === 'qr';
    const initialStatus = isQrPayment ? ORDER_STATUS.PENDING_PAYMENT : ORDER_STATUS.PENDING;

    // Order.create after claim. If this fails we rollback the product claim below.
    order = await Order.create({
      product: productId,
      buyer: buyerId,
      seller: sellerId,
      priceSnapshot: orderTotal,
      quantity: orderQuantity,
      deliveryMode,
      paymentMode,
      note: note.trim().substring(0, 500),
      shippingAddress: deliveryMode === 'ship' ? shippingAddress : null,
      pickupLocation: deliveryMode === 'pickup' ? pickupLocation : null,
      status: initialStatus,
      timeline: [{
        event: initialStatus,
        actor: buyerId,
        at: new Date(),
        note: 'Order placed'
      }],
    });

    let payment = null;
    if (isQrPayment) {
      const paymentCode = `SMP${String(order._id).toUpperCase()}`;

      try {
        // ====================================================================
        // SEPAY INTEGRATION: Create QR payment via SePay API
        // ====================================================================

        const sepayPayment = await sepayService.createSePayPayment(
          order,
          orderTotal,
          paymentCode
        );

        const paymentData = {
          order: order._id,
          buyer: buyerId,
          seller: sellerId,
          amount: orderTotal,
          
          // SePay-specific fields
          sepayQrUrl: sepayPayment.qrUrl,
          sepayReferenceCode: sepayPayment.referenceCode,
          
          // Legacy field (for backward compatibility)
          paymentCode,
          
          status: 'PENDING',
          expiredAt: new Date(Date.now() + 15 * 60000) // 15 mins to pay
        };

        if (sepayPayment.sepayPaymentId) {
          paymentData.sepayPaymentId = sepayPayment.sepayPaymentId;
        }

        payment = await Payment.create(paymentData);
      } catch (sepayErr) {
        console.error('[Order] SePay payment creation failed:', sepayErr.message);
        throw new Error(`Cannot create SePay QR: ${sepayErr.message}`);
      }
    }

    // Counters are best-effort metrics — log on failure but don't fail the order
    Promise.all([
      User.findByIdAndUpdate(sellerId, { $inc: { totalSales: orderQuantity } }),
      User.findByIdAndUpdate(buyerId, { $inc: { totalOrders: 1 } })
    ]).catch(err => console.error('[orders] counter update error:', err));

    const product = claimedProduct;
    let conv = null;
    try {
      conv = await findOrCreateConversation(buyerId, sellerId, productId);

      const deliveryText = deliveryMode === 'ship'
        ? `Delivery to: ${shippingAddress?.street || ''}, ${shippingAddress?.city || ''}`
        : 'Method: Pickup';

      const payText = paymentMode === 'cash' ? 'Payment: Cash' : 'Payment: QR Transfer';

      const autoMsg =
        `[ORDER] *New order from ${req.user.nickname || req.user.name}*\n` +
        `Product: ${product.title}\n` +
        `Quantity: ${orderQuantity}\n` +
        `Total: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(orderTotal)}\n` +
        deliveryText + '\n' +
        payText +
        (note.trim() ? `\nNote: ${note.trim()}` : '');

      const msg = await Message.create({
        conversationId: conv._id,
        sender: buyerId,
        text: autoMsg,
        isRead: false,
      });

      // Emit realtime event for new auto-message
      try {
        const { getIO } = require('../../utils/socketServer');
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

      // Create real-time notification for seller
      const { sendNotification } = require('../../utils/notifService');
      await sendNotification({
        recipient: sellerId,
        sender: buyerId,
        type: NOTIFICATION_TYPES.ORDER,
        title: 'New Order',
        message: `${req.user.nickname || req.user.name} placed an order for ${orderQuantity} x "${product.title}"`,
        link: `/orders-seller`
      });
    } catch (chatErr) {
      console.error('[checkout] Auto-message error:', chatErr);
    }

    return res.status(201).json({
      success: true,
      orderId: order._id,
      paymentId: payment ? payment._id : null,
      // SePay fields
      sepayQrUrl: payment && payment.sepayQrUrl ? payment.sepayQrUrl : null,
      sepayPaymentId: payment && payment.sepayPaymentId ? payment.sepayPaymentId : null,
      amount: payment ? payment.amount : null,
      expiredAt: payment ? payment.expiredAt : null,
      conversationId: conv?._id || null,
      message: 'Order placed successfully',
    });
  } catch (err) {
    console.error('[checkout] createOrder:', err);
    // Rollback: release product and cleanup partially-created records.
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
          $inc: { quantity: order?.quantity || orderQuantity || 1 },
          $set: { status: PRODUCT_STATUS.ACTIVE, buyer: null, soldAt: null }
        });
      } catch (rollbackErr) {
        console.error('[checkout] rollback failed:', rollbackErr);
      }
    }

    const message = err.message || 'Create order failed';
    const isSePayIssue = message.includes('SePay QR') || message.includes('SEPAY_QR_ACC');
    const statusCode = isSePayIssue ? 503 : 500;
    res.status(statusCode).json({ success: false, message });
  }
};

// Get my orders
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { role = ORDER_ROLES.BUYER, status, page = 1, limit = 10 } = req.query;

    const filter = role === ORDER_ROLES.SELLER ? { seller: userId } : { buyer: userId };
    if (status && status !== 'all') filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit))
      .populate('product', 'title images price category')
      .populate('buyer', 'name nickname avatar')
      .populate('seller', 'name nickname avatar')
      .lean();

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/orders/stats?role=buyer|seller
exports.getOrderStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.query.role || ORDER_ROLES.BUYER;
    const filter = role === ORDER_ROLES.SELLER ? { seller: userId } : { buyer: userId };

    const agg = await Order.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const out = {
      [ORDER_STATUS.PENDING]: 0,
      [ORDER_STATUS.CONFIRMED]: 0,
      [ORDER_STATUS.COMPLETED]: 0,
      [ORDER_STATUS.CANCELLED]: 0
    };
    agg.forEach(a => { out[a._id] = a.count; });
    res.json({ success: true, data: out });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get order by id
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('product', 'title images price category condition location')
      .populate('buyer', 'name nickname avatar phone')
      .populate('seller', 'name nickname avatar phone')
      .populate('timeline.actor', 'name nickname avatar')
      .lean();

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const uid = String(req.user._id);
    if (String(order.buyer._id) !== uid && String(order.seller._id) !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this order' });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const uid = String(req.user._id);
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const isSeller = String(order.seller) === uid;
    const isBuyer = String(order.buyer) === uid;

    if (!isSeller && !isBuyer && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const role = isSeller ? ORDER_ROLES.SELLER : ORDER_ROLES.BUYER;
    const isAdminOrSeller = isSeller || req.user.role === 'admin';

    if (!isAdminOrSeller) {
      const allowed = TRANSITIONS[role]?.[order.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ success: false, message: `Cannot transition from "${order.status}" to "${status}"` });
      }
    }

    const prevStatus = order.status;
    if (prevStatus === status) {
      return res.json({ success: true, data: order });
    }

    // Atomic status transition: only succeeds if status hasn't changed since we read it.
    // Prevents two concurrent updates from both decrementing/incrementing counters.
    const now = new Date();
    const updates = { status };
    updates.confirmedAt = status === ORDER_STATUS.CONFIRMED ? now : null;
    updates.completedAt = status === ORDER_STATUS.COMPLETED ? now : null;
    updates.cancelledAt = status === ORDER_STATUS.CANCELLED ? now : null;

    const noteByStatus = {
      [ORDER_STATUS.CONFIRMED]: isSeller ? 'Seller confirmed the order' : (req.user.role === 'admin' ? 'Admin confirmed the order' : 'Buyer confirmed the order'),
      [ORDER_STATUS.COMPLETED]: isSeller ? 'Seller marked as completed' : (req.user.role === 'admin' ? 'Admin marked as completed' : 'Buyer marked as completed'),
      [ORDER_STATUS.CANCELLED]: isSeller ? 'Cancelled by seller' : (req.user.role === 'admin' ? 'Cancelled by admin' : 'Cancelled by buyer'),
      [ORDER_STATUS.PENDING]:   'Order reopened to pending',
    };

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: prevStatus },
      {
        $set: updates,
        $push: {
          timeline: {
            event: status,
            actor: req.user._id,
            at: now,
            note: noteByStatus[status] || `Status changed to ${status}`
          }
        }
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(409).json({ success: false, message: 'Order status was changed by another request. Please refresh and try again.' });
    }

    // Now safe to apply downstream side effects — we own this transition.
    try {
      if (status === ORDER_STATUS.CANCELLED && prevStatus !== ORDER_STATUS.CANCELLED) {
        await Product.findByIdAndUpdate(updatedOrder.product, {
          $inc: { quantity: updatedOrder.quantity || 1 },
          $set: { status: PRODUCT_STATUS.ACTIVE, buyer: null, soldAt: null }
        });
        Promise.all([
          User.findByIdAndUpdate(updatedOrder.seller, { $inc: { totalSales: -(updatedOrder.quantity || 1) } }),
          User.findByIdAndUpdate(updatedOrder.buyer, { $inc: { totalOrders: -1 } })
        ]).catch(err => console.error('[orders] counter update error:', err));
      } else if (prevStatus === ORDER_STATUS.CANCELLED && status !== ORDER_STATUS.CANCELLED) {
        const quantityToReserve = updatedOrder.quantity || 1;
        const reclaimedProduct = await Product.findOneAndUpdate(
          { _id: updatedOrder.product, status: PRODUCT_STATUS.ACTIVE, quantity: { $gte: quantityToReserve } },
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
                    updatedOrder.buyer,
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
          return res.status(409).json({ success: false, message: 'Not enough quantity available to reopen this order' });
        }
        Promise.all([
          User.findByIdAndUpdate(updatedOrder.seller, { $inc: { totalSales: quantityToReserve } }),
          User.findByIdAndUpdate(updatedOrder.buyer, { $inc: { totalOrders: 1 } })
        ]).catch(err => console.error('[orders] counter update error:', err));
      }

      // ── Wallet settlement on COMPLETED ────────────────────────────────────
      if (status === ORDER_STATUS.COMPLETED && prevStatus !== ORDER_STATUS.COMPLETED) {
        try {
          const amount = updatedOrder.priceSnapshot || 0;
          if (amount > 0) {
            let wallet = await Wallet.findOne({ user: updatedOrder.seller });
            if (!wallet) {
              wallet = await Wallet.create({
                user: updatedOrder.seller,
                availableBalance: 0,
                pendingBalance: 0,
                totalSales: 0
              });
            }

            // If QR payment: move from pending → available
            const wasQrPaid = updatedOrder.paymentMode === 'qr';
            if (wasQrPaid) {
              wallet.pendingBalance = Math.max(0, wallet.pendingBalance - amount);
            }
            wallet.availableBalance += amount;
            wallet.totalSales = (wallet.totalSales || 0) + amount;
            await wallet.save();

            await WalletTransaction.create({
              wallet: wallet._id,
              user: updatedOrder.seller,
              type: 'DEPOSIT',
              amount,
              description: `Order #${updatedOrder._id.toString().slice(-8).toUpperCase()} completed`,
              status: 'COMPLETED',
              referenceId: updatedOrder._id,
              referenceType: 'Order'
            });
          }
        } catch (walletErr) {
          console.error('[orders] wallet settlement error:', walletErr.message);
        }
      }
    } catch (e) {
      console.error('[orders] product update error:', e.message);
    }

    Object.assign(order, updatedOrder.toObject());

    // Notify the other party about status change in real-time
    try {
      const { sendNotification } = require('../../utils/notifService');
      const recipientId = isSeller ? order.buyer : order.seller;
      const statusText = status === ORDER_STATUS.CONFIRMED ? 'has been confirmed' : (status === ORDER_STATUS.COMPLETED ? 'has been completed' : (status === ORDER_STATUS.CANCELLED ? 'has been cancelled' : `moved to "${status}"`));
      const prod = await Product.findById(order.product);

      let msg = `Your order for "${prod.title}" ${statusText}`;
      if (status === ORDER_STATUS.COMPLETED) {
        msg += ". Please leave a review for your partner!";
      }

      await sendNotification({
        recipient: recipientId,
        sender: uid,
        type: status === ORDER_STATUS.COMPLETED ? NOTIFICATION_TYPES.RATING : NOTIFICATION_TYPES.ORDER,
        title: status === ORDER_STATUS.COMPLETED ? 'Rate your trade!' : 'Order Update',
        message: msg,
        link: isSeller ? `/orders/tracking/${order._id}` : '/orders-seller'
      });
    } catch (notifErr) {
      console.error('Status change notification error:', notifErr);
    }

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/orders/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const role = req.query.role || ORDER_ROLES.SELLER;
    const filter = role === ORDER_ROLES.SELLER ? { seller: userId } : { buyer: userId };

    // 1. Revenue by month (last 4 months)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const revAgg = await Order.aggregate([
      { $match: { ...filter, createdAt: { $gte: start }, status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$priceSnapshot' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const revLabels = [];
    const revMap = {};
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      revLabels.push('M' + (d.getMonth() + 1));
      revMap[`${d.getFullYear()}-${d.getMonth() + 1}`] = 0;
    }
    revAgg.forEach(r => { revMap[`${r._id.year}-${r._id.month}`] = r.total; });
    const revData = Object.values(revMap).map(v => Number((v / 1000).toFixed(0))); // in thousands

    // 2. Categories distribution
    const catAgg = await Order.aggregate([
      { $match: { ...filter, status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'prod' } },
      { $unwind: '$prod' },
      { $group: { _id: { $ifNull: ['$prod.category', 'Other'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const catLabels = catAgg.map(c => c._id);
    const catData = catAgg.map(c => c.count);

    // 3. KPI Stats
    const kpiAgg = await Order.aggregate([
      { $match: { ...filter, status: ORDER_STATUS.COMPLETED } },
      { $group: { _id: null, totalRev: { $sum: '$priceSnapshot' }, totalSold: { $sum: '$quantity' } } }
    ]);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const mAgg = await Order.aggregate([
      { $match: { ...filter, status: ORDER_STATUS.COMPLETED, createdAt: { $gte: thisMonthStart } } },
      { $group: { _id: null, monthRev: { $sum: '$priceSnapshot' } } }
    ]);
    const kpi = {
      totalRevenue: kpiAgg[0]?.totalRev || 0,
      totalSold: kpiAgg[0]?.totalSold || 0,
      monthRevenue: mAgg[0]?.monthRev || 0
    };
    kpi.avgOrder = kpi.totalSold > 0 ? (kpi.totalRevenue / kpi.totalSold) : 0;

    res.json({ success: true, data: { revenue: { labels: revLabels, data: revData }, categories: { labels: catLabels, data: catData }, kpi } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Re-export dispute handlers
const dispute = require('./dispute');
exports.openDispute     = dispute.openDispute;
exports.resolveDispute  = dispute.resolveDispute;
exports.getAllDisputes  = dispute.getAllDisputes;
