const mongoose = require('mongoose');
const { ORDER_STATUS, DELIVERY_MODES, PAYMENT_MODES } = require('../config/appConstants');


const ShippingAddressSchema = new mongoose.Schema({
  name:     { type: String, default: '' },
  phone:    { type: String, default: '' },
  street:   { type: String, default: '' },
  district: { type: String, default: '' },
  city:     { type: String, default: '' },
  lat:      { type: Number, default: null },
  lng:      { type: Number, default: null },
}, { _id: false });

const OrderSchema = new mongoose.Schema(
  {
    product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    buyer:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },
    seller:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },

    // Snapshot giá tại thời điểm đặt hàng
    // (tránh thay đổi khi seller edit price sau)
    priceSnapshot: { type: Number, required: true },

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
  },
  { timestamps: true }
);

// Dùng để xem lịch sử mua của buyer, bán của seller
OrderSchema.index({ buyer:  1, createdAt: -1 });
OrderSchema.index({ seller: 1, createdAt: -1 });
OrderSchema.index({ product: 1, status: 1 });

module.exports = mongoose.model('Order', OrderSchema);
