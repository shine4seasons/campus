const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const adminCtrl = require('../controllers/admin');

// All admin APIs require auth + admin role
router.use(protect);
router.use(restrictTo('admin'));

router.get('/users', adminCtrl.getUsers);
router.patch('/users/:id/ban', adminCtrl.toggleBan);

router.get('/orders', adminCtrl.getOrders);

router.get('/products', adminCtrl.getProducts);

// Stats
router.get('/stats', adminCtrl.getStats);
router.get('/gmv-months', adminCtrl.getGMVMonths);
router.get('/categories', adminCtrl.getCategoryDistribution);

// Product actions
router.patch('/products/:id/hide', adminCtrl.hideProduct);
router.patch('/products/:id/restore', adminCtrl.restoreProduct);
router.delete('/products/:id', adminCtrl.deleteProductAdmin);

module.exports = router;
