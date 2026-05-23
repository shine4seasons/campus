const mongoose = require('mongoose');
const { findOrCreateConversation } = require('./conversation');
const { getConversationForUser, enrichConversationsForUser } = require('../../services/chatService');
const logger = require('../../utils/logger');
const chatRepository = require('../../repositories/chatRepository');

// 1. Khởi tạo cuộc trò chuyện (hoặc lấy cuộc trò chuyện hiện có)
exports.initChat = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const buyerId = req.user._id;

    if (!productId) return res.status(400).json({ success: false, message: 'Missing product ID' });

    const product = await chatRepository.findProductById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const sellerId = product.seller;

    // Không cho phép chat với chính mình
    if (String(buyerId) === String(sellerId)) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    const conv = await findOrCreateConversation(buyerId, sellerId, productId);

    res.json({ success: true, conversationId: conv._id });
  } catch (error) {
    return next(error);
  }
};

// 2. Lấy danh sách Inbox của user (tất cả conversations)
exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [total, convs] = await Promise.all([
      chatRepository.countConversationsForUser(userId),
      chatRepository.findConversationsForUser({ userId, page, limit })
    ]);

    const results = await enrichConversationsForUser(convs, userId);

    res.json({
      success: true,
      data: results,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return next(error);
  }
};

// 3. Lấy tin nhắn của 1 cuộc chat cụ thể
exports.getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conv = await getConversationForUser(id, userId);
    if (!conv) {
      logger.warn('chat.messages_forbidden_or_missing', {
        conversationId: String(id),
        userId: String(userId)
      });
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const messages = await chatRepository.findMessagesByConversationId(id);
    await chatRepository.markMessagesAsRead({ conversationId: id, userId });

    res.json({ success: true, data: messages });
  } catch (error) {
    return next(error);
  }
};

// 4. Gửi tin nhắn mới
exports.sendMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text, imageUrl } = req.body;
    const userId = req.user._id;

    const trimmedText = (text || '').trim();
    const cleanImageUrl = (imageUrl || '').trim() || null;

    if (!trimmedText && !cleanImageUrl) {
      return res.status(400).json({ success: false, message: 'Message must contain text or an image' });
    }

    const conv = await getConversationForUser(id, userId);
    if (!conv) {
      logger.warn('chat.send_forbidden_or_missing', {
        conversationId: String(id),
        userId: String(userId)
      });
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const msg = await chatRepository.createMessage({
      conversationId: id,
      sender: userId,
      text: trimmedText,
      imageUrl: cleanImageUrl
    });

    conv.lastMessage = trimmedText || (cleanImageUrl ? '📷 Image' : '');
    conv.updatedAt = new Date();
    await conv.save();

    const populatedMsg = await chatRepository.findMessageByIdWithSender(msg._id);

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
    return next(error);
  }
};
