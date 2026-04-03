const mongoose   = require('mongoose');
const Order        = require('../models/Order');
const Product      = require('../models/Product');
const User         = require('../models/User');
const Conversation = require('../models/Conversation');
const Message      = require('../models/Message');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: tìm hoặc tạo conversation giữa buyer và seller
// (tái sử dụng logic tương tự chatController.initChat)
// ─────────────────────────────────────────────────────────────────────────────
async function findOrCreateConversation(buyerId, sellerId, productId) {
  let conv = await Conversation.findOne({
    participants: { $all: [buyerId, sellerId] },
  });

  if (!conv) {
    conv = await Conversation.create({
      participants: [buyerId, sellerId],
      product:      productId,
      lastMessage:  '',
    });
  } else {
    conv.product = productId;
    await conv.save();
  }

  return conv;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /checkout/:productId
// Render trang checkout (SSR, dùng Express + EJS)
// ─────────────────────────────────────────────────────────────────────────────
exports.getCheckoutPage = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId).populate(
      'seller',
      'name nickname avatar university phone'
    );

    if (!product) {
      return res.status(404).render('error', { message: 'Không tìm thấy sản phẩm', user: req.user });
    }

    // Chủ sản phẩm không thể tự mua
    if (String(product.seller._id) === String(req.user._id)) {
      return res.redirect('/products/' + product._id);
    }

    // Sản phẩm đã bán
    if (product.status === 'sold') {
      return res.redirect('/products/' + product._id);
    }

    res.render('checkout', {
      title:   'Đặt hàng — ' + product.title,
      product,
      user:    req.user,
    });
  } catch (err) {
    console.error('[checkout] getCheckoutPage:', err);
    res.status(500).render('error', { message: err.message, user: req.user });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders
// Đặt hàng:
//   1. Kiểm tra sản phẩm còn active
//   2. Tạo Order document
//   3. Đánh dấu product là 'sold', ghi buyer
//   4. Tăng totalSales của seller & totalOrders của buyer
//   5. Init conversation + gửi tin nhắn thông báo tự động
//   6. Trả về orderId + conversationId
// ─────────────────────────────────────────────────────────────────────────────
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

    // ── 1. Validate input ──────────────────────────────────────────────────
    if (!productId) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Thiếu productId' });
    }

    const validDelivery = ['pickup', 'ship'];
    const validPayment  = ['cash', 'card'];
    if (!validDelivery.includes(deliveryMode)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'deliveryMode không hợp lệ' });
    }
    if (!validPayment.includes(paymentMode)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'paymentMode không hợp lệ' });
    }

    // Nếu ship thì phải có địa chỉ
    if (deliveryMode === 'ship') {
      const a = shippingAddress || {};
      if (!a.name || !a.phone || !a.street || !a.city) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ địa chỉ giao hàng' });
      }
    }

    // ── 2. Lấy sản phẩm & kiểm tra ───────────────────────────────────────
    // Use a simple lookup and sequential updates (avoid transactions for single-node dev environments)
    const product = await Product.findById(productId);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }
    if (product.status !== 'active') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Sản phẩm này đã được bán hoặc bị ẩn' });
    }
    if (String(product.seller) === String(buyerId)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Bạn không thể mua sản phẩm của chính mình' });
    }

    const sellerId = product.seller;

    // ── 3. Tạo Order ───────────────────────────────────────────────────────
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

    // ── 4. Đánh dấu product sold (best-effort)
    product.status = 'sold';
    product.buyer  = buyerId;
    product.soldAt = new Date();
    await product.save();

    // ── 5. Cập nhật stats (fire-and-forget)
    User.findByIdAndUpdate(sellerId, { $inc: { totalSales: 1 } }).catch(console.error);
    User.findByIdAndUpdate(buyerId,  { $inc: { totalOrders: 1 } }).catch(console.error);

    // ── 8. Init conversation + gửi tin nhắn thông báo tự động ─────────────
    let conv = null;
    try {
      conv = await findOrCreateConversation(buyerId, sellerId, productId);

      // Tạo tin nhắn thông báo tự động gắn với đơn hàng
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

      conv.lastMessage = `🛒 Đơn hàng mới — ${product.title}`;
      conv.updatedAt   = new Date();
      await conv.save();

      // Lưu conversationId vào order
      await Order.findByIdAndUpdate(order._id, { conversation: conv._id });
    } catch (chatErr) {
      // Không làm thất bại toàn bộ request nếu chat lỗi
      console.error('[checkout] Auto-message error:', chatErr);
    }

    return res.status(201).json({
      success:        true,
      orderId:        order._id,
      conversationId: conv?._id || null,
      message:        'Đặt hàng thành công',
    });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error('[checkout] createOrder:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders
// Lấy danh sách đơn hàng của user hiện tại (với tư cách buyer hoặc seller)
// Query: ?role=buyer|seller&status=pending|confirmed|completed|cancelled
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/:id
// Chi tiết 1 đơn hàng (chỉ buyer hoặc seller của đơn đó)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/status
// Cập nhật trạng thái đơn hàng
//
// Luồng cho phép:
//   seller: pending → confirmed | cancelled
//   seller: confirmed → completed
//   buyer:  pending → cancelled  (buyer có thể huỷ trước khi seller confirm)
// ─────────────────────────────────────────────────────────────────────────────
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

    // Kiểm tra luồng chuyển trạng thái hợp lệ
    const TRANSITIONS = {
      seller: {
        pending:   ['confirmed', 'cancelled'],
        confirmed: ['completed'],
      },
      buyer: {
        pending: ['cancelled'],
      },
    };

    const role       = isSeller ? 'seller' : 'buyer';
    const allowed    = TRANSITIONS[role]?.[order.status] || [];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Không thể chuyển từ "${order.status}" sang "${status}"`,
      });
    }

    order.status = status;
    if (status === 'confirmed') order.confirmedAt = new Date();
    if (status === 'completed') order.completedAt = new Date();
    if (status === 'cancelled') {
      order.cancelledAt = new Date();

      // Nếu huỷ → trả product về active
      await Product.findByIdAndUpdate(order.product, {
        status: 'active',
        buyer:  null,
        soldAt: null,
      });

      // Hoàn lại stats
      User.findByIdAndUpdate(order.seller, { $inc: { totalSales: -1 } }).catch(() => {});
      User.findByIdAndUpdate(order.buyer,  { $inc: { totalOrders: -1 } }).catch(() => {});
    }

    await order.save();

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
