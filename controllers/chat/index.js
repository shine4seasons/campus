const mongoose = require('mongoose');
const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const Product = require('../../models/Product');
const { findOrCreateConversation } = require('./conversation');

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

    const conv = await findOrCreateConversation(buyerId, sellerId, productId);

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
      .populate('product', 'title images price seller')
      .sort('-updatedAt')
      .lean();

    const results = [];
    for (let c of convs) {
      const unread = await Message.countDocuments({ conversationId: c._id, sender: { $ne: userId }, isRead: false }).catch(() => 0);
      c.unreadCount = unread;
      try {
        c.isSellerConversation = !!(c.product && String(c.product.seller) === String(userId));
      } catch (e) {
        c.isSellerConversation = false;
      }
      try {
        c.partner = (c.participants || []).find(p => String(p._id) !== String(userId)) || (c.participants && c.participants[0]) || null;
        c.partnerName = c.partner ? (c.partner.nickname || c.partner.name) : 'Unknown';
      } catch (e) {
        c.partner = null;
        c.partnerName = 'Unknown';
      }
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

    if (!conv.participants.includes(userId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const messages = await Message.find({ conversationId: id })
      .populate('sender', 'name nickname avatar')
      .sort('createdAt')
      .lean();

    await Message.updateMany({ conversationId: id, sender: { $ne: userId }, isRead: false }, { $set: { isRead: true } });

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

    if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Message text cannot be empty' });

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!conv.participants.includes(userId)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const msg = await Message.create({ conversationId: id, sender: userId, text: text.trim(), isRead: false });

    conv.lastMessage = text.trim();
    conv.updatedAt = new Date();
    await conv.save();

    const populatedMsg = await Message.findById(msg._id).populate('sender', 'name nickname avatar').lean();

    // Emit realtime event via Socket.IO
    try {
      const { getIO } = require('../../utils/socketServer');
      const io = getIO();
      if (io) io.to(`conv_${id}`).emit('message', populatedMsg);
    } catch (e) {
      console.error('Socket emit error:', e.message);
    }

    res.json({ success: true, data: populatedMsg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
