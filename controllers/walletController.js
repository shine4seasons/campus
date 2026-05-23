const mongoose = require('mongoose');
const walletRepository = require('../repositories/walletRepository');

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
exports.submitPayoutRequest = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, bankInfo } = req.body;
    const userId = req.user._id;
    const payoutAmount = Number(amount);
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
      status: 'PENDING'
    }, session);

    // 2. Deduct from available balance
    wallet.availableBalance -= payoutAmount;
    await wallet.save({ session });

    // 3. Create transaction record
    await walletRepository.createWalletTransaction({
      wallet: wallet._id,
      user: userId,
      type: 'WITHDRAW',
      amount: -payoutAmount,
      description: `Payout request to ${cleanBankInfo.bankName} (${cleanBankInfo.accountNumber})`,
      status: 'PENDING',
      referenceId: payout._id,
      referenceType: 'PayoutRequest'
    }, session);

    await session.commitTransaction();
    res.json({ success: true, message: 'Payout request submitted', data: payout });

  } catch (err) {
    await session.abortTransaction();
    console.error('[wallet] submitPayoutRequest:', err);
    return next(err);
  } finally {
    session.endSession();
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

