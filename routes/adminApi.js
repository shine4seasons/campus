const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  emptyBodySchema,
  adminToggleBanSchema,
  adminUpdateReportSchema,
  adminPayoutApproveSchema,
  adminPayoutMarkPaidSchema,
  adminPayoutRejectSchema,
  adminSettingsSchema,
} = require('../validation/mutateSchemas');
const adminCtrl = require('../controllers/admin');

// All admin APIs require auth + admin role
router.use(protect);
router.use(restrictTo('admin'));

router.get('/users', adminCtrl.getUsers);
router.patch('/users/:id/ban', validate(adminToggleBanSchema), adminCtrl.toggleBan);

router.get('/orders', adminCtrl.getOrders);

router.get('/reports', adminCtrl.getReports);
router.patch('/reports/:id', validate(adminUpdateReportSchema), adminCtrl.updateReport);

router.get('/products', adminCtrl.getProducts);

// Payouts
router.get('/payouts', adminCtrl.getPayouts);
router.post('/payouts/:id/approve', validate(adminPayoutApproveSchema), adminCtrl.approvePayout);
router.post('/payouts/:id/mark-paid', validate(adminPayoutMarkPaidSchema), adminCtrl.markPayoutPaid);
router.post('/payouts/:id/reject', validate(adminPayoutRejectSchema), adminCtrl.rejectPayout);

// Stats
router.get('/stats', adminCtrl.getStats);
router.get('/analytics', adminCtrl.getAnalytics);
router.get('/reports', adminCtrl.getReportsData);
router.get('/gmv-months', adminCtrl.getGMVMonths);
router.get('/categories', adminCtrl.getCategoryDistribution);

// Settings
router.get('/settings', adminCtrl.getSettings);
router.post('/settings', validate(adminSettingsSchema), adminCtrl.updateSettings);

// Product actions
router.patch('/products/:id/hide', validate(emptyBodySchema), adminCtrl.hideProduct);
router.patch('/products/:id/restore', validate(emptyBodySchema), adminCtrl.restoreProduct);
router.delete('/products/:id', validate(emptyBodySchema), adminCtrl.deleteProductAdmin);

// Ratings Sync
const ratingCtrl = require('../controllers/rating');
router.post('/sync-ratings', validate(emptyBodySchema), ratingCtrl.syncAllRatings);

module.exports = router;
