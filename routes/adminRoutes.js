const express = require('express');
const router = express.Router();
const requirePageAuth = require('../middleware/pageAuth');
const requireAdmin = require('../middleware/adminAuth');
const { ADMIN_SECTIONS, SECTION_MAP } = require('../config/adminConstants');
const { CATEGORIES } = require('../public/js/categories');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Function to get dashboard stats
async function getDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Total users (active)
  const totalUsers = await User.countDocuments({ banned: { $ne: true } });

  // New users this month
  const newUsersThisMonth = await User.countDocuments({
    createdAt: { $gte: startOfMonth },
    banned: { $ne: true }
  });

  // New users last month
  const newUsersLastMonth = await User.countDocuments({
    createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth },
    banned: { $ne: true }
  });

  const totalUsersDelta = newUsersLastMonth > 0 ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth * 100).toFixed(0) : 0;

  // Total listings
  const totalListings = await Product.countDocuments({});

  // Active listings
  const activeListings = await Product.countDocuments({ status: 'active' });

  // Active listings yesterday (approximate, since no historical)
  // For simplicity, assume no change, or calculate based on createdAt
  // Actually, to simulate, perhaps count products created before yesterday
  const activeListingsYesterday = await Product.countDocuments({
    status: 'active',
    createdAt: { $lt: yesterday }
  });
  const activeListingsDelta = activeListings - activeListingsYesterday;

  // Orders this month
  const ordersThisMonth = await Order.countDocuments({ createdAt: { $gte: startOfMonth } });

  // Orders last month
  const ordersLastMonth = await Order.countDocuments({
    createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth }
  });

  const ordersDelta = ordersLastMonth > 0 ? ((ordersThisMonth - ordersLastMonth) / ordersLastMonth * 100).toFixed(0) : 0;

  // GMV this month
  const gmvThisMonthResult = await Order.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
    { $group: { _id: null, total: { $sum: '$priceSnapshot' } } }
  ]);
  const gmvThisMonth = gmvThisMonthResult[0]?.total || 0;

  // GMV last month
  const gmvLastMonthResult = await Order.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth } } },
    { $group: { _id: null, total: { $sum: '$priceSnapshot' } } }
  ]);
  const gmvLastMonth = gmvLastMonthResult[0]?.total || 0;

  const gmvDelta = gmvLastMonth > 0 ? ((gmvThisMonth - gmvLastMonth) / gmvLastMonth * 100).toFixed(0) : 0;

  return {
    totalUsers: { value: totalUsers, delta: totalUsersDelta, type: 'percentage' },
    totalListings: { value: totalListings, type: 'absolute' },
    activeListings: { value: activeListings, delta: activeListingsDelta, type: 'absolute' },
    ordersThisMonth: { value: ordersThisMonth, delta: ordersDelta, type: 'percentage' },
    gmvThisMonth: { value: gmvThisMonth, delta: gmvDelta, type: 'percentage' }
  };
}

// Function to get top sellers by revenue this month
async function getTopSellers(limit = 5) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const topSellers = await Order.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startOfMonth }
      }
    },
    {
      $group: {
        _id: '$seller',
        totalRevenue: { $sum: '$priceSnapshot' },
        totalOrders: { $sum: 1 }
      }
    },
    {
      $sort: { totalRevenue: -1 }
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'sellerInfo'
      }
    },
    {
      $unwind: '$sellerInfo'
    },
    {
      $project: {
        _id: 0,
        sellerId: '$_id',
        name: { $ifNull: ['$sellerInfo.nickname', '$sellerInfo.name'] },
        university: '$sellerInfo.university',
        rating: '$sellerInfo.rating',
        totalRevenue: 1,
        totalOrders: 1
      }
    }
  ]);

  return topSellers;
}

// All admin routes require authentication and admin role
router.use(requirePageAuth);
router.use(requireAdmin);

// Admin dashboard home
router.get('/', async (req, res) => {
  try {
    const topSellers = await getTopSellers(5);
    const stats = await getDashboardStats();
    res.render('dashboard-admin', {
      title: 'Admin Dashboard',
      initialSection: 'aDash',
      topSellers,
      stats,
      CATEGORIES
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.render('dashboard-admin', {
      title: 'Admin Dashboard',
      initialSection: 'aDash',
      topSellers: [],
      stats: {
        totalUsers: { value: 0, delta: 0, type: 'percentage' },
        activeListings: { value: 0, delta: 0, type: 'absolute' },
        ordersThisMonth: { value: 0, delta: 0, type: 'percentage' },
        gmvThisMonth: { value: 0, delta: 0, type: 'percentage' }
      },
      CATEGORIES
    });
  }
});

// Convenience routes for different admin sections
ADMIN_SECTIONS.forEach(sectionName => {
  router.get(`/${sectionName}`, async (req, res) => {
    try {
      const topSellers = await getTopSellers(5);
      const stats = await getDashboardStats();
      const initialSection = SECTION_MAP[sectionName] || 'aDash';
      res.render('dashboard-admin', {
        title: `Admin Dashboard - ${sectionName}`,
        initialSection,
        topSellers,
        stats,
        CATEGORIES
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      const initialSection = SECTION_MAP[sectionName] || 'aDash';
      res.render('dashboard-admin', {
        title: `Admin Dashboard - ${sectionName}`,
        initialSection,
        topSellers: [],
        CATEGORIES,
        stats: {
          totalUsers: { value: 0, delta: 0, type: 'percentage' },
          totalListings: { value: 0, type: 'absolute' },
          totalListings: { value: 0, type: 'absolute' },
          activeListings: { value: 0, delta: 0, type: 'absolute' },
          ordersThisMonth: { value: 0, delta: 0, type: 'percentage' },
          gmvThisMonth: { value: 0, delta: 0, type: 'percentage' }
        }
      });
    }
  });
});

module.exports = router;
