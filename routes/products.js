const router = require('express').Router();
const {
  getProducts, getProduct, createProduct, updateProduct,
  deleteProduct, getMyProducts, toggleInterested,
  getFavorites, getFavoriteIds,
} = require('../controllers/product');
const { protect } = require('../middleware/auth');

// Public
router.get('/',                   getProducts);
router.get('/my',                 protect, getMyProducts);       // phải đặt trước /:id
router.get('/favorites',          protect, getFavorites);        // phải đặt trước /:id
router.get('/favorites/ids',      protect, getFavoriteIds);      // phải đặt trước /:id
router.get('/:id',                getProduct);

// Protected
router.post('/',                  protect, createProduct);
router.patch('/:id',              protect, updateProduct);
router.delete('/:id',             protect, deleteProduct);
router.post('/:id/interested',    protect, toggleInterested);

module.exports = router;
