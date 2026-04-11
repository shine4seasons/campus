const router          = require('express').Router();
const { protect }     = require('../middleware/auth');
const orderController = require('../controllers/orders');
const checkoutController = require('../controllers/checkout');

// ── Trang checkout (SSR) ──────────────────────────────────────────────────────
// GET /checkout/:productId → render checkout.ejs
// (Đặt trong app.js/server.js: app.use('/checkout', require('./routes/orderRoutes').page))
const pageRouter = require('express').Router();
pageRouter.get('/:productId', protect, checkoutController.getCheckoutPage);

// ── API ───────────────────────────────────────────────────────────────────────
// Tất cả đều yêu cầu đăng nhập
router.use(protect);

// POST   /api/orders            — đặt hàng mới
router.post('/',                   orderController.createOrder);

// GET    /api/orders            — xem đơn của mình (buyer/seller)
router.get('/',                    orderController.getMyOrders);

// GET    /api/orders/stats      — counts by status for current user
router.get('/stats',               orderController.getOrderStats);

// GET    /api/orders/:id        — xem chi tiết 1 đơn
router.get('/:id',                 orderController.getOrderById);

// PATCH  /api/orders/:id/status — cập nhật trạng thái đơn
router.patch('/:id/status',        orderController.updateOrderStatus);

module.exports = { api: router, page: pageRouter };
