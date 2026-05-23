const mongoose = require('mongoose');
const adminRepository = require('../../repositories/adminRepository');
const { broadcastSystemAnnouncement } = require('../../services/adminService');
const { PRODUCT_STATUS, NOTIFICATION_TYPES } = require('../../config/appConstants');

const { PAYOUT_STATUS } = adminRepository;

const getUsers = async (req, res, next) => {
  try {
    const result = await adminRepository.findAdminUsers(req.query);
    res.json({
      success: true,
      data: result.users,
      pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages }
    });
  } catch (err) {
    return next(err);
  }
};

const toggleBan = async (req, res, next) => {
  try {
    const uid = req.params.id;
    const { banned } = req.body;
    const user = await adminRepository.updateUserBanStatus(uid, banned);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    try {
      const { sendNotification } = require('../../utils/notifService');
      await sendNotification({
        recipient: uid,
        sender: req.user._id,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: banned ? 'Account Banned' : 'Account Reinstated',
        message: banned
          ? 'Your account has been banned due to policy violations.'
          : 'Your account has been restored. Please follow our community guidelines.',
        link: '#'
      });
    } catch (notifErr) {
      console.error('Ban notification error:', notifErr);
    }

    res.json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const result = await adminRepository.findAdminOrders(req.query);
    res.json({
      success: true,
      data: result.orders,
      pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages }
    });
  } catch (err) {
    return next(err);
  }
};

const getProducts = async (req, res, next) => {
  try {
    const result = await adminRepository.findAdminProducts(req.query);
    res.json({
      success: true,
      data: result.products,
      pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages }
    });
  } catch (err) {
    return next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const data = await adminRepository.getAdminStatsSummary();
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

const getGMVMonths = async (req, res, next) => {
  try {
    const data = await adminRepository.getAdminGMVMonths();
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

const getCategoryDistribution = async (req, res, next) => {
  try {
    const data = await adminRepository.getAdminCategoryDistribution();
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

const hideProduct = async (req, res, next) => {
  try {
    const pid = req.params.id;
    const product = await adminRepository.updateAdminProductStatus(pid, PRODUCT_STATUS.HIDDEN);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    try {
      const { sendNotification } = require('../../utils/notifService');
      await sendNotification({
        recipient: product.seller,
        sender: req.user._id,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: 'Product Hidden',
        message: `Your product "${product.title}" has been hidden by moderation. Please check the details and update it if needed.`,
        link: `/products/${product._id}`
      });
    } catch (notifErr) {
      console.error('Hide product notification error:', notifErr);
    }

    res.json({ success: true, data: product });
  } catch (err) {
    return next(err);
  }
};

const restoreProduct = async (req, res, next) => {
  try {
    const pid = req.params.id;
    const product = await adminRepository.updateAdminProductStatus(pid, PRODUCT_STATUS.ACTIVE);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    try {
      const { sendNotification } = require('../../utils/notifService');
      await sendNotification({
        recipient: product.seller,
        sender: req.user._id,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: 'Product Live',
        message: `Your product "${product.title}" is now visible to everyone!`,
        link: `/products/${product._id}`
      });
    } catch (notifErr) {
      console.error('Restore product notification error:', notifErr);
    }

    res.json({ success: true, data: product });
  } catch (err) {
    return next(err);
  }
};

const deleteProductAdmin = async (req, res, next) => {
  try {
    const pid = req.params.id;
    const product = await adminRepository.findAdminProductById(pid);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    await adminRepository.deleteAdminProduct(product);
    res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const data = await adminRepository.getAdminAnalyticsSnapshot();
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

const getReportsData = async (req, res, next) => {
  try {
    const data = await adminRepository.getAdminReportsDataSnapshot();
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

const getReports = async (req, res, next) => {
  try {
    const result = await adminRepository.findAdminReports(req.query);
    res.json({
      success: true,
      data: result.reports,
      pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages }
    });
  } catch (err) {
    return next(err);
  }
};

const updateReport = async (req, res, next) => {
  try {
    const reportId = req.params.id;
    const { status, adminNotes } = req.body;
    const validStatuses = ['pending', 'under-review', 'resolved', 'dismissed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updateData = { $set: {} };
    if (status) {
      updateData.$set.status = status;
      updateData.$set.resolvedAt = new Date();
      updateData.$set.resolvedBy = req.user._id;
    }
    if (adminNotes) {
      updateData.$set.adminNotes = adminNotes;
    }

    const report = await adminRepository.updateAdminReport(reportId, updateData);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    try {
      const { sendNotification } = require('../../utils/notifService');
      const statusLabel = status === 'resolved' ? 'Resolved' : (status === 'dismissed' ? 'Dismissed' : 'Updated');
      await sendNotification({
        recipient: report.reporter,
        sender: req.user._id,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: 'Report Update',
        message: `Your report has been ${statusLabel.toLowerCase()} by an administrator.`,
        link: '#'
      });
    } catch (notifErr) {
      console.error('Report notification error:', notifErr);
    }

    res.json({ success: true, data: report });
  } catch (err) {
    return next(err);
  }
};

const getSettings = async (req, res, next) => {
  try {
    const settings = await adminRepository.findOrCreateSystemSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    return next(err);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const { platformName, serviceFee, productImageLimit, supportEmail, announcement } = req.body;
    const settings = await adminRepository.updateSystemSettings({
      platformName,
      serviceFee,
      productImageLimit,
      supportEmail,
      lastUpdatedBy: req.user._id
    });

    if (announcement && announcement.trim()) {
      await broadcastSystemAnnouncement({
        senderId: req.user._id,
        message: announcement
      });
    }

    res.json({ success: true, data: settings, message: 'Settings updated successfully' });
  } catch (err) {
    return next(err);
  }
};

const getPayouts = async (req, res, next) => {
  try {
    const result = await adminRepository.findAdminPayouts(req.query);
    res.json({
      success: true,
      data: result.payouts,
      stats: result.stats,
      pagination: {
        totalRecords: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    return next(err);
  }
};

const approvePayout = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payoutId = req.params.id;
    const { adminNote } = req.body;

    const payout = await adminRepository.findPayoutById(payoutId, session);
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout request not found' });
    }
    if (payout.status !== PAYOUT_STATUS.PENDING) {
      return res.status(400).json({ success: false, message: 'Only pending payout requests can be approved' });
    }

    payout.status = PAYOUT_STATUS.PROCESSING;
    payout.adminNote = adminNote || '';
    payout.processedAt = new Date();
    payout.processedBy = req.user._id;
    await adminRepository.savePayout(payout, session);
    await adminRepository.updatePayoutTransactionStatus(payout._id, 'PENDING', session);

    try {
      const { sendNotification } = require('../../utils/notifService');
      const formatMoney = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount)} VND`;
      await sendNotification({
        recipient: payout.user,
        sender: req.user._id,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: 'Payout Approved',
        message: `Your payout request of ${formatMoney(payout.amount)} has been approved and is waiting for bank transfer.`,
        link: '#'
      });
    } catch (notifErr) {
      console.error('Payout approval notification error:', notifErr);
    }

    await session.commitTransaction();
    res.json({ success: true, message: 'Payout request moved to processing', data: payout });
  } catch (err) {
    await session.abortTransaction();
    console.error('[admin] approvePayout:', err);
    return next(err);
  } finally {
    session.endSession();
  }
};

const markPayoutPaid = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payoutId = req.params.id;
    const { adminNote, transferReference, transferNote } = req.body;

    const payout = await adminRepository.findPayoutById(payoutId, session);
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout request not found' });
    }
    if (payout.status !== PAYOUT_STATUS.PROCESSING) {
      return res.status(400).json({ success: false, message: 'Only processing payouts can be marked as paid' });
    }

    payout.status = PAYOUT_STATUS.PAID;
    payout.adminNote = adminNote || payout.adminNote || '';
    payout.transferReference = String(transferReference || '').trim();
    payout.transferNote = String(transferNote || '').trim();
    payout.paidAt = new Date();
    payout.paidBy = req.user._id;
    await adminRepository.savePayout(payout, session);
    await adminRepository.updatePayoutTransactionStatus(payout._id, 'COMPLETED', session);

    try {
      const { sendNotification } = require('../../utils/notifService');
      const formatMoney = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount)} VND`;
      await sendNotification({
        recipient: payout.user,
        sender: req.user._id,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: 'Payout Sent',
        message: `Your payout of ${formatMoney(payout.amount)} has been transferred to your bank account.`,
        link: '#'
      });
    } catch (notifErr) {
      console.error('Payout paid notification error:', notifErr);
    }

    await session.commitTransaction();
    res.json({ success: true, message: 'Payout marked as paid', data: payout });
  } catch (err) {
    await session.abortTransaction();
    console.error('[admin] markPayoutPaid:', err);
    return next(err);
  } finally {
    session.endSession();
  }
};

const rejectPayout = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payoutId = req.params.id;
    const { adminNote } = req.body;

    if (!adminNote || !adminNote.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const payout = await adminRepository.findPayoutById(payoutId, session);
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout request not found' });
    }
    if (![PAYOUT_STATUS.PENDING, PAYOUT_STATUS.PROCESSING].includes(payout.status)) {
      return res.status(400).json({ success: false, message: 'Only pending or processing payouts can be rejected' });
    }

    payout.status = PAYOUT_STATUS.REJECTED;
    payout.adminNote = adminNote;
    payout.processedAt = new Date();
    payout.processedBy = req.user._id;
    await adminRepository.savePayout(payout, session);

    const wallet = await adminRepository.findWalletByUser(payout.user, session);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'User wallet not found' });
    }

    wallet.availableBalance += payout.amount;
    await adminRepository.saveWallet(wallet, session);

    const refundTx = adminRepository.createRefundWalletTransaction({
      walletId: wallet._id,
      userId: payout.user,
      amount: payout.amount,
      adminNote,
      payoutId: payout._id
    });
    await adminRepository.saveWalletTransaction(refundTx, session);
    await adminRepository.updatePayoutTransactionStatus(payout._id, 'FAILED', session);

    try {
      const { sendNotification } = require('../../utils/notifService');
      const formatMoney = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount)} VND`;
      await sendNotification({
        recipient: payout.user,
        sender: req.user._id,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: 'Withdrawal Rejected',
        message: `Your withdrawal request of ${formatMoney(payout.amount)} was rejected. Reason: ${adminNote}. Funds have been refunded to your wallet.`,
        link: '#'
      });
    } catch (notifErr) {
      console.error('Payout rejection notification error:', notifErr);
    }

    await session.commitTransaction();
    res.json({ success: true, message: 'Payout request rejected', data: payout });
  } catch (err) {
    await session.abortTransaction();
    console.error('[admin] rejectPayout:', err);
    return next(err);
  } finally {
    session.endSession();
  }
};

module.exports = {
  getUsers,
  toggleBan,
  getOrders,
  getProducts,
  getStats,
  getGMVMonths,
  getCategoryDistribution,
  hideProduct,
  restoreProduct,
  deleteProductAdmin,
  getAnalytics,
  getReportsData,
  getReports,
  updateReport,
  getSettings,
  updateSettings,
  getPayouts,
  approvePayout,
  markPayoutPaid,
  rejectPayout
};
