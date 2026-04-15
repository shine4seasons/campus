const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ratingController = require('../controllers/rating');

// All rating routes require authentication
router.use(protect);

// POST /api/ratings — submit or update rating
router.post('/', ratingController.submitRating);

// GET /api/ratings — get ratings for product or user
router.get('/', ratingController.getRatings);

// GET /api/ratings/user-rating — get current user's rating
router.get('/user-rating', ratingController.getUserRating);

// GET /api/ratings/stats — get rating stats
router.get('/stats', ratingController.getRatingStats);

// DELETE /api/ratings — delete rating
router.delete('/', ratingController.deleteRating);

module.exports = router;
