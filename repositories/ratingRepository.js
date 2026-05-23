const mongoose = require('mongoose');
const Rating = require('../models/Rating');
const Product = require('../models/Product');
const User = require('../models/User');

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

function findProductById(productId) {
  return Product.findById(productId);
}

function findProductByIdForNotification(productId) {
  return Product.findById(productId).select('seller title');
}

function findUserById(userId) {
  return User.findById(userId);
}

function findRatingByEntityAndRater({ entityType, entityId, raterId }) {
  return Rating.findOne({
    ratedEntity: entityType,
    entityId,
    rater: raterId
  });
}

function createRatingDocument({ entityType, entityId, raterId }) {
  return new Rating({
    ratedEntity: entityType,
    entityId,
    rater: raterId
  });
}

async function getRatingAggregate({ entityType, entityId }) {
  const [agg] = await Rating.aggregate([
    {
      $match: {
        ratedEntity: entityType,
        entityId: toObjectId(entityId)
      }
    },
    {
      $group: {
        _id: null,
        avg: { $avg: '$score' },
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    average: Number((agg?.avg || 0).toFixed(2)),
    ratingCount: agg?.count || 0
  };
}

function updateProductRatingStats(productId, { average, ratingCount }) {
  return Product.findByIdAndUpdate(productId, {
    ratingAverage: average,
    ratingCount
  });
}

function updateUserRatingStats(userId, { average, ratingCount }) {
  return User.findByIdAndUpdate(userId, {
    rating: average,
    ratingCount
  });
}

async function getSellerRatingAggregate(sellerId) {
  const [agg] = await Product.aggregate([
    { $match: { seller: toObjectId(sellerId), ratingCount: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$ratingAverage' },
        totalCount: { $sum: '$ratingCount' }
      }
    }
  ]);

  if (!agg) {
    return null;
  }

  return {
    average: Number((agg.avgRating || 0).toFixed(2)),
    ratingCount: agg.totalCount || 0
  };
}

function resetUserRatingStats(userId) {
  return User.findByIdAndUpdate(userId, {
    rating: 5.0,
    ratingCount: 0
  });
}

function findAllUserIds() {
  return User.find({}, { _id: 1 }).lean();
}

function getSellerRatingAggregates() {
  return Product.aggregate([
    { $match: { ratingCount: { $gt: 0 } } },
    {
      $group: {
        _id: '$seller',
        avgRating: { $avg: '$ratingAverage' },
        totalCount: { $sum: '$ratingCount' }
      }
    }
  ]);
}

function bulkWriteUserRatings(ops) {
  return User.bulkWrite(ops, { ordered: false });
}

function findRatingsForEntity({ entityType, entityId }) {
  return Rating.find({
    ratedEntity: entityType,
    entityId
  })
    .sort('-createdAt')
    .populate('rater', 'name nickname avatar')
    .lean();
}

function findUserRating({ entityType, entityId, raterId }) {
  return Rating.findOne({
    ratedEntity: entityType,
    entityId,
    rater: raterId
  }).lean();
}

function getRatingDistribution({ entityType, entityId }) {
  return Rating.aggregate([
    {
      $match: {
        ratedEntity: entityType,
        entityId: toObjectId(entityId)
      }
    },
    {
      $group: {
        _id: '$score',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: -1 }
    }
  ]);
}

function deleteUserRating({ entityType, entityId, raterId }) {
  return Rating.findOneAndDelete({
    ratedEntity: entityType,
    entityId,
    rater: raterId
  });
}

module.exports = {
  findProductById,
  findProductByIdForNotification,
  findUserById,
  findRatingByEntityAndRater,
  createRatingDocument,
  getRatingAggregate,
  updateProductRatingStats,
  updateUserRatingStats,
  getSellerRatingAggregate,
  resetUserRatingStats,
  findAllUserIds,
  getSellerRatingAggregates,
  bulkWriteUserRatings,
  findRatingsForEntity,
  findUserRating,
  getRatingDistribution,
  deleteUserRating
};
