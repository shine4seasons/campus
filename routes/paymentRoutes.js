const router = require('express').Router();
const paymentController = require('../controllers/checkout/payment');
const { validate, validateParams } = require('../middleware/validate');
const { paymentWebhookSchema } = require('../validation/mutateSchemas');
const { idParamSchema, paymentIdParamSchema } = require('../validation/requestSchemas');
const { protect } = require('../middleware/auth');
const { limitPaymentCheck } = require('../middleware/security');
const verifyWebhookSecret = require('../middleware/verifyWebhookSecret');

router.get('/:id/status', protect, validateParams(idParamSchema), paymentController.getPaymentStatus);
router.post('/webhook', verifyWebhookSecret, validate(paymentWebhookSchema), paymentController.webhook);
router.get('/:paymentId/check', limitPaymentCheck, protect, validateParams(paymentIdParamSchema), paymentController.checkPaymentViaSePay);

module.exports = router;
