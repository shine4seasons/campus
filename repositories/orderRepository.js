const mongoose = require('mongoose');
const Order = require('../models/Order');
const { ORDER_STATUS, DISPUTE_STATUS } = require('../config/appConstants');

function findOrdersForUser({ userId, role, status, page = 1, limit = 10 }) {
  const filter = role === 'seller' ? { seller: userId } : { buyer: userId };
  if (status && status !== 'all') filter.status = status;
  const skip = (Number(page) - 1) * Number(limit);

  return Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit))
      .populate('product', 'title images price category')
      .populate('buyer', 'name nickname avatar')
      .populate('seller', 'name nickname avatar')
      .lean()
  ]).then(([total, orders]) => ({
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
    orders
  }));
}

async function countOrdersByStatusForUser({ userId, role }) {
  const filter = role === 'seller' ? { seller: userId } : { buyer: userId };
  const agg = await Order.aggregate([
    { $match: filter },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const out = {
    [ORDER_STATUS.PENDING]: 0,
    [ORDER_STATUS.CONFIRMED]: 0,
    [ORDER_STATUS.COMPLETED]: 0,
    [ORDER_STATUS.CANCELLED]: 0
  };
  agg.forEach((item) => {
    out[item._id] = item.count;
  });
  return out;
}

function findOrderDetailById(orderId) {
  return Order.findById(orderId)
    .populate('product', 'title images price category condition location')
    .populate('buyer', 'name nickname avatar phone')
    .populate('seller', 'name nickname avatar phone')
    .populate('timeline.actor', 'name nickname avatar')
    .lean();
}

async function getOrderAnalyticsForUser({ userId, role }) {
  const objectUserId = new mongoose.Types.ObjectId(userId);
  const filter = role === 'seller' ? { seller: objectUserId } : { buyer: objectUserId };
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const [revAgg, catAgg, kpiAgg, monthAgg] = await Promise.all([
    Order.aggregate([
      { $match: { ...filter, createdAt: { $gte: start }, status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$priceSnapshot' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    Order.aggregate([
      { $match: { ...filter, status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'prod' } },
      { $unwind: '$prod' },
      { $group: { _id: { $ifNull: ['$prod.category', 'Other'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Order.aggregate([
      { $match: { ...filter, status: ORDER_STATUS.COMPLETED } },
      { $group: { _id: null, totalRev: { $sum: '$priceSnapshot' }, totalSold: { $sum: '$quantity' } } }
    ]),
    Order.aggregate([
      { $match: { ...filter, status: ORDER_STATUS.COMPLETED, createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } } },
      { $group: { _id: null, monthRev: { $sum: '$priceSnapshot' } } }
    ])
  ]);

  const revLabels = [];
  const revMap = {};
  for (let i = 3; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    revLabels.push(`M${d.getMonth() + 1}`);
    revMap[`${d.getFullYear()}-${d.getMonth() + 1}`] = 0;
  }
  revAgg.forEach((row) => {
    revMap[`${row._id.year}-${row._id.month}`] = row.total;
  });

  const kpi = {
    totalRevenue: kpiAgg[0]?.totalRev || 0,
    totalSold: kpiAgg[0]?.totalSold || 0,
    monthRevenue: monthAgg[0]?.monthRev || 0
  };
  kpi.avgOrder = kpi.totalSold > 0 ? (kpi.totalRevenue / kpi.totalSold) : 0;

  return {
    revenue: { labels: revLabels, data: Object.values(revMap).map((value) => Number((value / 1000).toFixed(0))) },
    categories: { labels: catAgg.map((item) => item._id), data: catAgg.map((item) => item.count) },
    kpi
  };
}

function findOrderForDispute(orderId) {
  return Order.findById(orderId);
}

function createOrder(data) {
  return Order.create(data);
}

function findOrderById(orderId) {
  return Order.findById(orderId);
}

function linkConversation(orderId, conversationId) {
  return Order.findByIdAndUpdate(orderId, { conversation: conversationId });
}

function deleteOrderById(orderId) {
  return Order.findByIdAndDelete(orderId);
}

function updateOrderStatusWithTimeline({ orderId, prevStatus, setFields, timeline }) {
  return Order.findOneAndUpdate(
    { _id: orderId, status: prevStatus },
    {
      $set: setFields,
      $push: { timeline }
    },
    { new: true }
  );
}

function cancelOrderIfNotCancelled({ orderId, now, note }) {
  return Order.findOneAndUpdate(
    { _id: orderId, status: { $ne: ORDER_STATUS.CANCELLED } },
    {
      $set: { status: ORDER_STATUS.CANCELLED, cancelledAt: now },
      $push: {
        timeline: {
          event: ORDER_STATUS.CANCELLED,
          actor: null,
          at: now,
          note
        }
      }
    },
    { new: true }
  );
}

function updateOrderAfterPayment({ orderId, paidNote, session }) {
  return Order.findByIdAndUpdate(
    orderId,
    {
      $set: { status: ORDER_STATUS.PENDING },
      $push: {
        timeline: {
          event: ORDER_STATUS.PENDING,
          actor: null,
          at: new Date(),
          note: paidNote
        }
      }
    },
    { new: true, session }
  );
}

function openDisputeOnOrder({ orderId, dispute, actorId, note }) {
  const now = dispute.openedAt;
  return Order.findOneAndUpdate(
    {
      _id: orderId,
      $or: [
        { dispute: null },
        { 'dispute.status': { $in: [DISPUTE_STATUS.RESOLVED, DISPUTE_STATUS.REJECTED] } }
      ]
    },
    {
      $set: { dispute },
      $push: {
        timeline: {
          event: 'dispute-opened',
          actor: actorId,
          at: now,
          note
        }
      }
    },
    { new: true }
  );
}

function resolveDisputeOnOrder({ orderId, setFields, actorId, note }) {
  return Order.findOneAndUpdate(
    { _id: orderId, 'dispute.status': { $in: [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.IN_REVIEW] } },
    {
      $set: setFields,
      $push: {
        timeline: {
          event: 'dispute-resolved',
          actor: actorId,
          at: setFields['dispute.resolvedAt'],
          note
        }
      }
    },
    { new: true }
  );
}

async function findDisputes({ status = 'open', page = 1, limit = 20 }) {
  const filter = { dispute: { $ne: null } };
  if (status === 'open') {
    filter['dispute.status'] = { $in: [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.IN_REVIEW] };
  } else if (status === 'resolved') {
    filter['dispute.status'] = { $in: [DISPUTE_STATUS.RESOLVED, DISPUTE_STATUS.REJECTED] };
  }

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ 'dispute.openedAt': -1 })
      .skip(skip)
      .limit(limit)
      .populate('product', 'title images price')
      .populate('buyer', 'name nickname avatar')
      .populate('seller', 'name nickname avatar')
      .populate('dispute.openedBy', 'name nickname avatar')
      .populate('dispute.resolvedBy', 'name nickname')
      .lean(),
    Order.countDocuments(filter)
  ]);

  return {
    orders,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total
  };
}

module.exports = {
  findOrdersForUser,
  countOrdersByStatusForUser,
  findOrderDetailById,
  getOrderAnalyticsForUser,
  findOrderForDispute,
  createOrder,
  findOrderById,
  linkConversation,
  deleteOrderById,
  updateOrderStatusWithTimeline,
  cancelOrderIfNotCancelled,
  updateOrderAfterPayment,
  openDisputeOnOrder,
  resolveDisputeOnOrder,
  findDisputes
};
