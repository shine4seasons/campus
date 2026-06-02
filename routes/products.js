const router = require('express').Router();
const {
  getProducts, getProduct, createProduct, updateProduct, updateProductStatus, markSold, relist,
  deleteProduct, getMyProducts, toggleInterested,
  getFavorites, getFavoriteIds,
} = require('../controllers/product');
const { protect } = require('../middleware/auth');
const { validate, validateParams, validateQuery } = require('../middleware/validate');
const { createProductSchema, updateProductSchema, updateProductStatusSchema } = require('../validation/productSchemas');
const { emptyBodySchema } = require('../validation/mutateSchemas');
const {
  idParamSchema,
  productFeedQuerySchema,
  productSellerQuerySchema,
  favoriteQuerySchema,
} = require('../validation/requestSchemas');

// Public
router.get('/', validateQuery(productFeedQuerySchema), getProducts);
router.get('/my', protect, validateQuery(productSellerQuerySchema), getMyProducts);
router.get('/favorites', protect, validateQuery(favoriteQuerySchema), getFavorites);
router.get('/favorites/ids', protect, getFavoriteIds);
router.get('/:id', validateParams(idParamSchema), getProduct);

// Protected
router.post('/', protect, validate(createProductSchema), createProduct);
router.patch('/:id', protect, validateParams(idParamSchema), validate(updateProductSchema), updateProduct);
router.patch('/:id/status', protect, validateParams(idParamSchema), validate(updateProductStatusSchema), updateProductStatus);
router.post('/:id/mark-sold', protect, validateParams(idParamSchema), validate(emptyBodySchema), markSold);
router.post('/:id/relist', protect, validateParams(idParamSchema), validate(emptyBodySchema), relist);
router.delete('/:id', protect, validateParams(idParamSchema), validate(emptyBodySchema), deleteProduct);
router.post('/:id/interested', protect, validateParams(idParamSchema), validate(emptyBodySchema), toggleInterested);

module.exports = router;
