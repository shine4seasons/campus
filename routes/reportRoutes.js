const router = require('express').Router();
const Report = require('../models/Report');
const { protect } = require('../middleware/auth');
const mongoose = require('mongoose');

// POST /api/report - Create a report
router.post('/', protect, async (req, res) => {
  try {
    const { targetType, targetId, reason, content } = req.body;
    const reporterId = req.user._id;

    // Validate input
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!['product', 'user'].includes(targetType)) {
      return res.status(400).json({ success: false, message: 'Invalid target type' });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ success: false, message: 'Invalid target ID format' });
    }

    const validReasons = [
      'inappropriate-content',
      'offensive-language',
      'fraud-scam',
      'counterfeit-item',
      'damaged-item',
      'misleading-description',
      'fake-account',
      'suspicious-behavior',
      'other'
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({ success: false, message: 'Invalid reason' });
    }

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
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
