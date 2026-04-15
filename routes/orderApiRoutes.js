const router = require('express').Router();
const { protect } = require('../middleware/auth');
const orderController = require('../controllers/orders');

// All API routes require authentication
router.use(protect);

// POST /api/orders — create new order
router.post('/', orderController.createOrder);

// GET /api/orders — get user's orders (buyer/seller)
router.get('/', orderController.getMyOrders);

// GET /api/orders/stats — order counts by status for current user
router.get('/stats', orderController.getOrderStats);

// GET /api/orders/analytics — chart data for seller dashboard
router.get('/analytics', orderController.getAnalytics);

// GET /api/orders/:id — get order details
router.get('/:id', orderController.getOrderById);

// PATCH /api/orders/:id/status — update order status
router.patch('/:id/status', orderController.updateOrderStatus);

module.exports = router;