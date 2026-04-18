const User = require('../../models/User');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const Report = require('../../models/Report');
const SystemSettings = require('../../models/SystemSettings');
const { ORDER_STATUS, PRODUCT_STATUS, USER_ROLES, NOTIFICATION_TYPES } = require('../../config/appConstants');


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
    
    // Notify user of account warning/ban
    try {
      const { sendNotification } = require('../../utils/notifService');
      await sendNotification({
        recipient: uid,
        sender:    req.user._id,
        type:      NOTIFICATION_TYPES.SYSTEM,
        title:     banned ? 'Account Banned' : 'Account Reinstated',
        message:   banned ? 'Your account has been banned due to policy violations.' : 'Your account has been restored. Please follow our community guidelines.',
        link:      '#'
      });
    } catch (notifErr) {
      console.error('Ban notification error:', notifErr);
    }

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
    if (status === 'reported') {
      filter.reported = true;
    } else if (Object.values(PRODUCT_STATUS).includes(status)) {
      filter.status = status;
    }
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
    const activeListings = await Product.countDocuments({ status: PRODUCT_STATUS.ACTIVE });

    // Orders this month and GMV this month
    const start = new Date();
    start.setDate(1);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const ordersThisMonth = await Order.countDocuments({ createdAt: { $gte: start, $lt: end } });

    const gmvAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end }, status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $group: { _id: null, total: { $sum: '$priceSnapshot' } } },
    ]);
    const gmvThisMonth = (gmvAgg[0] && gmvAgg[0].total) || 0;

    // counts by order status (overall)
    const statusAgg = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const ordersByStatus = { 
      [ORDER_STATUS.PENDING]: 0, 
      [ORDER_STATUS.CONFIRMED]: 0, 
      [ORDER_STATUS.COMPLETED]: 0, 
      [ORDER_STATUS.CANCELLED]: 0 
    };
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
      { $match: { createdAt: { $gte: start }, status: { $ne: ORDER_STATUS.CANCELLED } } },
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
    const p = await Product.findByIdAndUpdate(pid, { $set: { status: PRODUCT_STATUS.HIDDEN } }, { new: true }).lean();
    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });

    // Notify seller
    try {
      const { sendNotification } = require('../../utils/notifService');
      await sendNotification({
        recipient: p.seller,
        sender:    req.user._id,
        type:      NOTIFICATION_TYPES.SYSTEM,
        title:     'Listing Hidden',
        message:   `Your listing "${p.title}" has been hidden by moderation. Please check your product details.`,
        link:      `/products/${p._id}`
      });
    } catch (notifErr) {
      console.error('Hide product notification error:', notifErr);
    }

    res.json({ success: true, data: p });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/admin/products/:id/restore
const restoreProduct = async (req, res) => {
  try {
    const pid = req.params.id;
    const p = await Product.findByIdAndUpdate(pid, { $set: { status: PRODUCT_STATUS.ACTIVE } }, { new: true }).lean();
    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });

    // Notify seller
    try {
      const { sendNotification } = require('../../utils/notifService');
      await sendNotification({
        recipient: p.seller,
        sender:    req.user._id,
        type:      NOTIFICATION_TYPES.SYSTEM,
        title:     'Listing Live',
        message:   `Your listing "${p.title}" is now visible to everyone!`,
        link:      `/products/${p._id}`
      });
    } catch (notifErr) {
      console.error('Restore product notification error:', notifErr);
    }

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

// GET /api/admin/analytics
const getAnalytics = async (req, res) => {
  try {
    const now = new Date();
    
    // 1. New users last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const newUsers7d = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // 2. Return Rate (tỷ lệ quay lại): users with > 1 order / users with > 0 order
    const orderCounts = await Order.aggregate([
      { $group: { _id: '$buyer', count: { $sum: 1 } } }
    ]);
    const totalBuyers = orderCounts.length;
    const returningBuyers = orderCounts.filter(o => o.count > 1).length;
    const returnRate = totalBuyers > 0 ? Math.round((returningBuyers / totalBuyers) * 100) : 0;

    // 3. Average Order Value (Giá trị đơn trung bình)
    const validOrdersAgg = await Order.aggregate([
      { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $group: { _id: null, totalSales: { $sum: '$priceSnapshot' }, count: { $sum: 1 } } }
    ]);
    const avgOrderValue = validOrdersAgg.length > 0 && validOrdersAgg[0].count > 0 
      ? Math.round(validOrdersAgg[0].totalSales / validOrdersAgg[0].count) 
      : 0;

    // 4. New listings per day (7 days)
    const newListings7d = await Product.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    const newListingsPerDay = (newListings7d / 7).toFixed(1);

    // 5. User growth (by Quarter of current year)
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const usersByMonth = await User.aggregate([
      { $match: { createdAt: { $gte: yearStart } } },
      { $group: { _id: { month: { $month: '$createdAt' } }, count: { $sum: 1 } } }
    ]);
    
    let q1=0, q2=0, q3=0, q4=0;
    usersByMonth.forEach(u => {
      const m = u._id.month;
      if (m <= 3) q1 += u.count;
      else if (m <= 6) q2 += u.count;
      else if (m <= 9) q3 += u.count;
      else q4 += u.count;
    });
    
    const baseUsers = await User.countDocuments({ createdAt: { $lt: yearStart } });
    const cQ1 = baseUsers + q1;
    const cQ2 = cQ1 + q2;
    const cQ3 = cQ2 + q3;
    const cQ4 = cQ3 + q4;
    const userGrowth = [cQ1, cQ2, cQ3, cQ4];

    // 6. Delivery method
    const deliveryAgg = await Order.aggregate([
      { $group: { _id: '$deliveryMode', count: { $sum: 1 } } }
    ]);
    const deliveryMap = { pickup: 0, ship: 0 };
    deliveryAgg.forEach(d => {
      const mode = String(d._id).toLowerCase();
      if (mode.includes('pickup') || mode === 'tại trường') deliveryMap.pickup += d.count;
      else deliveryMap.ship += d.count;
    });

    // 7. Payment method
    const paymentAgg = await Order.aggregate([
      { $group: { _id: '$paymentMode', count: { $sum: 1 } } }
    ]);
    const paymentMap = { cash: 0, card: 0 };
    paymentAgg.forEach(p => {
      const mode = String(p._id).toLowerCase();
      if (mode.includes('cash') || mode === 'tiền mặt') paymentMap.cash += p.count;
      else paymentMap.card += p.count;
    });

    // 8. Order status
    const statusAgg = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const statusMap = { 
      [ORDER_STATUS.COMPLETED]: 0, 
      [ORDER_STATUS.CONFIRMED]: 0, 
      [ORDER_STATUS.PENDING]: 0, 
      [ORDER_STATUS.CANCELLED]: 0 
    };
    statusAgg.forEach(s => {
      if (s._id) statusMap[String(s._id).toLowerCase()] = s.count;
    });

    // 9. Revenue by category (lấy orders, lấy product category, nhóm theo category)
    const revenueByCategory = await Order.aggregate([
      { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'productInfo' } },
      { $unwind: '$productInfo' },
      { $group: { _id: '$productInfo.category', total: { $sum: '$priceSnapshot' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);
    
    // Map categories to proper display names
    const categoryMap = {
      'books': 'Books & Textbooks',
      'electronics': 'Electronics & Computers',
      'clothing': 'Clothing & Fashion',
      'furniture': 'Furniture & Dorm',
      'daily-needs': 'Daily Essentials',
      'sports': 'Sports & Gym',
      'gaming': 'Hobbies & Entertainment',
      'other': 'Other'
    };
    
    // Initialize all categories with 0
    const revByCategory = {};
    Object.keys(categoryMap).forEach(key => {
      revByCategory[key] = 0;
    });
    
    // Fill in actual data
    revenueByCategory.forEach(r => {
      const cat = String(r._id || 'other').toLowerCase();
      if (revByCategory.hasOwnProperty(cat)) {
        revByCategory[cat] = Math.round(r.total / 1000000); // Convert to millions
      }
    });
    
    const revCatLabels = Object.keys(categoryMap).map(k => categoryMap[k]);
    const revCatData = Object.keys(categoryMap).map(k => revByCategory[k]);

    // 10. Weekly orders (lấy orders của 4 tuần gần nhất, tính số order mỗi tuần)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(now.getDate() - 28);
    
    const weeklyOrdersAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: fourWeeksAgo } } },
      { $group: {
          _id: { week: { $week: '$createdAt' }, year: { $year: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } }
    ]);
    
    // Build 4 weeks array
    const weeklyOrders = [];
    const weekLabels = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - (i * 7));
      const week = Math.floor((Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7);
      weekLabels.push(`W${week}`);
      const found = weeklyOrdersAgg.find(w => w._id.week === week && w._id.year === d.getFullYear());
      weeklyOrders.push(found ? found.count : 0);
    }

    res.json({
      success: true,
      data: {
        kpi: { newUsers7d, returnRate, avgOrderValue, newListingsPerDay },
        userGrowth,
        delivery: [deliveryMap.pickup, deliveryMap.ship],
        payment: [paymentMap.cash, paymentMap.card],
        orderStatus: [statusMap.completed, statusMap.confirmed, statusMap.pending, statusMap.cancelled],
        revenueByCategory: { labels: revCatLabels, data: revCatData },
        weeklyOrders: { labels: weekLabels, data: weeklyOrders }
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/reports
const getReportsData = async (req, res) => {
  try {
    // 1. Revenue by category
    const revAgg = await Order.aggregate([
      { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'prod' } },
      { $unwind: '$prod' },
      { $group: { _id: { $ifNull: ['$prod.category', 'Other'] }, total: { $sum: '$priceSnapshot' } } },
      { $sort: { total: -1 } }
    ]);
    const revLabels = revAgg.map(r => r._id);
    const revData = revAgg.map(r => Number((r.total / 1000000).toFixed(1))); // convert to Millions

    // 2. Orders by week (last 14 weeks)
    const now = new Date();
    const fourteenWeeksAgo = new Date(now.getTime() - 14 * 7 * 24 * 60 * 60 * 1000);
    const weekAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: fourteenWeeksAgo } } },
      { $group: { 
          _id: { $floor: { $divide: [{ $subtract: ['$createdAt', fourteenWeeksAgo] }, 7 * 24 * 60 * 60 * 1000] } },
          count: { $sum: 1 }
      }}
    ]);
    const weeklyLabels = [];
    const weeklyData = [];
    for (let i = 0; i < 14; i++) {
        weeklyLabels.push('W' + (i + 1));
        const match = weekAgg.find(w => w._id === i);
        weeklyData.push(match ? match.count : 0);
    }

    // 3. Reported Items
    // Since there is no Report model yet, we will return an empty array.
    const reportedItems = [];

    res.json({
      success: true,
      data: {
        revenueByCategory: { labels: revLabels, data: revData },
        weeklyOrders: { labels: weeklyLabels, data: weeklyData },
        reportedItems: reportedItems
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/reports
const getReports = async (req, res) => {
  try {
    const Report = require('../../models/Report');
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Report.countDocuments(filter);
    const reports = await Report.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit))
      .populate('reporter', 'name nickname email')
      .populate('resolvedBy', 'name')
      .lean();

    // Fetch target details (product or user)
    const reportsWithDetails = await Promise.all(reports.map(async (report) => {
      if (report.targetType === 'product') {
        const product = await Product.findById(report.targetId).select('title price seller').lean();
        return { ...report, targetDetails: product };
      } else {
        const user = await User.findById(report.targetId).select('name nickname email university').lean();
        return { ...report, targetDetails: user };
      }
    }));

    res.json({
      success: true,
      data: reportsWithDetails,
      pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/reports/:id (update report status)
const updateReport = async (req, res) => {
  try {
    const Report = require('../../models/Report');
    const reportId = req.params.id;
    const { status, adminNotes } = req.body;
    
    // Validate status
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

    const report = await Report.findByIdAndUpdate(reportId, updateData, { new: true })
      .populate('reporter', 'name nickname email')
      .populate('resolvedBy', 'name');
    
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Notify reporter
    try {
      const { sendNotification } = require('../../utils/notifService');
      const statusLabel = status === 'resolved' ? 'Resolved' : (status === 'dismissed' ? 'Dismissed' : 'Updated');
      await sendNotification({
        recipient: report.reporter,
        sender:    req.user._id,
        type:      NOTIFICATION_TYPES.SYSTEM,
        title:     `Report Update`,
        message:   `Your report has been ${statusLabel.toLowerCase()} by an administrator.`,
        link:      '#'
      });
    } catch (notifErr) {
      console.error('Report notification error:', notifErr);
    }

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// GET /api/admin/settings
const getSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/settings
const updateSettings = async (req, res) => {
  try {
    const { platformName, serviceFee, productImageLimit, supportEmail, announcement } = req.body;
    
    let settings = await SystemSettings.findOne();
    if (!settings) settings = new SystemSettings();

    if (platformName !== undefined) settings.platformName = platformName;
    if (serviceFee !== undefined) settings.serviceFee = Number(serviceFee);
    if (productImageLimit !== undefined) settings.productImageLimit = Number(productImageLimit);
    if (supportEmail !== undefined) settings.supportEmail = supportEmail;
    settings.lastUpdatedBy = req.user._id;

    await settings.save();

    // Handle announcement if provided
    if (announcement && announcement.trim()) {
      const { sendNotification } = require('../../utils/notifService');
      const allUsers = await User.find({ banned: { $ne: true } }).select('_id');
      
      for (const u of allUsers) {
        await sendNotification({
          recipient: u._id,
          sender: req.user._id,
          type: NOTIFICATION_TYPES.SYSTEM,
          title: 'System Announcement',
          message: announcement.trim(),
          link: '#'
        });
      }
    }

    res.json({ success: true, data: settings, message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getUsers, toggleBan, getOrders, getProducts, getStats, getGMVMonths, getCategoryDistribution, hideProduct, restoreProduct, deleteProductAdmin, getAnalytics, getReportsData, getReports, updateReport, getSettings, updateSettings };
