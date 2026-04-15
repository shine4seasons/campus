const router = require('express').Router();
const { protect } = require('../middleware/auth');
const checkoutController = require('../controllers/checkout');

// GET /checkout/:productId — render checkout page
router.get('/:productId', protect, checkoutController.getCheckoutPage);

module.exports = router;