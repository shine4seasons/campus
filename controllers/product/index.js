const { ALLOWED_UPDATE_FIELDS } = require('./constants');
const { PRODUCT_STATUS } = require('../../config/appConstants');
const { ensureProductOwnerOrAdmin, notifyPriceDropFollowers } = require('../../services/productService');
const productRepository = require('../../repositories/productRepository');
const logger = require('../../utils/logger');
const { incrementViews } = require('../../utils/viewCounter');

const getProducts = async (req, res, next) => {
  try {
    const result = await productRepository.findProductsForFeed({
      query: req.query,
      userId: req.user && req.user._id
    });

    res.json({
      success: true,
      data: result.products,
      pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
    });
  } catch (err) {
    return next(err);
  }
};

const getProduct = async (req, res, next) => {
  try {
    const product = await productRepository.findProductByIdWithSeller(req.params.id);

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    incrementViews(req.params.id).catch(err => logger.error('product.view_increment_failed', {
      err: err.message,
      productId: req.params.id
    }));

    res.json({ success: true, data: product });
  } catch (err) {
    return next(err);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const { title, description, price, quantity, category, condition, images, location } = req.body;

    const product = await productRepository.createProductForSeller({
      sellerId: req.user._id,
      payload: {
        title,
        description,
        price: Number(price),
        quantity: Number(quantity),
        category,
        condition,
        images: images || [],
        location: location || {}
      }
    });

    await productRepository.incrementSellerSalesPlaceholder(req.user._id);

    const populated = await product.populate('seller', 'name nickname avatar university');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    return next(err);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const product = await ensureProductOwnerOrAdmin(req.params.id, req.user);

    const oldPrice = product.price;
    ALLOWED_UPDATE_FIELDS.forEach(k => {
      if (req.body[k] === undefined) return;
      const value = (k === 'price' || k === 'quantity') ? Number(req.body[k]) : req.body[k];
      product.set(k, value);
    });

    const priceDropped = req.body.price !== undefined && req.body.price < oldPrice;

    await product.save();

    // If price dropped, notify all users who favorited this product
    if (priceDropped) {
      try {
        await notifyPriceDropFollowers(product);
      } catch (notifErr) {
        logger.error('product.price_drop_notification_failed', {
          err: notifErr.message,
          stack: notifErr.stack,
          productId: String(product._id)
        });
      }
    }

    await product.populate('seller', 'name nickname avatar university');
    res.json({ success: true, data: product });
  } catch (err) {
    return next(err);
  }
};

const updateProductStatus = async (req, res, next) => {
  try {
    const product = await ensureProductOwnerOrAdmin(req.params.id, req.user);

    product.status = req.body.status;
    await product.save();
    await product.populate('seller', 'name nickname avatar university');

    return res.json({ success: true, data: product });
  } catch (err) {
    return next(err);
  }
};

const markSold = async (req, res, next) => {
  try {
    const product = await ensureProductOwnerOrAdmin(req.params.id, req.user);

    const wasSold = product.status === PRODUCT_STATUS.SOLD;
    if (!wasSold) {
      product.status = PRODUCT_STATUS.SOLD;
      product.quantity = 0;
      product.soldAt = new Date();
      if (req.body && req.body.buyerId) product.buyer = req.body.buyerId;
      await productRepository.incrementSellerSales(product.seller, 1).catch(() => {});
      await product.save();
    }

    await product.populate('seller', 'name nickname avatar university');
    return res.json({ success: true, data: product });
  } catch (err) {
    return next(err);
  }
};

const relist = async (req, res, next) => {
  try {
    const product = await ensureProductOwnerOrAdmin(req.params.id, req.user);

    product.status = PRODUCT_STATUS.ACTIVE;
    product.soldAt = null;
    product.buyer = null;
    if (!Number.isFinite(product.quantity) || product.quantity <= 0) product.quantity = 1;
    await product.save();

    await product.populate('seller', 'name nickname avatar university');
    return res.json({ success: true, data: product });
  } catch (err) {
    return next(err);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const product = await ensureProductOwnerOrAdmin(req.params.id, req.user);

    await product.deleteOne();
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

const getMyProducts = async (req, res, next) => {
  try {
    const result = await productRepository.findProductsBySeller({
      sellerId: req.user._id,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit
    });
    res.json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    return next(err);
  }
};

const toggleInterested = async (req, res, next) => {
  try {
    const existing = await productRepository.findFavoriteByUserAndProduct(req.user._id, req.params.id);

    let product;
    if (existing) {
      await productRepository.deleteFavoriteById(existing._id);
      product = await productRepository.updateInterestedCount(req.params.id, -1);
    } else {
      await productRepository.createFavorite(req.user._id, req.params.id);
      product = await productRepository.updateInterestedCount(req.params.id, 1);
    }

    res.json({ success: true, interested: product.interested, isFavorited: !existing });
  } catch (err) {
    return next(err);
  }
};

// GET /api/products/favorites — list user's favorited products with pagination
const getFavorites = async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page,  10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
    const result = await productRepository.findFavoritesForUser({
      userId: req.user._id,
      page,
      limit,
      q: req.query.q || ''
    });

    res.json({
      success: true,
      data: result.items,
      pagination: {
        page, limit, total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasMore: page * limit < result.total
      }
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/products/favorites/ids — return array of favorited product IDs for client-side checks
const getFavoriteIds = async (req, res, next) => {
  try {
    const favoriteIds = await productRepository.findFavoriteIdsForUser(req.user._id);
    res.json({ success: true, data: favoriteIds });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  updateProductStatus,
  markSold,
  relist,
  deleteProduct,
  getMyProducts,
  toggleInterested,
  getFavorites,
  getFavoriteIds
};
