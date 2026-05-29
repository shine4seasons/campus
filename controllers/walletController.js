const mongoose = require('mongoose');
const walletRepository = require('../repositories/walletRepository');
const logger = require('../utils/logger');
const {
  PAYOUT_STATUS,
  WALLET_TRANSACTION_STATUS,
  WALLET_TRANSACTION_TYPES
} = require('../config/appConstants');

function sanitizeBankInfo(bankInfo = {}) {
  return {
    bankName: String(bankInfo.bankName || '').trim(),
    accountNumber: String(bankInfo.accountNumber || '').trim(),
    accountName: String(bankInfo.accountName || '').trim().toUpperCase()
  };
}

function normalizePayoutAmount(amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return Number.NaN;
  return Math.trunc(numericAmount);
}

async function buildWalletOverview(userId) {
  const wallet = await walletRepository.findWalletByUser(userId);
  const [transactions, payouts, payoutStats] = await Promise.all([
    wallet ? walletRepository.findTransactionsByWallet(wallet._id, 20) : Promise.resolve([]),
    walletRepository.findPayoutRequestsByUser(userId, 20),
    walletRepository.getPayoutStatsByUser(userId)
  ]);

  const walletSnapshot = wallet
    ? {
      availableBalance: wallet.availableBalance || 0,
      pendingBalance: wallet.pendingBalance || 0,
      totalSales: wallet.totalSales || 0
    }
    : {
      availableBalance: 0,
      pendingBalance: 0,
      totalSales: 0
    };

  return {
    wallet: walletSnapshot,
    transactions,
    payouts,
    payoutStats
  };
}

/**
 * Submit a payout request
 * POST /api/wallet/payout-request
 */
exports.submitPayoutRequest = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, bankInfo } = req.body;
    const userId = req.user._id;
    const payoutAmount = normalizePayoutAmount(amount);
    const cleanBankInfo = sanitizeBankInfo(bankInfo);

    if (!Number.isFinite(payoutAmount) || payoutAmount < 50000) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Minimum withdrawal is 50,000 VND' });
    }
    if (!cleanBankInfo.bankName || !cleanBankInfo.accountNumber || !cleanBankInfo.accountName) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Bank account details are required' });
    }

    const wallet = await walletRepository.findWalletByUser(userId, session);
    if (!wallet || wallet.availableBalance < payoutAmount) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // 1. Create payout request
    const payout = await walletRepository.createPayoutRequest({
      user: userId,
      amount: payoutAmount,
      bankInfo: cleanBankInfo,
      status: PAYOUT_STATUS.PENDING
    }, session);

    // 2. Deduct from available balance
    wallet.availableBalance -= payoutAmount;
    await wallet.save({ session });

    // 3. Create transaction record
    await walletRepository.createWalletTransaction({
      wallet: wallet._id,
      user: userId,
      type: WALLET_TRANSACTION_TYPES.WITHDRAW,
      amount: -payoutAmount,
      description: `Payout request to ${cleanBankInfo.bankName} (${cleanBankInfo.accountNumber})`,
      status: WALLET_TRANSACTION_STATUS.PENDING,
      referenceId: payout._id,
      referenceType: 'PayoutRequest',
      idempotencyKey: `PAYOUT_REQUEST:${payout._id}`
    }, session);

    await session.commitTransaction();
    const overview = await buildWalletOverview(userId);
    res.json({
      success: true,
      message: 'Payout request submitted',
      data: {
        payout,
        ...overview
      }
    });

  } catch (err) {
    await session.abortTransaction();
    logger.error('wallet.payout_request_failed', {
      err: err.message,
      stack: err.stack,
      userId: req.user?._id ? String(req.user._id) : null
    });
    return next(err);
  } finally {
    session.endSession();
  }
};

/**
 * Get wallet summary, recent transactions, and payout history
 * GET /api/wallet/summary
 */
exports.getSummary = async (req, res, next) => {
  try {
    const overview = await buildWalletOverview(req.user._id);
    res.json({ success: true, data: overview });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get wallet transactions
 * GET /api/wallet/transactions
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const wallet = await walletRepository.findWalletByUser(req.user._id);
    if (!wallet) {
      return res.json({ success: true, data: [] });
    }

    const transactions = await walletRepository.findTransactionsByWallet(wallet._id, 50);

    res.json({ success: true, data: transactions });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get seller payout requests
 * GET /api/wallet/payout-requests
 */
exports.getPayoutRequests = async (req, res, next) => {
  try {
    const payouts = await walletRepository.findPayoutRequestsByUser(req.user._id, 30);

    res.json({ success: true, data: payouts });
  } catch (err) {
    return next(err);
  }
};

