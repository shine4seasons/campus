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

// GET /api/orders/disputes/all — admin: list all disputes (must be before /:id)
router.get('/disputes/all', orderController.getAllDisputes);

// GET /api/orders/:id — get order details
router.get('/:id', orderController.getOrderById);

// PATCH /api/orders/:id/status — update order status
router.patch('/:id/status', orderController.updateOrderStatus);

// POST /api/orders/:id/dispute — buyer or seller opens a dispute
router.post('/:id/dispute', orderController.openDispute);

// POST /api/orders/:id/dispute/resolve — admin resolves dispute
router.post('/:id/dispute/resolve', orderController.resolveDispute);

module.exports = router;