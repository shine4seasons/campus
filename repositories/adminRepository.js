const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Report = require('../models/Report');
const SystemSettings = require('../models/SystemSettings');
const PayoutRequest = require('../models/PayoutRequest');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const {
  ORDER_STATUS,
  PRODUCT_STATUS,
  PAYOUT_STATUS,
  WALLET_TRANSACTION_TYPES
} = require('../config/appConstants');

function toObjectIdString(value) {
  try {
    if (!value) return null;
    const id = String(value);
    return /^[a-fA-F0-9]{24}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function findPendingProductReportIds() {
  return Report.find({
    targetType: 'product',
    status: { $in: ['pending', 'under-review'] }
  }).distinct('targetId');
}

async function findAdminUsers({ q, page = 1, limit = 20, status }) {
  const filter = {};
  if (status === 'banned') filter.banned = true;
  if (status === 'active') filter.banned = { $ne: true };
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { nickname: { $regex: q, $options: 'i' } }
    ];
  }

  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const skip = (normalizedPage - 1) * normalizedLimit;

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort('-createdAt').skip(skip).limit(normalizedLimit).lean()
  ]);

  return {
    total,
    page: normalizedPage,
    limit: normalizedLimit,
    totalPages: Math.ceil(total / normalizedLimit),
    users
  };
}

function updateUserBanStatus(userId, banned) {
  return User.findByIdAndUpdate(userId, { $set: { banned: !!banned } }, { new: true }).lean();
}

function findActiveUserIds() {
  return User.find({ banned: { $ne: true } }).select('_id').lean();
}

async function findAdminOrders({ status, page = 1, limit = 25 }) {
  const filter = {};
  if (status) filter.status = status;
  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const skip = (normalizedPage - 1) * normalizedLimit;

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(normalizedLimit)
      .populate('product', 'title price')
      .populate('buyer', 'name nickname')
      .populate('seller', 'name nickname')
      .lean()
  ]);

  return {
    total,
    page: normalizedPage,
    limit: normalizedLimit,
    totalPages: Math.ceil(total / normalizedLimit),
    orders
  };
}

async function findAdminProducts({ q, page = 1, limit = 25, status }) {
  const filter = {};
  if (status === 'reported') {
    const pendingProductReports = await findPendingProductReportIds();
    filter._id = { $in: pendingProductReports };
  }
  else if (Object.values(PRODUCT_STATUS).includes(status)) filter.status = status;
  if (q) filter.$text = { $search: q };

  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const skip = (normalizedPage - 1) * normalizedLimit;

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(normalizedLimit)
      .populate('seller', 'name nickname')
      .lean()
  ]);

  return {
    total,
    page: normalizedPage,
    limit: normalizedLimit,
    totalPages: Math.ceil(total / normalizedLimit),
    products
  };
}

async function getAdminStatsSummary() {
  const totalUsers = await User.countDocuments({});
  const activeProducts = await Product.countDocuments({ status: PRODUCT_STATUS.ACTIVE });
  const totalProducts = await Product.countDocuments({});
  const pendingReports = await Report.countDocuments({ status: { $in: ['pending', 'under-review'] } });
  const pendingProductReportIds = await findPendingProductReportIds();
  const reportedProducts = pendingProductReportIds.length
    ? await Product.countDocuments({ _id: { $in: pendingProductReportIds } })
    : 0;

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const ordersThisMonth = await Order.countDocuments({ createdAt: { $gte: start, $lt: end } });
  const gmvAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end }, status: { $ne: ORDER_STATUS.CANCELLED } } },
    { $group: { _id: null, total: { $sum: '$priceSnapshot' } } }
  ]);
  const statusAgg = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

  const ordersByStatus = {
    [ORDER_STATUS.PENDING]: 0,
    [ORDER_STATUS.CONFIRMED]: 0,
    [ORDER_STATUS.COMPLETED]: 0,
    [ORDER_STATUS.CANCELLED]: 0
  };
  statusAgg.forEach((item) => {
    ordersByStatus[item._id] = item.count;
  });

  return {
    totalUsers,
    activeProducts,
    totalProducts,
    pendingReports,
    reportedProducts,
    ordersThisMonth,
    gmvThisMonth: (gmvAgg[0] && gmvAgg[0].total) || 0,
    ordersByStatus
  };
}

async function getAdminGMVMonths() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const agg = await Order.aggregate([
    { $match: { createdAt: { $gte: start }, status: { $ne: ORDER_STATUS.CANCELLED } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$priceSnapshot' }, orders: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  const labels = [];
  const months = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`${d.getMonth() + 1}/${d.getFullYear()}`);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const gmvMap = {};
  const ordersMap = {};
  agg.forEach((item) => {
    const key = `${item._id.year}-${item._id.month}`;
    gmvMap[key] = item.total;
    ordersMap[key] = item.orders;
  });

  return {
    labels,
    gmvData: months.map((m) => gmvMap[`${m.year}-${m.month}`] || 0),
    ordersData: months.map((m) => ordersMap[`${m.year}-${m.month}`] || 0)
  };
}

async function getAdminCategoryDistribution() {
  const agg = await Product.aggregate([
    { $match: {} },
    { $group: { _id: { $ifNull: ['$category', 'Other'] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  return {
    labels: agg.map((item) => item._id),
    data: agg.map((item) => item.count)
  };
}

function updateAdminProductStatus(productId, status) {
  return Product.findByIdAndUpdate(productId, { $set: { status } }, { new: true }).lean();
}

function findAdminProductById(productId) {
  return Product.findById(productId);
}

function deleteAdminProduct(product) {
  return product.deleteOne();
}

async function getAdminAnalyticsSnapshot() {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  const newUsers7d = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
  const orderCounts = await Order.aggregate([{ $group: { _id: '$buyer', count: { $sum: 1 } } }]);
  const totalBuyers = orderCounts.length;
  const returningBuyers = orderCounts.filter((item) => item.count > 1).length;
  const returnRate = totalBuyers > 0 ? Math.round((returningBuyers / totalBuyers) * 100) : 0;

  const validOrdersAgg = await Order.aggregate([
    { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
    { $group: { _id: null, totalSales: { $sum: '$priceSnapshot' }, count: { $sum: 1 } } }
  ]);
  const avgOrderValue = validOrdersAgg.length > 0 && validOrdersAgg[0].count > 0
    ? Math.round(validOrdersAgg[0].totalSales / validOrdersAgg[0].count)
    : 0;

  const newProducts7d = await Product.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
  const newProductsPerDay = (newProducts7d / 7).toFixed(1);

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const usersByMonth = await User.aggregate([
    { $match: { createdAt: { $gte: yearStart } } },
    { $group: { _id: { month: { $month: '$createdAt' } }, count: { $sum: 1 } } }
  ]);

  let q1 = 0;
  let q2 = 0;
  let q3 = 0;
  let q4 = 0;
  usersByMonth.forEach((item) => {
    const month = item._id.month;
    if (month <= 3) q1 += item.count;
    else if (month <= 6) q2 += item.count;
    else if (month <= 9) q3 += item.count;
    else q4 += item.count;
  });

  const baseUsers = await User.countDocuments({ createdAt: { $lt: yearStart } });
  const cQ1 = baseUsers + q1;
  const cQ2 = cQ1 + q2;
  const cQ3 = cQ2 + q3;
  const cQ4 = cQ3 + q4;

  const deliveryAgg = await Order.aggregate([{ $group: { _id: '$deliveryMode', count: { $sum: 1 } } }]);
  const deliveryMap = { pickup: 0, ship: 0 };
  deliveryAgg.forEach((item) => {
    const mode = String(item._id).toLowerCase();
    if (mode.includes('pickup') || mode === 'táº¡i trÆ°á»ng') deliveryMap.pickup += item.count;
    else deliveryMap.ship += item.count;
  });

  const paymentAgg = await Order.aggregate([{ $group: { _id: '$paymentMode', count: { $sum: 1 } } }]);
  const paymentMap = { cash: 0, card: 0 };
  paymentAgg.forEach((item) => {
    const mode = String(item._id).toLowerCase();
    if (mode.includes('cash') || mode === 'tiá»n máº·t') paymentMap.cash += item.count;
    else paymentMap.card += item.count;
  });

  const statusAgg = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const statusMap = {
    [ORDER_STATUS.COMPLETED]: 0,
    [ORDER_STATUS.CONFIRMED]: 0,
    [ORDER_STATUS.PENDING]: 0,
    [ORDER_STATUS.CANCELLED]: 0
  };
  statusAgg.forEach((item) => {
    if (item._id) statusMap[String(item._id).toLowerCase()] = item.count;
  });

  const revenueByCategory = await Order.aggregate([
    { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'productInfo' } },
    { $unwind: '$productInfo' },
    { $group: { _id: '$productInfo.category', total: { $sum: '$priceSnapshot' } } },
    { $sort: { total: -1 } }
  ]);

  const categoryMap = {
    books: 'Books & Textbooks',
    electronics: 'Electronics & Computers',
    clothing: 'Clothing & Fashion',
    furniture: 'Furniture & Dorm',
    'daily-needs': 'Daily Essentials',
    sports: 'Sports & Gym',
    gaming: 'Hobbies & Entertainment',
    other: 'Other'
  };
  const revByCategory = {};
  Object.keys(categoryMap).forEach((key) => {
    revByCategory[key] = 0;
  });
  revenueByCategory.forEach((item) => {
    const category = String(item._id || 'other').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(revByCategory, category)) {
      revByCategory[category] = Math.round(item.total / 1000000);
    }
  });

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(now.getDate() - 28);
  const weeklyOrdersAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: fourWeeksAgo } } },
    { $group: { _id: { week: { $week: '$createdAt' }, year: { $year: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.week': 1 } }
  ]);
  const weeklyOrdersMap = new Map(weeklyOrdersAgg.map((row) => [`${row._id.year}-${row._id.week}`, row.count]));
  const weeklyOrders = [];
  const weekLabels = [];
  for (let i = 3; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - (i * 7));
    const week = Math.floor((Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7);
    weekLabels.push(`W${week}`);
    weeklyOrders.push(weeklyOrdersMap.get(`${d.getFullYear()}-${week}`) || 0);
  }

  return {
    kpi: { newUsers7d, returnRate, avgOrderValue, newProductsPerDay },
    userGrowth: [cQ1, cQ2, cQ3, cQ4],
    delivery: [deliveryMap.pickup, deliveryMap.ship],
    payment: [paymentMap.cash, paymentMap.card],
    orderStatus: [statusMap.completed, statusMap.confirmed, statusMap.pending, statusMap.cancelled],
    revenueByCategory: {
      labels: Object.keys(categoryMap).map((key) => categoryMap[key]),
      data: Object.keys(categoryMap).map((key) => revByCategory[key])
    },
    weeklyOrders: { labels: weekLabels, data: weeklyOrders }
  };
}

async function getAdminReportsDataSnapshot() {
  const revAgg = await Order.aggregate([
    { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'prod' } },
    { $unwind: '$prod' },
    { $group: { _id: { $ifNull: ['$prod.category', 'Other'] }, total: { $sum: '$priceSnapshot' } } },
    { $sort: { total: -1 } }
  ]);
  const revLabels = revAgg.map((row) => row._id);
  const revData = revAgg.map((row) => Number((row.total / 1000000).toFixed(1)));

  const now = new Date();
  const fourteenWeeksAgo = new Date(now.getTime() - 14 * 7 * 24 * 60 * 60 * 1000);
  const weekAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: fourteenWeeksAgo } } },
    { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', fourteenWeeksAgo] }, 7 * 24 * 60 * 60 * 1000] } }, count: { $sum: 1 } } }
  ]);
  const weeklyCountMap = new Map(weekAgg.map((row) => [row._id, row.count]));
  const weeklyLabels = [];
  const weeklyData = [];
  for (let i = 0; i < 14; i += 1) {
    weeklyLabels.push(`W${i + 1}`);
    weeklyData.push(weeklyCountMap.get(i) || 0);
  }

  return {
    revenueByCategory: { labels: revLabels, data: revData },
    weeklyOrders: { labels: weeklyLabels, data: weeklyData },
    reportedItems: []
  };
}

async function findAdminReports({ status, page = 1, limit = 20 }) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const skip = (normalizedPage - 1) * normalizedLimit;

  const [total, reports] = await Promise.all([
    Report.countDocuments(filter),
    Report.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(normalizedLimit)
      .populate('reporter', 'name nickname email')
      .populate('resolvedBy', 'name')
      .lean()
  ]);

  const productIdSet = new Set();
  const userIdSet = new Set();
  for (const report of reports) {
    const targetId = toObjectIdString(report.targetId);
    if (!targetId) continue;
    if (report.targetType === 'product') productIdSet.add(targetId);
    else userIdSet.add(targetId);
  }

  const [products, users] = await Promise.all([
    productIdSet.size ? Product.find({ _id: { $in: Array.from(productIdSet) } }).select('title price seller').lean() : Promise.resolve([]),
    userIdSet.size ? User.find({ _id: { $in: Array.from(userIdSet) } }).select('name nickname email university').lean() : Promise.resolve([])
  ]);

  const productById = new Map(products.map((item) => [String(item._id), item]));
  const userById = new Map(users.map((item) => [String(item._id), item]));
  const reportsWithDetails = reports.map((report) => {
    const targetId = toObjectIdString(report.targetId);
    if (!targetId) return { ...report, targetDetails: null };
    if (report.targetType === 'product') return { ...report, targetDetails: productById.get(targetId) || null };
    return { ...report, targetDetails: userById.get(targetId) || null };
  });

  return {
    total,
    page: normalizedPage,
    limit: normalizedLimit,
    totalPages: Math.ceil(total / normalizedLimit),
    reports: reportsWithDetails
  };
}

function updateAdminReport(reportId, updateData) {
  return Report.findByIdAndUpdate(reportId, updateData, { new: true })
    .populate('reporter', 'name nickname email')
    .populate('resolvedBy', 'name');
}

async function findOrCreateSystemSettings() {
  let settings = await SystemSettings.findOne();
  if (!settings) settings = await SystemSettings.create({});
  return settings;
}

async function updateSystemSettings({ platformName, serviceFee, productImageLimit, supportEmail, lastUpdatedBy }) {
  let settings = await SystemSettings.findOne();
  if (!settings) settings = new SystemSettings();

  if (platformName !== undefined) settings.platformName = platformName;
  if (serviceFee !== undefined) settings.serviceFee = Number(serviceFee);
  if (productImageLimit !== undefined) settings.productImageLimit = Number(productImageLimit);
  if (supportEmail !== undefined) settings.supportEmail = supportEmail;
  settings.lastUpdatedBy = lastUpdatedBy;

  await settings.save();
  return settings;
}

async function findAdminPayouts({ status, page = 1, limit = 25 }) {
  const filter = {};
  if (status && status !== 'ALL') filter.status = status;
  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const skip = (normalizedPage - 1) * normalizedLimit;

  const [total, payouts, counts] = await Promise.all([
    PayoutRequest.countDocuments(filter),
    PayoutRequest.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(normalizedLimit)
      .populate('user', 'name nickname email')
      .lean(),
    PayoutRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
  ]);

  const stats = { PENDING: 0, PROCESSING: 0, PAID: 0, REJECTED: 0 };
  counts.forEach((item) => {
    if (Object.prototype.hasOwnProperty.call(stats, item._id)) stats[item._id] = item.count;
  });

  return {
    payouts,
    stats,
    total,
    page: normalizedPage,
    limit: normalizedLimit,
    totalPages: Math.ceil(total / normalizedLimit)
  };
}

function findPayoutById(payoutId, session) {
  return PayoutRequest.findById(payoutId).session(session);
}

function savePayout(payout, session) {
  return payout.save({ session });
}

function updatePayoutTransactionStatus(payoutId, status, session) {
  return WalletTransaction.findOneAndUpdate(
    { referenceId: payoutId, referenceType: 'PayoutRequest', type: WALLET_TRANSACTION_TYPES.WITHDRAW },
    { $set: { status } },
    { session }
  );
}

function findWalletByUser(userId, session) {
  return Wallet.findOne({ user: userId }).session(session);
}

function saveWallet(wallet, session) {
  return wallet.save({ session });
}

function createRefundWalletTransaction({ walletId, userId, amount, adminNote, payoutId }) {
  return new WalletTransaction({
    wallet: walletId,
    user: userId,
    type: WALLET_TRANSACTION_TYPES.DEPOSIT,
    amount,
    description: `Refund for rejected withdrawal request: ${adminNote}`,
    status: 'COMPLETED',
    referenceId: payoutId,
    referenceType: 'PayoutRequest',
    idempotencyKey: `PAYOUT_REJECT_REFUND:${payoutId}`
  });
}

function saveWalletTransaction(transaction, session) {
  return transaction.save({ session });
}

module.exports = {
  PAYOUT_STATUS,
  findAdminUsers,
  updateUserBanStatus,
  findActiveUserIds,
  findAdminOrders,
  findAdminProducts,
  getAdminStatsSummary,
  getAdminGMVMonths,
  getAdminCategoryDistribution,
  updateAdminProductStatus,
  findAdminProductById,
  deleteAdminProduct,
  getAdminAnalyticsSnapshot,
  getAdminReportsDataSnapshot,
  findAdminReports,
  updateAdminReport,
  findOrCreateSystemSettings,
  updateSystemSettings,
  findAdminPayouts,
  findPayoutById,
  savePayout,
  updatePayoutTransactionStatus,
  findWalletByUser,
  saveWallet,
  createRefundWalletTransaction,
  saveWalletTransaction
};
