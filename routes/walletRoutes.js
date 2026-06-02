const router = require('express').Router();
const walletController = require('../controllers/walletController');
const { protect } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validate');
const { payoutRequestSchema } = require('../validation/mutateSchemas');
const { paginationQuerySchema } = require('../validation/requestSchemas');

router.post('/payout-request', protect, validate(payoutRequestSchema), walletController.submitPayoutRequest);
router.get('/summary', protect, walletController.getSummary);
router.get('/transactions', protect, validateQuery(paginationQuerySchema), walletController.getTransactions);
router.get('/payout-requests', protect, validateQuery(paginationQuerySchema), walletController.getPayoutRequests);

module.exports = router;
