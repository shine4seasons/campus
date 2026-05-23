const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { limitReportSubmit } = require('../middleware/security');
const { reportCreateSchema } = require('../validation/mutateSchemas');
const Report = require('../models/Report');

// POST /api/report - Create a report
router.post('/', limitReportSubmit, protect, validate(reportCreateSchema), async (req, res, next) => {
  try {
    const { targetType, targetId, reason, content } = req.body;
    const reporterId = req.user._id;

    // Check if user already reported this target
    const existingReport = await Report.findOne({
      reporter: reporterId,
      targetType,
      targetId
    });

    if (existingReport) {
      return res.status(400).json({ success: false, message: 'You have already reported this item' });
    }

    // Create report
    const report = new Report({
      reporter: reporterId,
      targetType,
      targetId,
      reason,
      content: content || ''
    });

    await report.save();

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: report
    });
  } catch (error) {
    console.error('Report creation error:', error.message);
    return next(error);
  }
});

module.exports = router;
