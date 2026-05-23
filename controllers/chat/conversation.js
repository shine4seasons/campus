const chatRepository = require('../../repositories/chatRepository');

async function findOrCreateConversation(buyerId, sellerId, productId) {
  let conv = await chatRepository.findConversationByParticipants(buyerId, sellerId);

  if (!conv) {
    conv = await chatRepository.createConversation({ buyerId, sellerId, productId });
  } else {
    conv.product = productId;
    await conv.save();
  }

  return conv;
}

module.exports = { findOrCreateConversation };
