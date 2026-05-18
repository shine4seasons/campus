const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const adminCtrl = require('../controllers/admin');

// All admin APIs require auth + admin role
router.use(protect);
router.use(restrictTo('admin'));

router.get('/users', adminCtrl.getUsers);
router.patch('/users/:id/ban', adminCtrl.toggleBan);

router.get('/orders', adminCtrl.getOrders);

router.get('/reports', adminCtrl.getReports);
router.patch('/reports/:id', adminCtrl.updateReport);

router.get('/products', adminCtrl.getProducts);

// Payouts
router.get('/payouts', adminCtrl.getPayouts);
router.post('/payouts/:id/approve', adminCtrl.approvePayout);
router.post('/payouts/:id/mark-paid', adminCtrl.markPayoutPaid);
router.post('/payouts/:id/reject', adminCtrl.rejectPayout);

// Stats
router.get('/stats', adminCtrl.getStats);
router.get('/analytics', adminCtrl.getAnalytics);
router.get('/reports', adminCtrl.getReportsData);
router.get('/gmv-months', adminCtrl.getGMVMonths);
router.get('/categories', adminCtrl.getCategoryDistribution);

// Settings
router.get('/settings', adminCtrl.getSettings);
router.post('/settings', adminCtrl.updateSettings);

// Product actions
router.patch('/products/:id/hide', adminCtrl.hideProduct);
router.patch('/products/:id/restore', adminCtrl.restoreProduct);
router.delete('/products/:id', adminCtrl.deleteProductAdmin);

// Ratings Sync
const ratingCtrl = require('../controllers/rating');
router.post('/sync-ratings', ratingCtrl.syncAllRatings);

module.exports = router;
