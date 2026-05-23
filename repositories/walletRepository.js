const Wallet = require('../models/Wallet');
const PayoutRequest = require('../models/PayoutRequest');
const WalletTransaction = require('../models/WalletTransaction');

function findWalletByUser(userId, session = null) {
  const query = Wallet.findOne({ user: userId });
  return session ? query.session(session) : query;
}

function createPayoutRequest(data, session = null) {
  const payout = new PayoutRequest(data);
  return payout.save({ session });
}

function createWalletTransaction(data, session = null) {
  const transaction = new WalletTransaction(data);
  return transaction.save({ session });
}

function findTransactionsByWallet(walletId, limit = 50) {
  return WalletTransaction.find({ wallet: walletId })
    .sort('-createdAt')
    .limit(limit);
}

function findPayoutRequestsByUser(userId, limit = 30) {
  return PayoutRequest.find({ user: userId })
    .sort('-createdAt')
    .limit(limit)
    .lean();
}

module.exports = {
  findWalletByUser,
  createPayoutRequest,
  createWalletTransaction,
  findTransactionsByWallet,
  findPayoutRequestsByUser
};
