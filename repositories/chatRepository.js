const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Product = require('../models/Product');

function findProductById(productId) {
  return Product.findById(productId);
}

function findConversationByParticipants(buyerId, sellerId) {
  return Conversation.findOne({ participants: { $all: [buyerId, sellerId] } });
}

function createConversation({ buyerId, sellerId, productId }) {
  return Conversation.create({
    participants: [buyerId, sellerId],
    product: productId,
    lastMessage: ''
  });
}

function countConversationsForUser(userId) {
  return Conversation.countDocuments({ participants: userId });
}

function findConversationsForUser({ userId, page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;
  return Conversation.find({ participants: userId })
    .sort('-updatedAt')
    .skip(skip)
    .limit(limit)
    .populate('participants', 'name nickname avatar')
    .populate('product', 'title images price seller')
    .lean();
}

function findMessagesByConversationId(conversationId) {
  return Message.find({ conversationId })
    .populate('sender', 'name nickname avatar')
    .sort('createdAt')
    .lean();
}

function markMessagesAsRead({ conversationId, userId }) {
  return Message.updateMany(
    { conversationId, sender: { $ne: userId }, isRead: false },
    { $set: { isRead: true } }
  );
}

function createMessage({ conversationId, sender, text, imageUrl }) {
  return Message.create({
    conversationId,
    sender,
    text,
    imageUrl,
    isRead: false
  });
}

function findMessageByIdWithSender(messageId) {
  return Message.findById(messageId).populate('sender', 'name nickname avatar').lean();
}

module.exports = {
  findProductById,
  findConversationByParticipants,
  createConversation,
  countConversationsForUser,
  findConversationsForUser,
  findMessagesByConversationId,
  markMessagesAsRead,
  createMessage,
  findMessageByIdWithSender
};
