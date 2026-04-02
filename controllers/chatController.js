const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Product = require('../models/Product');

// 1. Khởi tạo cuộc trò chuyện (hoặc lấy cuộc trò chuyện hiện có)
exports.initChat = async (req, res) => {
  try {
    const { productId } = req.body;
    const buyerId = req.user._id;

    if (!productId) return res.status(400).json({ success: false, message: 'Missing product ID' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const sellerId = product.seller;

    // Không cho phép chat với chính mình
    if (String(buyerId) === String(sellerId)) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    // Tìm conversation theo cặp người dùng (không lọc theo product)
    // → cùng 1 người bán chỉ có đúng 1 cuộc hội thoại
    let conv = await Conversation.findOne({
      participants: { $all: [buyerId, sellerId] }
    });

    if (!conv) {
      // Chưa có → tạo mới
      conv = await Conversation.create({
        participants: [buyerId, sellerId],
        product: productId,
        lastMessage: ''
      });
    } else {
      // Đã có → cập nhật product context sang sản phẩm vừa bấm
      // (để banner ở trang messages luôn hiện đúng sản phẩm mới nhất)
      conv.product = productId;
      await conv.save();
    }

    res.json({ success: true, conversationId: conv._id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Lấy danh sách Inbox của user (tất cả conversations)
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const convs = await Conversation.find({ participants: userId })
      .populate('participants', 'name nickname avatar')
      .populate('product', 'title images price')
      .sort('-updatedAt')
      .lean();

    // Lấy thêm số lượng tin nhắn chưa đọc
    const results = [];
    for (let c of convs) {
      const unread = await Message.countDocuments({
        conversationId: c._id,
        sender: { $ne: userId },
        isRead: false
      });
      c.unreadCount = unread;
      results.push(c);
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Lấy tin nhắn của 1 cuộc chat cụ thể
exports.getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });

    // Check permission
    if (!conv.participants.includes(userId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Lấy messages
    const messages = await Message.find({ conversationId: id })
      .populate('sender', 'name nickname avatar')
      .sort('createdAt')
      .lean();

    // Mark as read cho tin nhắn của người kia gửi
    await Message.updateMany(
      { conversationId: id, sender: { $ne: userId }, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Gửi tin nhắn mới
exports.sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text cannot be empty' });
    }

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });

    if (!conv.participants.includes(userId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Tạo tin nhắn
    const msg = await Message.create({
      conversationId: id,
      sender: userId,
      text: text.trim(),
      isRead: false
    });

    // Cập nhật last message và chạm updatedAt để trồi lên trên inbox
    conv.lastMessage = text.trim();
    conv.updatedAt = new Date();
    await conv.save();

    // Lấy chi tiết sender để trả về client (cho polling update)
    const populatedMsg = await Message.findById(msg._id)
      .populate('sender', 'name nickname avatar')
      .lean();

    res.json({ success: true, data: populatedMsg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};