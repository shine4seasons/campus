const router = require('express').Router();
const walletController = require('../controllers/walletController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { payoutRequestSchema } = require('../validation/mutateSchemas');

router.post('/payout-request', protect, validate(payoutRequestSchema), walletController.submitPayoutRequest);
router.get('/transactions', protect, walletController.getTransactions);
router.get('/payout-requests', protect, walletController.getPayoutRequests);

module.exports = router;
