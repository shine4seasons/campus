const mongoose = require('mongoose');
const Rating = require('../../models/Rating');
const Product = require('../../models/Product');
const User = require('../../models/User');

/**
 * Submit or update rating for product or user
 */
exports.submitRating = async (req, res) => {
  try {
    const { entityType, entityId, score, comment } = req.body;
    const raterId = req.user._id;

    // Validate input
    if (!['product', 'user'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }

    if (!entityId || !entityId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid entity ID' });
    }

    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ success: false, message: 'Score must be between 1 and 5' });
    }

    if (String(raterId) === String(entityId) && entityType === 'user') {
      return res.status(400).json({ success: false, message: 'Cannot rate yourself' });
    }

    // Check if entity exists
    if (entityType === 'product') {
      const product = await Product.findById(entityId);
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    } else if (entityType === 'user') {
      const user = await User.findById(entityId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find or create rating
    let rating = await Rating.findOne({
      ratedEntity: entityType,
      entityId,
      rater: raterId,
    });

    const isUpdate = !!rating;

    if (!rating) {
      rating = new Rating({
        ratedEntity: entityType,
        entityId,
        rater: raterId,
      });
    }

    // Store old score for update calculation
    const oldScore = rating.score || 0;

    // Update rating
    rating.score = Math.round(score);
    rating.comment = (comment || '').trim().substring(0, 500);
    await rating.save();

    // Update entity's rating stats
    const allRatings = await Rating.find({
      ratedEntity: entityType,
      entityId,
    });

    const totalScore = allRatings.reduce((sum, r) => sum + r.score, 0);
    const average = (totalScore / allRatings.length).toFixed(2);

    if (entityType === 'product') {
      const product = await Product.findByIdAndUpdate(entityId, {
        ratingAverage: average,
        ratingCount: allRatings.length,
      });
      
      // Update seller's rating based on all their products
      if (product) {
        await updateSellerRating(product.seller);
      }
    } else if (entityType === 'user') {
      await User.findByIdAndUpdate(entityId, {
        rating: average,
        ratingCount: allRatings.length,
      });
    }

    // Send notification to the rated entity
    try {
      const { sendNotification } = require('../../utils/notifService');
      let recipientId = entityId;
      let targetName = 'you';
      
      if (entityType === 'product') {
        const prod = await Product.findById(entityId);
        recipientId = prod.seller;
        targetName = `your product "${prod.title}"`;
      }

      await sendNotification({
        recipient: recipientId,
        sender:    raterId,
        type:      'rating',
        title:     'New Rating Received ⭐',
        message:   `${req.user.nickname || req.user.name} gave ${targetName} a ${score}-star rating!`,
        link:      entityType === 'product' ? `/products/${entityId}` : '/profile'
      });
    } catch (notifErr) {
      console.error('Rating notification error:', notifErr);
    }

    res.json({
      success: true,
      message: isUpdate ? 'Rating updated successfully' : 'Rating submitted successfully',
      data: rating,
    });
  } catch (error) {
    console.error('[rating] submitRating error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

async function updateSellerRating(sellerId) {
  try {
    const products = await Product.find({ seller: sellerId, ratingCount: { $gt: 0 } });
    
    if (products.length === 0) {
      // If no products have ratings, we keep default 5.0
      await User.findByIdAndUpdate(sellerId, {
        rating: 5.0,
        ratingCount: 0
      });
      return; 
    }

    const totalAverage = products.reduce((sum, p) => sum + p.ratingAverage, 0);
    const totalCount = products.reduce((sum, p) => sum + p.ratingCount, 0);
    const sellerAvg = (totalAverage / products.length).toFixed(2);

    await User.findByIdAndUpdate(sellerId, {
      rating: sellerAvg,
      ratingCount: totalCount // Total number of individual reviews across all products
    });
  } catch (error) {
    console.error('Error updating seller rating:', error);
  }
}

/**
 * Sync all sellers' ratings based on their products
 */
exports.syncAllRatings = async (req, res) => {
  try {
    const users = await User.find({});
    let count = 0;

    for (const user of users) {
      await updateSellerRating(user._id);
      count++;
    }

    res.json({
      success: true,
      message: `Successfully synchronized ratings for ${count} users.`,
    });
  } catch (error) {
    console.error('[rating] syncAllRatings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Export internal helper
exports.updateSellerRating = updateSellerRating;

/**
 * Get ratings for product or user
 */
exports.getRatings = async (req, res) => {
  try {
    const { entityType, entityId } = req.query;

    if (!['product', 'user'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }

    if (!entityId || !entityId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid entity ID' });
    }

    const ratings = await Rating.find({
      ratedEntity: entityType,
      entityId,
    })
      .sort('-createdAt')
      .populate('rater', 'name nickname avatar')
      .lean();

    res.json({
      success: true,
      data: ratings,
    });
  } catch (error) {
    console.error('[rating] getRatings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get user's rating for a product or user
 */
exports.getUserRating = async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    const raterId = req.user._id;

    if (!['product', 'user'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }

    if (!entityId || !entityId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid entity ID' });
    }

    const rating = await Rating.findOne({
      ratedEntity: entityType,
      entityId,
      rater: raterId,
    }).lean();

    res.json({
      success: true,
      data: rating || null,
    });
  } catch (error) {
    console.error('[rating] getUserRating error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get aggregate stats for product or user
 */
exports.getRatingStats = async (req, res) => {
  try {
    const { entityType, entityId } = req.query;

    if (!['product', 'user'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }

    if (!entityId || !entityId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid entity ID' });
    }

    const stats = await Rating.aggregate([
      {
        $match: {
          ratedEntity: entityType,
          entityId: new mongoose.Types.ObjectId(entityId),
        },
      },
      {
        $group: {
          _id: '$score',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: -1 },
      },
    ]);

    // Build distribution object
    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    stats.forEach(s => {
      distribution[s._id] = s.count;
    });

    const totalRatings = Object.values(distribution).reduce((a, b) => a + b, 0);

    res.json({
      success: true,
      data: {
        distribution,
        total: totalRatings,
        average: totalRatings > 0
          ? (Object.entries(distribution).reduce((sum, [score, count]) => sum + score * count, 0) / totalRatings).toFixed(2)
          : 0,
      },
    });
  } catch (error) {
    console.error('[rating] getRatingStats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete rating
 */
exports.deleteRating = async (req, res) => {
  try {
    const { entityType, entityId } = req.body;
    const raterId = req.user._id;

    if (!['product', 'user'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }

    const rating = await Rating.findOneAndDelete({
      ratedEntity: entityType,
      entityId,
      rater: raterId,
    });

    if (!rating) {
      return res.status(404).json({ success: false, message: 'Rating not found' });
    }

    // Recalculate entity's rating stats
    const allRatings = await Rating.find({
      ratedEntity: entityType,
      entityId,
    });

    if (allRatings.length > 0) {
      const totalScore = allRatings.reduce((sum, r) => sum + r.score, 0);
      const average = (totalScore / allRatings.length).toFixed(2);

      if (entityType === 'product') {
        const product = await Product.findByIdAndUpdate(entityId, {
          ratingAverage: average,
          ratingCount: allRatings.length,
        });
        if (product) await updateSellerRating(product.seller);
      } else if (entityType === 'user') {
        await User.findByIdAndUpdate(entityId, {
          rating: average,
          ratingCount: allRatings.length,
        });
      }
    } else {
      // No ratings left, reset to default
      if (entityType === 'product') {
        const product = await Product.findByIdAndUpdate(entityId, {
          ratingAverage: 0,
          ratingCount: 0,
        });
        if (product) await updateSellerRating(product.seller);
      } else if (entityType === 'user') {
        await User.findByIdAndUpdate(entityId, {
          rating: 5.0,
          ratingCount: 0,
        });
      }
    }

    res.json({ success: true, message: 'Rating deleted successfully' });
  } catch (error) {
    console.error('[rating] deleteRating error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
