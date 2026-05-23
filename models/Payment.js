const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../config/appConstants');

const PaymentSchema = new mongoose.Schema({
  // Order references
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // Payment amount and status
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING,
    index: true
  },

  // Legacy payment code (for backward compatibility with VietQR)
  paymentCode: { type: String },

  // SePay-specific fields
  // sepayPaymentId: Unique identifier from SePay API for this payment
  // Used to match incoming transactions with our payment records
  sepayPaymentId: { type: String },

  // sepayQrUrl: QR code image URL from SePay
  // Display this in frontend for buyer to scan
  sepayQrUrl: { type: String, default: null },

  // sepayReferenceCode: Human-readable reference shown in transfer
  // Bank display: "Reference: {sepayReferenceCode}"
  sepayReferenceCode: { type: String, default: null },

  // Bank transaction ID from SePay
  // When buyer transfers money, SePay assigns a transaction ID
  // We store this to prevent duplicate processing (unique constraint)
  bankTransactionId: { type: String, default: undefined },

  // Legacy QR URL (VietQR format) - kept for backward compatibility
  qrUrl: { type: String, default: null },

  // Expiration timestamps
  expiredAt: { type: Date, required: true },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

// Only enforce uniqueness when these optional fields actually have string values.
PaymentSchema.index(
  { paymentCode: 1 },
  {
    name: 'uniq_paymentCode',
    unique: true,
    partialFilterExpression: { paymentCode: { $type: 'string' } }
  }
);

PaymentSchema.index(
  { sepayPaymentId: 1 },
  {
    name: 'uniq_sepayPaymentId',
    unique: true,
    partialFilterExpression: { sepayPaymentId: { $type: 'string' } }
  }
);

PaymentSchema.index(
  { bankTransactionId: 1 },
  {
    name: 'uniq_bankTransactionId',
    unique: true,
    partialFilterExpression: { bankTransactionId: { $type: 'string' } }
  }
);

module.exports = mongoose.model('Payment', PaymentSchema);
