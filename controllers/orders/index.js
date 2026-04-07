const mongoose   = require('mongoose');
const Order      = require('../../models/Order');
const Product    = require('../../models/Product');
const User       = require('../../models/User');
const Message    = require('../../models/Message');

const { findOrCreateConversation } = require('../chat/conversation');
const { validDelivery, validPayment, TRANSITIONS } = require('./constants');

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const {
      productId,
      deliveryMode,
      paymentMode,
      note            = '',
      shippingAddress = null,
    } = req.body;

    if (!productId) return res.status(400).json({ success: false, message: 'Thiếu productId' });

    if (!validDelivery.includes(deliveryMode)) return res.status(400).json({ success: false, message: 'deliveryMode không hợp lệ' });
    if (!validPayment.includes(paymentMode)) return res.status(400).json({ success: false, message: 'paymentMode không hợp lệ' });

    if (deliveryMode === 'ship') {
      const a = shippingAddress || {};
      if (!a.name || !a.phone || !a.street || !a.city) {
        return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ địa chỉ giao hàng' });
      }
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    if (product.status !== 'active') return res.status(400).json({ success: false, message: 'Sản phẩm này đã được bán hoặc bị ẩn' });
    if (String(product.seller) === String(buyerId)) return res.status(400).json({ success: false, message: 'Bạn không thể mua sản phẩm của chính mình' });

    const sellerId = product.seller;

    const order = await Order.create({
      product:         productId,
      buyer:           buyerId,
      seller:          sellerId,
      priceSnapshot:   product.price,
      deliveryMode,
      paymentMode,
      note:            note.trim().substring(0, 500),
      shippingAddress: deliveryMode === 'ship' ? shippingAddress : null,
      status:          'pending',
    });

    product.status = 'sold';
    product.buyer  = buyerId;
    product.soldAt = new Date();
    await product.save();

    User.findByIdAndUpdate(sellerId, { $inc: { totalSales: 1 } }).catch(console.error);
    User.findByIdAndUpdate(buyerId,  { $inc: { totalOrders: 1 } }).catch(console.error);

    let conv = null;
    try {
      conv = await findOrCreateConversation(buyerId, sellerId, productId);

      const deliveryText = deliveryMode === 'ship'
        ? `📬 Giao đến: ${shippingAddress?.street || ''}, ${shippingAddress?.city || ''}`
        : '🏪 Hình thức: Tự đến nhận hàng';

      const payText = paymentMode === 'cash' ? '💵 Thanh toán: Tiền mặt' : '💳 Thanh toán: Thẻ ngân hàng';

      const autoMsg =
        `🛒 *Đơn hàng mới từ ${req.user.nickname || req.user.name}*\n` +
        `📦 Sản phẩm: ${product.title}\n` +
        `💰 Giá: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}\n` +
        deliveryText + '\n' +
        payText +
        (note.trim() ? `\n📝 Ghi chú: ${note.trim()}` : '');

      const msg = await Message.create({
        conversationId: conv._id,
        sender:         buyerId,
        text:           autoMsg,
        isRead:         false,
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

      conv.lastMessage = `🛒 Đơn hàng mới — ${product.title}`;
      conv.updatedAt   = new Date();
      await conv.save();

      await Order.findByIdAndUpdate(order._id, { conversation: conv._id });
    } catch (chatErr) {
      console.error('[checkout] Auto-message error:', chatErr);
    }

    return res.status(201).json({
      success:        true,
      orderId:        order._id,
      conversationId: conv?._id || null,
      message:        'Đặt hàng thành công',
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
    const { role = 'buyer', status } = req.query;

    const filter = role === 'seller' ? { seller: userId } : { buyer: userId };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .sort('-createdAt')
      .populate('product', 'title images price category')
      .populate('buyer',   'name nickname avatar')
      .populate('seller',  'name nickname avatar')
      .lean();

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get order by id
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('product', 'title images price category condition location')
      .populate('buyer',   'name nickname avatar phone')
      .populate('seller',  'name nickname avatar phone')
      .lean();

    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

    const uid = String(req.user._id);
    if (String(order.buyer._id) !== uid && String(order.seller._id) !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền xem đơn hàng này' });
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
    const uid        = String(req.user._id);
    const order      = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

    const isSeller = String(order.seller) === uid;
    const isBuyer  = String(order.buyer)  === uid;

    if (!isSeller && !isBuyer && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const role    = isSeller ? 'seller' : 'buyer';
    const allowed = TRANSITIONS[role]?.[order.status] || [];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Không thể chuyển từ "${order.status}" sang "${status}"` });
    }

    order.status = status;
    if (status === 'confirmed') order.confirmedAt = new Date();
    if (status === 'completed') order.completedAt = new Date();
    if (status === 'cancelled') {
      order.cancelledAt = new Date();

      await Product.findByIdAndUpdate(order.product, { status: 'active', buyer: null, soldAt: null });

      User.findByIdAndUpdate(order.seller, { $inc: { totalSales: -1 } }).catch(() => {});
      User.findByIdAndUpdate(order.buyer,  { $inc: { totalOrders: -1 } }).catch(() => {});
    }

    await order.save();

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
