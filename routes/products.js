const router = require('express').Router();
const {
  getProducts, getProduct, createProduct, updateProduct, updateProductStatus, markSold, relist,
  deleteProduct, getMyProducts, toggleInterested,
  getFavorites, getFavoriteIds,
} = require('../controllers/product');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createProductSchema, updateProductSchema, updateProductStatusSchema } = require('../validation/productSchemas');
const { emptyBodySchema } = require('../validation/mutateSchemas');

// Public
router.get('/',                   getProducts);
router.get('/my',                 protect, getMyProducts);       // phải đặt trước /:id
router.get('/favorites',          protect, getFavorites);        // phải đặt trước /:id
router.get('/favorites/ids',      protect, getFavoriteIds);      // phải đặt trước /:id
router.get('/:id',                getProduct);

// Protected
router.post('/',                  protect, validate(createProductSchema), createProduct);
router.patch('/:id',              protect, validate(updateProductSchema), updateProduct);
router.patch('/:id/status',       protect, validate(updateProductStatusSchema), updateProductStatus);
router.post('/:id/mark-sold',     protect, validate(emptyBodySchema), markSold);
router.post('/:id/relist',        protect, validate(emptyBodySchema), relist);
router.delete('/:id',             protect, validate(emptyBodySchema), deleteProduct);
router.post('/:id/interested',    protect, validate(emptyBodySchema), toggleInterested);

module.exports = router;
