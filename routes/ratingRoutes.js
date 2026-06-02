const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validate');
const { ratingSubmitSchema, ratingDeleteSchema } = require('../validation/mutateSchemas');
const { ratingEntityQuerySchema } = require('../validation/requestSchemas');
const ratingController = require('../controllers/rating');

router.use(protect);

router.post('/', validate(ratingSubmitSchema), ratingController.submitRating);
router.get('/', validateQuery(ratingEntityQuerySchema), ratingController.getRatings);
router.get('/user-rating', validateQuery(ratingEntityQuerySchema), ratingController.getUserRating);
router.get('/stats', validateQuery(ratingEntityQuerySchema), ratingController.getRatingStats);
router.delete('/', validate(ratingDeleteSchema), ratingController.deleteRating);

module.exports = router;
