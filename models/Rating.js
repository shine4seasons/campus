const mongoose = require('mongoose');

const RatingSchema = new mongoose.Schema(
  {
    ratedEntity: {
      type: String,
      enum: ['product', 'user'],
      required: true,
      index: true,
    },
    
    // ID của product hoặc user được rating
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Người dùng đã rating
    rater: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Rating scores
    score: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    // Comment (optional)
    comment: {
      type: String,
      maxlength: 500,
      default: '',
    },

    // Order reference (for product ratings after purchase)
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index: chỉ cho phép 1 rating per user per product/user
RatingSchema.index({ ratedEntity: 1, entityId: 1, rater: 1 }, { unique: true });

// Indexes cho query
RatingSchema.index({ ratedEntity: 1, entityId: 1, createdAt: -1 });
RatingSchema.index({ rater: 1, createdAt: -1 });

module.exports = mongoose.model('Rating', RatingSchema);
