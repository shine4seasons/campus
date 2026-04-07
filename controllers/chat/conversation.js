const Conversation = require('../../models/Conversation');

async function findOrCreateConversation(buyerId, sellerId, productId) {
  let conv = await Conversation.findOne({ participants: { $all: [buyerId, sellerId] } });

  if (!conv) {
    conv = await Conversation.create({
      participants: [buyerId, sellerId],
      product: productId,
      lastMessage: '',
    });
  } else {
    conv.product = productId;
    await conv.save();
  }

  return conv;
}

module.exports = { findOrCreateConversation };
