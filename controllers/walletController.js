const Wallet = require('../models/Wallet');
const PayoutRequest = require('../models/PayoutRequest');
const WalletTransaction = require('../models/WalletTransaction');
const mongoose = require('mongoose');

function sanitizeBankInfo(bankInfo = {}) {
  return {
    bankName: String(bankInfo.bankName || '').trim(),
    accountNumber: String(bankInfo.accountNumber || '').trim(),
    accountName: String(bankInfo.accountName || '').trim().toUpperCase()
  };
}

/**
 * Submit a payout request
 * POST /api/wallet/payout-request
 */
exports.submitPayoutRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, bankInfo } = req.body;
    const userId = req.user._id;
    const payoutAmount = Number(amount);
    const cleanBankInfo = sanitizeBankInfo(bankInfo);

    if (!Number.isFinite(payoutAmount) || payoutAmount < 50000) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal is 50,000 VND' });
    }
    if (!cleanBankInfo.bankName || !cleanBankInfo.accountNumber || !cleanBankInfo.accountName) {
      return res.status(400).json({ success: false, message: 'Bank account details are required' });
    }

    const wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet || wallet.availableBalance < payoutAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // 1. Create payout request
    const payout = new PayoutRequest({
      user: userId,
      amount: payoutAmount,
      bankInfo: cleanBankInfo,
      status: 'PENDING'
    });
    await payout.save({ session });

    // 2. Deduct from available balance
    wallet.availableBalance -= payoutAmount;
    await wallet.save({ session });

    // 3. Create transaction record
    const transaction = new WalletTransaction({
      wallet: wallet._id,
      user: userId,
      type: 'WITHDRAW',
      amount: -payoutAmount,
      description: `Payout request to ${cleanBankInfo.bankName} (${cleanBankInfo.accountNumber})`,
      status: 'PENDING',
      referenceId: payout._id,
      referenceType: 'PayoutRequest'
    });
    await transaction.save({ session });

    await session.commitTransaction();
    res.json({ success: true, message: 'Payout request submitted', data: payout });

  } catch (err) {
    await session.abortTransaction();
    console.error('[wallet] submitPayoutRequest:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * Get wallet transactions
 * GET /api/wallet/transactions
 */
exports.getTransactions = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.json({ success: true, data: [] });
    }

    const transactions = await WalletTransaction.find({ wallet: wallet._id })
      .sort('-createdAt')
      .limit(50);

    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get seller payout requests
 * GET /api/wallet/payout-requests
 */
exports.getPayoutRequests = async (req, res) => {
  try {
    const payouts = await PayoutRequest.find({ user: req.user._id })
      .sort('-createdAt')
      .limit(30)
      .lean();

    res.json({ success: true, data: payouts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
