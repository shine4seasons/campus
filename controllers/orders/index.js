const { ORDER_ROLES, USER_ROLES } = require('../../config/appConstants');
const orderService = require('../../services/orderService');
const orderRepository = require('../../repositories/orderRepository');
const logger = require('../../utils/logger');

// Create Order
exports.createOrder = async (req, res, next) => {
  try {
    const { order, payment, conversation } = await orderService.createOrder({
      buyer: req.user,
      dto: req.body
    });

    return res.status(201).json({
      success: true,
      orderId: order._id,
      paymentId: payment ? payment._id : null,
      sepayQrUrl: payment && payment.sepayQrUrl ? payment.sepayQrUrl : null,
      sepayPaymentId: payment && payment.sepayPaymentId ? payment.sepayPaymentId : null,
      amount: payment ? payment.amount : null,
      expiredAt: payment ? payment.expiredAt : null,
      conversationId: conversation ? conversation._id : null,
      message: 'Order placed successfully',
    });
  } catch (err) {
    logger.error('orders.create_failed', { err: err.message, stack: err.stack, userId: req.user?._id ? String(req.user._id) : null });
    return next(err);
  }
};

// Get my orders
exports.getMyOrders = async (req, res, next) => {
  try {
    const { role = ORDER_ROLES.BUYER, status, page = 1, limit = 10 } = req.query;
    const result = await orderRepository.findOrdersForUser({
      userId: req.user._id,
      role,
      status,
      page,
      limit
    });

    res.json({
      success: true,
      data: result.orders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/orders/stats?role=buyer|seller
exports.getOrderStats = async (req, res, next) => {
  try {
    const role = req.query.role || ORDER_ROLES.BUYER;
    const out = await orderRepository.countOrdersByStatusForUser({
      userId: req.user._id,
      role
    });
    res.json({ success: true, data: out });
  } catch (err) {
    return next(err);
  }
};

// Get order by id
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await orderRepository.findOrderDetailById(req.params.id);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const uid = String(req.user._id);
    if (String(order.buyer._id) !== uid && String(order.seller._id) !== uid && req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this order' });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    return next(err);
  }
};

// Update order status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await orderService.updateOrderStatus({
      actor: req.user,
      orderId: req.params.id,
      status
    });
    return res.json({ success: true, data: result.order });
  } catch (err) {
    return next(err);
  }
};

// GET /api/orders/analytics
exports.getAnalytics = async (req, res, next) => {
  try {
    const role = req.query.role || ORDER_ROLES.SELLER;
    const analytics = await orderRepository.getOrderAnalyticsForUser({
      userId: req.user._id,
      role
    });
    res.json({ success: true, data: analytics });
  } catch (err) {
    return next(err);
  }
};

// Re-export dispute handlers
const dispute = require('./dispute');
exports.openDispute     = dispute.openDispute;
exports.resolveDispute  = dispute.resolveDispute;


