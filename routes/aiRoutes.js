const router              = require('express').Router();
const { protect }         = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { limitAiDescribe } = require('../middleware/security');
const { aiDescribeSchema } = require('../validation/mutateSchemas');
const { describeProduct } = require('../controllers/ai');

// POST /api/ai/describe — sinh mô t? s?n ph?m b?ng AI
router.post('/describe', limitAiDescribe, protect, validate(aiDescribeSchema), describeProduct);

module.exports = router;
