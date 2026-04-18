const mongoose = require('mongoose');

const SystemSettingsSchema = new mongoose.Schema({
  platformName: {
    type: String,
    default: 'Campus Marketplace'
  },
  serviceFee: {
    type: Number,
    default: 0
  },
  productImageLimit: {
    type: Number,
    default: 5
  },
  supportEmail: {
    type: String,
    default: 'support@campusmkt.vn'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', SystemSettingsSchema);
