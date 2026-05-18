const router = require('express').Router();
const paymentController = require('../controllers/checkout/payment');
const { protect } = require('../middleware/auth');
const verifyWebhookSecret = require('../middleware/verifyWebhookSecret');

router.get('/:id/status', protect, paymentController.getPaymentStatus);
router.post('/webhook', verifyWebhookSecret, paymentController.webhook);
router.get('/:paymentId/check', protect, paymentController.checkPaymentViaSePay);

module.exports = router;
