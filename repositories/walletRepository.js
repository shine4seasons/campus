const Wallet = require('../models/Wallet');
const PayoutRequest = require('../models/PayoutRequest');
const WalletTransaction = require('../models/WalletTransaction');
const { PAYOUT_STATUS } = require('../config/appConstants');

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

function createWalletTransactions(entries, session = null) {
  return WalletTransaction.create(entries, session ? { session } : undefined);
}

function upsertWalletForUser(userId, update, options = {}) {
  return Wallet.findOneAndUpdate(
    { user: userId },
    update,
    { new: true, upsert: true, ...options }
  );
}

function findTransactionsByWallet(walletId, limit = 50) {
  return WalletTransaction.find({ wallet: walletId })
    .sort('-createdAt')
    .limit(limit)
    .lean();
}

function findTransactionByIdempotencyKey(idempotencyKey, session = null) {
  const query = WalletTransaction.findOne({ idempotencyKey });
  return session ? query.session(session) : query;
}

function findPayoutRequestsByUser(userId, limit = 30) {
  return PayoutRequest.find({ user: userId })
    .sort('-createdAt')
    .limit(limit)
    .lean();
}

async function getPayoutStatsByUser(userId) {
  const counts = await PayoutRequest.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  return counts.reduce((acc, item) => {
    if (Object.prototype.hasOwnProperty.call(acc, item._id)) {
      acc[item._id] = item.count;
    }
    return acc;
  }, {
    [PAYOUT_STATUS.PENDING]: 0,
    [PAYOUT_STATUS.PROCESSING]: 0,
    [PAYOUT_STATUS.PAID]: 0,
    [PAYOUT_STATUS.REJECTED]: 0
  });
}

module.exports = {
  findWalletByUser,
  createPayoutRequest,
  createWalletTransaction,
  createWalletTransactions,
  upsertWalletForUser,
  findTransactionsByWallet,
  findTransactionByIdempotencyKey,
  findPayoutRequestsByUser,
  getPayoutStatsByUser
};
