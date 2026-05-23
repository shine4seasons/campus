const ratingRepository = require('../../repositories/ratingRepository');

/**
 * Submit or update rating for product or user
 */
exports.submitRating = async (req, res, next) => {
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
      const product = await ratingRepository.findProductById(entityId);
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    } else if (entityType === 'user') {
      const user = await ratingRepository.findUserById(entityId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find or create rating
    let rating = await ratingRepository.findRatingByEntityAndRater({ entityType, entityId, raterId });

    const isUpdate = !!rating;

    if (!rating) {
      rating = ratingRepository.createRatingDocument({ entityType, entityId, raterId });
    }

    // Update rating
    rating.score = Math.round(score);
    rating.comment = (comment || '').trim().substring(0, 500);
    await rating.save();

    // Update entity's rating stats in DB (no full document transfer)
    const { average, ratingCount } = await ratingRepository.getRatingAggregate({ entityType, entityId });

    if (entityType === 'product') {
      const product = await ratingRepository.updateProductRatingStats(entityId, {
        average,
        ratingCount,
      });
      
      // Update seller's rating based on all their products
      if (product) {
        await updateSellerRating(product.seller);
      }
    } else if (entityType === 'user') {
      await ratingRepository.updateUserRatingStats(entityId, {
        average,
        ratingCount,
      });
    }

    // Send notification to the rated entity
    try {
      const { sendNotification } = require('../../utils/notifService');
      let recipientId = entityId;
      let targetName = 'you';
      
      if (entityType === 'product') {
        const prod = await ratingRepository.findProductByIdForNotification(entityId);
        recipientId = prod.seller;
        targetName = `your product "${prod.title}"`;
      }

      await sendNotification({
        recipient: recipientId,
        sender:    raterId,
        type:      'rating',
        title:     'New Rating Received',
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
    return next(error);
  }
};

async function updateSellerRating(sellerId) {
  try {
    const agg = await ratingRepository.getSellerRatingAggregate(sellerId);

    if (!agg) {
      // If no products have ratings, we keep default 5.0
      await ratingRepository.resetUserRatingStats(sellerId);
      return; 
    }

    await ratingRepository.updateUserRatingStats(sellerId, {
      average: agg.average,
      ratingCount: agg.ratingCount
    });
  } catch (error) {
    console.error('Error updating seller rating:', error);
  }
}

/**
 * Sync all sellers' ratings based on their products
 */
exports.syncAllRatings = async (req, res, next) => {
  try {
    const [allUsers, sellerAgg] = await Promise.all([
      ratingRepository.findAllUserIds(),
      ratingRepository.getSellerRatingAggregates(),
    ]);

    const aggBySeller = new Map(
      sellerAgg
        .filter((row) => row && row._id)
        .map((row) => [String(row._id), row])
    );

    if (allUsers.length > 0) {
      const ops = allUsers.map((user) => {
        const row = aggBySeller.get(String(user._id));
        if (!row) {
          return {
            updateOne: {
              filter: { _id: user._id },
              update: { $set: { rating: 5.0, ratingCount: 0 } },
            },
          };
        }

        return {
          updateOne: {
            filter: { _id: user._id },
            update: {
              $set: {
                rating: Number((row.avgRating || 0).toFixed(2)),
                ratingCount: row.totalCount || 0,
              },
            },
          },
        };
      });

      await ratingRepository.bulkWriteUserRatings(ops);
    }

    res.json({
      success: true,
      message: `Successfully synchronized ratings for ${allUsers.length} users.`,
    });
  } catch (error) {
    console.error('[rating] syncAllRatings error:', error);
    return next(error);
  }
};

// Export internal helper
exports.updateSellerRating = updateSellerRating;

/**
 * Get ratings for product or user
 */
exports.getRatings = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.query;

    if (!['product', 'user'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }

    if (!entityId || !entityId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid entity ID' });
    }

    const ratings = await ratingRepository.findRatingsForEntity({ entityType, entityId });

    res.json({
      success: true,
      data: ratings,
    });
  } catch (error) {
    console.error('[rating] getRatings error:', error);
    return next(error);
  }
};

/**
 * Get user's rating for a product or user
 */
exports.getUserRating = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.query;
    const raterId = req.user._id;

    if (!['product', 'user'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }

    if (!entityId || !entityId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid entity ID' });
    }

    const rating = await ratingRepository.findUserRating({ entityType, entityId, raterId });

    res.json({
      success: true,
      data: rating || null,
    });
  } catch (error) {
    console.error('[rating] getUserRating error:', error);
    return next(error);
  }
};

/**
 * Get aggregate stats for product or user
 */
exports.getRatingStats = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.query;

    if (!['product', 'user'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }

    if (!entityId || !entityId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid entity ID' });
    }

    const stats = await ratingRepository.getRatingDistribution({ entityType, entityId });

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
    return next(error);
  }
};

/**
 * Delete rating
 */
exports.deleteRating = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.body;
    const raterId = req.user._id;

    if (!['product', 'user'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }

    const rating = await ratingRepository.deleteUserRating({ entityType, entityId, raterId });

    if (!rating) {
      return res.status(404).json({ success: false, message: 'Rating not found' });
    }

    // Recalculate entity's rating stats in DB (no full document transfer)
    const { average, ratingCount } = await ratingRepository.getRatingAggregate({ entityType, entityId });

    if (ratingCount > 0) {

      if (entityType === 'product') {
        const product = await ratingRepository.updateProductRatingStats(entityId, {
          average,
          ratingCount,
        });
        if (product) await updateSellerRating(product.seller);
      } else if (entityType === 'user') {
        await ratingRepository.updateUserRatingStats(entityId, {
          average,
          ratingCount,
        });
      }
    } else {
      // No ratings left, reset to default
      if (entityType === 'product') {
        const product = await ratingRepository.updateProductRatingStats(entityId, {
          average: 0,
          ratingCount: 0,
        });
        if (product) await updateSellerRating(product.seller);
      } else if (entityType === 'user') {
        await ratingRepository.resetUserRatingStats(entityId);
      }
    }

    res.json({ success: true, message: 'Rating deleted successfully' });
  } catch (error) {
    console.error('[rating] deleteRating error:', error);
    return next(error);
  }
};

