const {
  ORDER_STATUS,
  DISPUTE_STATUS,
  DISPUTE_CATEGORIES,
  DISPUTE_RESOLUTIONS,
  NOTIFICATION_TYPES,
  USER_ROLES,
} = require('../../config/appConstants');
const { releaseProductForOrder } = require('../../services/inventoryService');
const orderRepository = require('../../repositories/orderRepository');

// Statuses on which a party may open a dispute
const DISPUTABLE_STATUSES = [ORDER_STATUS.CONFIRMED, ORDER_STATUS.COMPLETED];

// POST /api/orders/:id/dispute — buyer or seller opens a dispute
exports.openDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const uid = String(req.user._id);
    const { category = 'other', reason = '', description = '', evidenceImages = [] } = req.body;

    const trimReason = (reason || '').trim();
    if (!trimReason) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }
    if (!DISPUTE_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid dispute category' });
    }
    if (!Array.isArray(evidenceImages) || evidenceImages.some(x => typeof x !== 'string')) {
      return res.status(400).json({ success: false, message: 'evidenceImages must be an array of URLs' });
    }
    if (evidenceImages.length > 6) {
      return res.status(400).json({ success: false, message: 'Maximum 6 evidence images' });
    }

    const order = await orderRepository.findOrderForDispute(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const isBuyer  = String(order.buyer)  === uid;
    const isSeller = String(order.seller) === uid;
    if (!isBuyer && !isSeller) {
      return res.status(403).json({ success: false, message: 'Only the buyer or seller can open a dispute' });
    }

    if (!DISPUTABLE_STATUSES.includes(order.status)) {
      return res.status(400).json({ success: false, message: 'You can only dispute confirmed or completed orders' });
    }

    if (order.dispute && order.dispute.status !== DISPUTE_STATUS.RESOLVED && order.dispute.status !== DISPUTE_STATUS.REJECTED) {
      return res.status(409).json({ success: false, message: 'A dispute is already open for this order' });
    }

    const now = new Date();
    const dispute = {
      status: DISPUTE_STATUS.OPEN,
      openedBy: req.user._id,
      openedRole: isBuyer ? 'buyer' : 'seller',
      category,
      reason: trimReason.substring(0, 200),
      description: (description || '').trim().substring(0, 2000),
      evidenceImages: evidenceImages.slice(0, 6),
      openedAt: now,
      resolvedBy: null,
      resolution: '',
      resolutionNote: '',
      resolvedAt: null,
    };

    // Atomic update: only succeeds if no open dispute exists
    const updated = await orderRepository.openDisputeOnOrder({
      orderId: id,
      dispute,
      actorId: req.user._id,
      note: `Dispute opened by ${isBuyer ? 'buyer' : 'seller'}: ${trimReason.substring(0, 80)}`
    });

    if (!updated) {
      return res.status(409).json({ success: false, message: 'Could not open dispute — a dispute may already be active' });
    }

    // Notify the other party + log
    try {
      const { sendNotification } = require('../../utils/notifService');
      const recipientId = isBuyer ? order.seller : order.buyer;
      await sendNotification({
        recipient: recipientId,
        sender: req.user._id,
        type: NOTIFICATION_TYPES.DISPUTE,
        title: 'Order disputed',
        message: `${isBuyer ? 'Buyer' : 'Seller'} opened a dispute: ${trimReason.substring(0, 100)}`,
        link: `/orders/tracking/${order._id}`
      });
    } catch (notifErr) {
      console.error('[dispute] notification error:', notifErr);
    }

    res.status(201).json({ success: true, data: updated.dispute });
  } catch (err) {
    console.error('[dispute] openDispute:', err);
    return next(err);
  }
};

// POST /api/orders/:id/dispute/resolve — admin only
exports.resolveDispute = async (req, res, next) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { id } = req.params;
    const { resolution, resolutionNote = '', refund = false } = req.body;

    const validResolutions = Object.values(DISPUTE_RESOLUTIONS);
    if (!validResolutions.includes(resolution)) {
      return res.status(400).json({ success: false, message: 'Invalid resolution' });
    }

    const order = await orderRepository.findOrderForDispute(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!order.dispute) return res.status(400).json({ success: false, message: 'No dispute to resolve' });
    if (order.dispute.status === DISPUTE_STATUS.RESOLVED || order.dispute.status === DISPUTE_STATUS.REJECTED) {
      return res.status(409).json({ success: false, message: 'Dispute already resolved' });
    }

    const now = new Date();
    const newStatus = resolution === DISPUTE_RESOLUTIONS.REJECTED ? DISPUTE_STATUS.REJECTED : DISPUTE_STATUS.RESOLVED;

    const setFields = {
      'dispute.status':         newStatus,
      'dispute.resolvedBy':     req.user._id,
      'dispute.resolution':     resolution,
      'dispute.resolutionNote': (resolutionNote || '').trim().substring(0, 1000),
      'dispute.resolvedAt':     now,
    };

    // If admin rules buyer-favor + refund flag → revert order to cancelled, release product
    let extraTimelineNote = `Dispute ${newStatus} (${resolution})`;
    if (refund && resolution === DISPUTE_RESOLUTIONS.BUYER_FAVOR && order.status !== ORDER_STATUS.CANCELLED) {
      setFields.status      = ORDER_STATUS.CANCELLED;
      setFields.cancelledAt = now;
      extraTimelineNote += ' · Order refunded & cancelled';
    }

    const updated = await orderRepository.resolveDisputeOnOrder({
      orderId: id,
      setFields,
      actorId: req.user._id,
      note: extraTimelineNote
    });

    if (!updated) {
      return res.status(409).json({ success: false, message: 'Dispute already resolved by another admin' });
    }

    // If buyer-favor refund: also release the product back to ACTIVE
    if (refund && resolution === DISPUTE_RESOLUTIONS.BUYER_FAVOR) {
      try {
        await releaseProductForOrder(updated);
      } catch (prodErr) {
        console.error('[dispute] product release error:', prodErr);
      }
    }

    // Notify both buyer and seller
    try {
      const { sendNotification } = require('../../utils/notifService');
      const message = `Admin resolved your dispute: ${resolution.replace('-', ' ')}`;
      await Promise.all([
        sendNotification({
          recipient: updated.buyer,
          sender: req.user._id,
          type: NOTIFICATION_TYPES.DISPUTE,
          title: 'Dispute resolved',
          message,
          link: `/orders/tracking/${updated._id}`
        }),
        sendNotification({
          recipient: updated.seller,
          sender: req.user._id,
          type: NOTIFICATION_TYPES.DISPUTE,
          title: 'Dispute resolved',
          message,
          link: `/orders/tracking/${updated._id}`
        }),
      ]);
    } catch (notifErr) {
      console.error('[dispute] resolve notification error:', notifErr);
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[dispute] resolveDispute:', err);
    return next(err);
  }
};

// GET /api/orders/disputes/all — admin list of all disputes
exports.getAllDisputes = async (req, res, next) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const status = req.query.status || 'open';     // open | resolved | all
    const page   = Math.max(parseInt(req.query.page,  10) || 1, 1);
    const limit  = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip   = (page - 1) * limit;

    const filter = { dispute: { $ne: null } };
    if (status === 'open') {
      filter['dispute.status'] = { $in: [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.IN_REVIEW] };
    } else if (status === 'resolved') {
      filter['dispute.status'] = { $in: [DISPUTE_STATUS.RESOLVED, DISPUTE_STATUS.REJECTED] };
    }

    const result = await orderRepository.findDisputes({ status, page, limit });

    res.json({
      success: true,
      data: result.orders,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasMore: result.hasMore
      }
    });
  } catch (err) {
    console.error('[dispute] getAllDisputes:', err);
    return next(err);
  }
};

