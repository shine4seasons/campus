const chatRepository = require('../repositories/chatRepository');

async function getConversationForUser(conversationId, userId) {
  return chatRepository.findConversationByIdForUser(conversationId, userId);
}

async function enrichConversationsForUser(convs, userId) {
  const ids = convs.map((conversation) => conversation._id);
  const unreadByConversation = await chatRepository.countUnreadMessagesByConversationIds({
    conversationIds: ids,
    userId
  });

  return convs.map((c) => {
    const copy = { ...c };
    copy.unreadCount = unreadByConversation[String(c._id)] || 0;
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
