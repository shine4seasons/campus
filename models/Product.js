const mongoose = require('mongoose');
const { PRODUCT_STATUS, PRODUCT_CATEGORIES, PRODUCT_CONDITIONS } = require('../config/appConstants');


const ProductSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 2000 },
    price:       { type: Number, required: true, min: 0 },

    category: {
      type: String,
      required: true,
      enum: PRODUCT_CATEGORIES,
    },

    condition: {
      type: String,
      required: true,
      enum: PRODUCT_CONDITIONS,
    },


    // Ảnh — tối đa 5, lưu URL (Cloudinary sẽ xử lý ở Feature 4)
    images: {
      type: [String],
      validate: { validator: v => v.length <= 5, message: 'Tối đa 5 ảnh' },
      default: [],
    },

    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.ACTIVE,
      index: true,
    },


    reported: {
      type: Boolean,
      default: false,
      index: true,
    },

    // AI generated description (Feature 4)
    aiDescription: { type: String, default: '' },

    views:     { type: Number, default: 0 },
    interested: { type: Number, default: 0 },  // số người bấm "quan tâm"

    // Rating information
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount:   { type: Number, default: 0 },

    // Location tùy chọn (Map feature)
    location: {
      address: { type: String, default: '' },
      lat:     { type: Number, default: null },
      lng:     { type: Number, default: null },
    },

    // Buyer khi đã bán
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    soldAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Text index để full-text search trên title và description
ProductSchema.index({ title: 'text', description: 'text' }, { weights: { title: 3, description: 1 } });

// Compound index hay dùng: lọc active + sort by date
ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ category: 1, status: 1 });
ProductSchema.index({ seller: 1, status: 1 });

module.exports = mongoose.model('Product', ProductSchema);
