const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const { validate, validateParams, validateQuery } = require('../middleware/validate');
const {
  emptyBodySchema,
  adminToggleBanSchema,
  adminUpdateReportSchema,
  adminPayoutApproveSchema,
  adminPayoutMarkPaidSchema,
  adminPayoutRejectSchema,
  adminSettingsSchema,
} = require('../validation/mutateSchemas');
const {
  idParamSchema,
  adminUsersQuerySchema,
  adminOrdersQuerySchema,
  adminProductsQuerySchema,
  adminReportsQuerySchema,
  adminPayoutsQuerySchema,
} = require('../validation/requestSchemas');
const adminCtrl = require('../controllers/admin');

// All admin APIs require auth + admin role
router.use(protect);
router.use(restrictTo('admin'));

router.get('/users', validateQuery(adminUsersQuerySchema), adminCtrl.getUsers);
router.patch('/users/:id/ban', validateParams(idParamSchema), validate(adminToggleBanSchema), adminCtrl.toggleBan);

router.get('/orders', validateQuery(adminOrdersQuerySchema), adminCtrl.getOrders);

router.get('/reports', validateQuery(adminReportsQuerySchema), adminCtrl.getReports);
router.patch('/reports/:id', validateParams(idParamSchema), validate(adminUpdateReportSchema), adminCtrl.updateReport);

router.get('/products', validateQuery(adminProductsQuerySchema), adminCtrl.getProducts);

// Payouts
router.get('/payouts', validateQuery(adminPayoutsQuerySchema), adminCtrl.getPayouts);
router.post('/payouts/:id/approve', validateParams(idParamSchema), validate(adminPayoutApproveSchema), adminCtrl.approvePayout);
router.post('/payouts/:id/mark-paid', validateParams(idParamSchema), validate(adminPayoutMarkPaidSchema), adminCtrl.markPayoutPaid);
router.post('/payouts/:id/reject', validateParams(idParamSchema), validate(adminPayoutRejectSchema), adminCtrl.rejectPayout);

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
router.patch('/products/:id/hide', validateParams(idParamSchema), validate(emptyBodySchema), adminCtrl.hideProduct);
router.patch('/products/:id/restore', validateParams(idParamSchema), validate(emptyBodySchema), adminCtrl.restoreProduct);
router.delete('/products/:id', validateParams(idParamSchema), validate(emptyBodySchema), adminCtrl.deleteProductAdmin);

// Ratings Sync
const ratingCtrl = require('../controllers/rating');
router.post('/sync-ratings', validate(emptyBodySchema), ratingCtrl.syncAllRatings);

module.exports = router;
