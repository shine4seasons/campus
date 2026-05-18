const mongoose = require('mongoose');
const { ORDER_STATUS, DELIVERY_MODES, PAYMENT_MODES, DISPUTE_STATUS, DISPUTE_CATEGORIES } = require('../config/appConstants');


const ShippingAddressSchema = new mongoose.Schema({
  name:     { type: String, default: '' },
  phone:    { type: String, default: '' },
  street:   { type: String, default: '' },
  district: { type: String, default: '' },
  city:     { type: String, default: '' },
  lat:      { type: Number, default: null },
  lng:      { type: Number, default: null },
}, { _id: false });

// Timeline entry — records every status change with actor + timestamp
const TimelineEntrySchema = new mongoose.Schema({
  event:  { type: String, required: true },                                          // 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'dispute-opened' | 'dispute-resolved'
  actor:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },      // who triggered the change
  at:     { type: Date, default: Date.now },
  note:   { type: String, default: '' },
}, { _id: false });

// Dispute sub-document — buyer or seller can open one on confirmed/completed orders
const DisputeSchema = new mongoose.Schema({
  status:         { type: String, enum: Object.values(DISPUTE_STATUS), default: DISPUTE_STATUS.OPEN },
  openedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  openedRole:     { type: String, enum: ['buyer', 'seller'], required: true },
  category:       { type: String, enum: DISPUTE_CATEGORIES, default: 'other' },
  reason:         { type: String, required: true, maxlength: 200 },
  description:    { type: String, default: '', maxlength: 2000 },
  evidenceImages: { type: [String], default: [] },
  openedAt:       { type: Date, default: Date.now },
  resolvedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolution:     { type: String, default: '' },         // 'buyer-favor' | 'seller-favor' | 'mutual' | 'rejected'
  resolutionNote: { type: String, default: '', maxlength: 1000 },
  resolvedAt:     { type: Date, default: null },
}, { _id: false });

const OrderSchema = new mongoose.Schema(
  {
    product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    buyer:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },
    seller:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },

    // Snapshot giá tại thời điểm đặt hàng
    // (tránh thay đổi khi seller edit price sau)
    priceSnapshot: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },

    deliveryMode: {
      type: String,
      enum: DELIVERY_MODES,
      required: true,
    },

    paymentMode: {
      type: String,
      enum: PAYMENT_MODES,
      required: true,
    },

    shippingAddress: {
      type: ShippingAddressSchema,
      default: null,
    },

    note: { type: String, default: '', maxlength: 500 },

    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true,
    },

    // Link đến cuộc hội thoại đã khởi tạo
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },

    pickupLocation: {
      address: { type: String, default: '' },
      lat:     { type: Number, default: null },
      lng:     { type: Number, default: null },
    },

    // Timestamps phụ
    confirmedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    // Timeline of status transitions — each entry records who changed status and when
    timeline: { type: [TimelineEntrySchema], default: [] },

    // Dispute (null until one is opened)
    dispute: { type: DisputeSchema, default: null },
  },
  { timestamps: true }
);

OrderSchema.index({ 'dispute.status': 1, 'dispute.openedAt': -1 });

// Dùng để xem lịch sử mua của buyer, bán của seller
OrderSchema.index({ buyer:  1, createdAt: -1 });
OrderSchema.index({ seller: 1, createdAt: -1 });
OrderSchema.index({ product: 1, status: 1 });

module.exports = mongoose.model('Order', OrderSchema);
