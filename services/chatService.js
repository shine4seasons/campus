const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

async function getConversationForUser(conversationId, userId) {
  return Conversation.findOne({ _id: conversationId, participants: userId });
}

async function enrichConversationsForUser(convs, userId) {
  const ids = convs.map((c) => c._id);
  const counts = ids.length > 0
    ? await Message.aggregate([
      { $match: { conversationId: { $in: ids }, isRead: false, sender: { $ne: userId } } },
      { $group: { _id: '$conversationId', count: { $sum: 1 } } },
    ]).catch(() => [])
    : [];
  const byConv = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

  return convs.map((c) => {
    const copy = { ...c };
    copy.unreadCount = byConv[String(c._id)] || 0;
    copy.isSellerConversation = !!(c.product && String(c.product.seller) === String(userId));
    copy.partner = (c.participants || []).find((p) => String(p._id) !== String(userId))
      || (c.participants && c.participants[0]) || null;
    copy.partnerName = copy.partner ? (copy.partner.nickname || copy.partner.name) : 'Unknown';
    return copy;
  });
}

module.exports = {
  getConversationForUser,
  enrichConversationsForUser
};
