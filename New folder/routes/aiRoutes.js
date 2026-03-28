const router              = require('express').Router();
const { protect }         = require('../middleware/auth');
const { describeProduct } = require('../controllers/aiController');

// POST /api/ai/describe — sinh mô tả sản phẩm bằng AI
router.post('/describe', protect, describeProduct);

module.exports = router;
