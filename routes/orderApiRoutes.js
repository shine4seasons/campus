const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validate, validateParams, validateQuery } = require('../middleware/validate');
const {
  createOrderSchema,
  updateOrderStatusSchema,
  openDisputeSchema,
  resolveDisputeSchema,
} = require('../validation/mutateSchemas');
const {
  idParamSchema,
  orderListQuerySchema,
  orderRoleQuerySchema,
  orderAnalyticsQuerySchema,
} = require('../validation/requestSchemas');
const orderController = require('../controllers/orders');

// All API routes require authentication
router.use(protect);

// POST /api/orders — create new order
router.post('/', validate(createOrderSchema), orderController.createOrder);

// GET /api/orders — get user's orders (buyer/seller)
router.get('/', validateQuery(orderListQuerySchema), orderController.getMyOrders);

// GET /api/orders/stats — order counts by status for current user
router.get('/stats', validateQuery(orderRoleQuerySchema), orderController.getOrderStats);

// GET /api/orders/analytics — chart data for seller dashboard
router.get('/analytics', validateQuery(orderAnalyticsQuerySchema), orderController.getAnalytics);


// GET /api/orders/:id — get order details
router.get('/:id', validateParams(idParamSchema), orderController.getOrderById);

// PATCH /api/orders/:id/status — update order status
router.patch('/:id/status', validateParams(idParamSchema), validate(updateOrderStatusSchema), orderController.updateOrderStatus);

// POST /api/orders/:id/dispute — buyer or seller opens a dispute
router.post('/:id/dispute', validateParams(idParamSchema), validate(openDisputeSchema), orderController.openDispute);

// POST /api/orders/:id/dispute/resolve — admin resolves dispute
router.post('/:id/dispute/resolve', validateParams(idParamSchema), validate(resolveDisputeSchema), orderController.resolveDispute);

module.exports = router;

