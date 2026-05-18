const mongoose = require('mongoose');

const PayoutRequestSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount:      { type: Number, required: true, min: 50000 },
  bankInfo: {
    bankName:      { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountName:   { type: String, required: true }
  },
  status:      { type: String, enum: ['PENDING', 'PROCESSING', 'PAID', 'REJECTED'], default: 'PENDING', index: true },
  adminNote:   { type: String, default: '' },
  processedAt: { type: Date, default: null },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  paidAt:      { type: Date, default: null },
  paidBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  transferReference: { type: String, default: '', trim: true, maxlength: 120 },
  transferNote: { type: String, default: '', trim: true, maxlength: 500 }
}, { timestamps: true });

module.exports = mongoose.model('PayoutRequest', PayoutRequestSchema);
