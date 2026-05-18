const router = require('express').Router();
const walletController = require('../controllers/walletController');
const { protect } = require('../middleware/auth');

router.post('/payout-request', protect, walletController.submitPayoutRequest);
router.get('/transactions', protect, walletController.getTransactions);
router.get('/payout-requests', protect, walletController.getPayoutRequests);

module.exports = router;
