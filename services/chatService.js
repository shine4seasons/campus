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
    const sellerId = c.product && c.product.seller && (c.product.seller._id || c.product.seller);
    copy.unreadCount = unreadByConversation[String(c._id)] || 0;
    copy.isSellerConversation = !!(sellerId && String(sellerId) === String(userId));
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
