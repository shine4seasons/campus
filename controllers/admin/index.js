const User = require('../../models/User');
const Order = require('../../models/Order');
const Product = require('../../models/Product');

// GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const { q, page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status === 'banned') filter.banned = true;
    if (status === 'active') filter.banned = { $ne: true };
    if (q) filter.$or = [ { name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }, { nickname: { $regex: q, $options: 'i' } } ];

    const skip = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data: users, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/users/:id/ban
const toggleBan = async (req, res) => {
  try {
    const uid = req.params.id;
    const { banned } = req.body;
    const user = await User.findByIdAndUpdate(uid, { $set: { banned: !!banned } }, { new: true }).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/orders
const getOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 25 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit))
      .populate('product', 'title price')
      .populate('buyer', 'name nickname')
      .populate('seller', 'name nickname')
      .lean();

    res.json({ success: true, data: orders, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/products
const getProducts = async (req, res) => {
  try {
    const { q, page = 1, limit = 25, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (q) filter.$text = { $search: q };
    const skip = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit))
      .populate('seller', 'name nickname')
      .lean();

    res.json({ success: true, data: products, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({});
    const activeListings = await Product.countDocuments({ status: 'active' });

    // Orders this month and GMV this month
    const start = new Date();
    start.setDate(1);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const ordersThisMonth = await Order.countDocuments({ createdAt: { $gte: start, $lt: end } });

    const gmvAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$priceSnapshot' } } },
    ]);
    const gmvThisMonth = (gmvAgg[0] && gmvAgg[0].total) || 0;

    // counts by order status (overall)
    const statusAgg = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const ordersByStatus = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    statusAgg.forEach(s => { ordersByStatus[s._id] = s.count; });

    res.json({ success: true, data: { totalUsers, activeListings, ordersThisMonth, gmvThisMonth, ordersByStatus } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/gmv-months
const getGMVMonths = async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const agg = await Order.aggregate([
      { $match: { createdAt: { $gte: start }, status: { $ne: 'cancelled' } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$priceSnapshot' }, orders: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // build labels for last 12 months
    const labels = [];
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push((d.getMonth() + 1) + '/' + d.getFullYear());
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    const gmvMap = {};
    const ordersMap = {};
    agg.forEach(a => {
      const key = `${a._id.year}-${a._id.month}`;
      gmvMap[key] = a.total;
      ordersMap[key] = a.orders;
    });

    const gmvData = months.map(m => gmvMap[`${m.year}-${m.month}`] || 0);
    const ordersData = months.map(m => ordersMap[`${m.year}-${m.month}`] || 0);

    res.json({ success: true, data: { labels, gmvData, ordersData } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/categories
const getCategoryDistribution = async (req, res) => {
  try {
    const agg = await Product.aggregate([
      { $match: {} },
      { $group: { _id: { $ifNull: ['$category', 'Other'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const labels = agg.map(a => a._id);
    const data = agg.map(a => a.count);
    res.json({ success: true, data: { labels, data } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/products/:id/hide
const hideProduct = async (req, res) => {
  try {
    const pid = req.params.id;
    const p = await Product.findByIdAndUpdate(pid, { $set: { status: 'hidden' } }, { new: true }).lean();
    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: p });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/admin/products/:id/restore
const restoreProduct = async (req, res) => {
  try {
    const pid = req.params.id;
    const p = await Product.findByIdAndUpdate(pid, { $set: { status: 'active' } }, { new: true }).lean();
    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: p });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE /api/admin/products/:id
const deleteProductAdmin = async (req, res) => {
  try {
    const pid = req.params.id;
    const p = await Product.findById(pid);
    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
    await p.deleteOne();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getUsers, toggleBan, getOrders, getProducts, getStats, getGMVMonths, getCategoryDistribution, hideProduct, restoreProduct, deleteProductAdmin };
