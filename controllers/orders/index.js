const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Message = require('../../models/Message');

const { findOrCreateConversation } = require('../chat/conversation');
const { ORDER_STATUS, PRODUCT_STATUS, DELIVERY_MODES, PAYMENT_MODES, TRANSITIONS, ORDER_ROLES, NOTIFICATION_TYPES } = require('../../config/appConstants');

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const {
      productId,
      deliveryMode,
      paymentMode,
      note = '',
      shippingAddress = null,
      pickupLocation = null,
    } = req.body;

    if (!productId) return res.status(400).json({ success: false, message: 'Missing productId' });

    if (!DELIVERY_MODES.includes(deliveryMode)) return res.status(400).json({ success: false, message: 'Invalid deliveryMode' });
    if (!PAYMENT_MODES.includes(paymentMode)) return res.status(400).json({ success: false, message: 'Invalid paymentMode' });

    if (deliveryMode === 'ship') {
      const a = shippingAddress || {};
      if (!a.name || !a.phone || !a.street || !a.city) {
        return res.status(400).json({ success: false, message: 'Please fill in all shipping address fields' });
      }
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.status !== PRODUCT_STATUS.ACTIVE) return res.status(400).json({ success: false, message: 'This product is already sold or hidden' });
    if (String(product.seller) === String(buyerId)) return res.status(400).json({ success: false, message: 'You cannot purchase your own product' });

    const sellerId = product.seller;

    const order = await Order.create({
      product: productId,
      buyer: buyerId,
      seller: sellerId,
      priceSnapshot: product.price,
      deliveryMode,
      paymentMode,
      note: note.trim().substring(0, 500),
      shippingAddress: deliveryMode === 'ship' ? shippingAddress : null,
      pickupLocation: deliveryMode === 'pickup' ? pickupLocation : null,
      status: ORDER_STATUS.PENDING,
    });

    product.status = PRODUCT_STATUS.SOLD;
    product.buyer = buyerId;
    product.soldAt = new Date();
    await product.save();

    User.findByIdAndUpdate(sellerId, { $inc: { totalSales: 1 } }).catch(console.error);
    User.findByIdAndUpdate(buyerId, { $inc: { totalOrders: 1 } }).catch(console.error);

    let conv = null;
    try {
      conv = await findOrCreateConversation(buyerId, sellerId, productId);

      const deliveryText = deliveryMode === 'ship'
        ? `Delivery to: ${shippingAddress?.street || ''}, ${shippingAddress?.city || ''}`
        : 'Method: Pickup';

      const payText = paymentMode === 'cash' ? 'Payment: Cash' : 'Payment: Card';

      const autoMsg =
        `[ORDER] *New order from ${req.user.nickname || req.user.name}*\n` +
        `Product: ${product.title}\n` +
        `Price: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(product.price)}\n` +
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
        message: `${req.user.nickname || req.user.name} placed an order for "${product.title}"`,
        link: `/orders-seller`
      });
    } catch (chatErr) {
      console.error('[checkout] Auto-message error:', chatErr);
    }

    return res.status(201).json({
      success: true,
      orderId: order._id,
      conversationId: conv?._id || null,
      message: 'Order placed successfully',
    });
  } catch (err) {
    console.error('[checkout] createOrder:', err);
    res.status(500).json({ success: false, message: err.message });
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

    // Allow broader transitions for sellers/admins (both directions).
    const isAdminOrSeller = isSeller || req.user.role === 'admin';

    if (!isAdminOrSeller) {
      // For buyers, keep strict transitions from constants
      const allowed = TRANSITIONS[role]?.[order.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ success: false, message: `Cannot transition from "${order.status}" to "${status}"` });
      }
    }

    const prevStatus = order.status;
    order.status = status;

    // Manage timestamps according to new status
    if (status === ORDER_STATUS.CONFIRMED) order.confirmedAt = new Date(); else order.confirmedAt = null;
    if (status === ORDER_STATUS.COMPLETED) order.completedAt = new Date(); else order.completedAt = null;
    if (status === ORDER_STATUS.CANCELLED) order.cancelledAt = new Date(); else order.cancelledAt = null;

    // Handle product and user counters when cancelling or restoring
    try {
      if (status === ORDER_STATUS.CANCELLED && prevStatus !== ORDER_STATUS.CANCELLED) {
        await Product.findByIdAndUpdate(order.product, { status: PRODUCT_STATUS.ACTIVE, buyer: null, soldAt: null });
        User.findByIdAndUpdate(order.seller, { $inc: { totalSales: -1 } }).catch(() => { });
        User.findByIdAndUpdate(order.buyer, { $inc: { totalOrders: -1 } }).catch(() => { });
      } else if (prevStatus === ORDER_STATUS.CANCELLED && status !== ORDER_STATUS.CANCELLED) {
        // restore counts when moving out of cancelled
        await Product.findByIdAndUpdate(order.product, { status: PRODUCT_STATUS.SOLD, buyer: order.buyer, soldAt: new Date() });
        User.findByIdAndUpdate(order.seller, { $inc: { totalSales: 1 } }).catch(() => { });
        User.findByIdAndUpdate(order.buyer, { $inc: { totalOrders: 1 } }).catch(() => { });
      }
    } catch (e) {
      console.error('[orders] product/user update error:', e.message);
    }

    await order.save();

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
      { $group: { _id: null, totalRev: { $sum: '$priceSnapshot' }, totalSold: { $sum: 1 } } }
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
