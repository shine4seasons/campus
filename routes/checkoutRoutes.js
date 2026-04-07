const router  = require('express').Router();
const { protect } = require('../middleware/auth');
const checkoutController = require('../controllers/checkout');

// Page: GET /checkout/:productId  → render checkout.ejs
router.get('/:productId', protect, checkoutController.getCheckoutPage);

// API:  POST /api/orders          → place order
// (Wired from checkout.ejs fetch('/api/orders', ...))

module.exports = router;
