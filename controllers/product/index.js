const Product = require('../../models/Product');
const User    = require('../../models/User');
const { ALLOWED_UPDATE_FIELDS } = require('./constants');

const parseProductQuantity = (value) => {
  const quantity = Number.parseInt(value, 10);
  return Number.isFinite(quantity) && quantity >= 0 ? quantity : NaN;
};

const buildFilter = (query) => {
  const filter = { status: 'active', $or: [{ quantity: { $gt: 0 } }, { quantity: { $exists: false } }] };
  if (query.category) filter.category = query.category;
  if (query.condition) filter.condition = query.condition;
  if (query.seller)   filter.seller = query.seller;
  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }
  return filter;
};

const getProducts = async (req, res) => {
  try {
    const { q, page = 1, limit = 12, sort = '-createdAt' } = req.query;
    const filter = buildFilter(req.query);

    // Exclude own products on general feed
    if (req.user && !req.query.seller) {
      filter.seller = { $ne: req.user._id };
    }

    let query;
    let queryFilter = filter;
    if (q) {
      queryFilter = { ...filter, $text: { $search: q } };
      query = Product.find(queryFilter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
    } else {
      query = Product.find(filter).sort(sort);
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(queryFilter);
    const products = await query
      .skip(skip)
      .limit(Number(limit))
      .populate('seller', 'name nickname avatar university rating ratingCount totalSales')
      .lean();

    res.json({
      success: true,
      data: products,
      pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name nickname avatar university rating ratingCount totalSales createdAt')
      .lean();

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

      incrementViews(req.params.id);

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const { title, description, price, category, condition, images, location } = req.body;
    const quantity = parseProductQuantity(req.body.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const product = await Product.create({
      title, description, price, quantity, category, condition,
      images:   images || [],
      location: location || {},
      seller:   req.user._id,
    });

    await User.findByIdAndUpdate(req.user._id, { $inc: { totalSales: 0 } });

    const populated = await product.populate('seller', 'name nickname avatar university');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (String(product.seller) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const oldPrice = product.price;
    const oldStatus = product.status;
    ALLOWED_UPDATE_FIELDS.forEach(k => {
      if (req.body[k] === undefined) return;
      if (k === 'quantity') {
        const quantity = parseProductQuantity(req.body[k]);
        if (!Number.isFinite(quantity)) throw new Error('Quantity must be a non-negative number');
        product.quantity = quantity;
        if (quantity === 0) {
          product.status = 'sold';
          product.soldAt = product.soldAt || new Date();
        }
        if (quantity > 0 && product.status === 'sold' && req.body.status === undefined) {
          product.status = 'active';
          product.soldAt = null;
          product.buyer = null;
        }
        return;
      }
      product[k] = req.body[k];
    });

    const priceDropped = req.body.price !== undefined && req.body.price < oldPrice;

    if (req.body.status === 'sold' && oldStatus !== 'sold') {
      product.quantity = 0;
      product.soldAt = new Date();
      if (req.body.buyerId) product.buyer = req.body.buyerId;
      User.findByIdAndUpdate(product.seller, { $inc: { totalSales: 1 } }).catch(() => {});
    }

    await product.save();

    // If price dropped, notify all users who favorited this product
    if (priceDropped) {
      try {
        const Favorite = require('../../models/Favorite');
        const { sendNotification } = require('../../utils/notifService');
        const favorites = await Favorite.find({ product: product._id });
        
        for (const fav of favorites) {
          await sendNotification({
            recipient: fav.user,
            sender:    product.seller,
            type:      'info',
            title:     'Price Drop!',
            message:   `The price of "${product.title}" has dropped to ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(product.price)}!`,
            link:      `/products/${product._id}`
          });
        }
      } catch (notifErr) {
        console.error('Price drop notification error:', notifErr);
      }
    }

    await product.populate('seller', 'name nickname avatar university');
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (String(product.seller) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await product.deleteOne();
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMyProducts = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { seller: req.user._id };
    if (status) filter.status = status;

    const products = await Product.find(filter).sort('-createdAt').lean();
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const toggleInterested = async (req, res) => {
  try {
    const Favorite = require('../../models/Favorite');
    const existing = await Favorite.findOne({ user: req.user._id, product: req.params.id });

    let product;
    if (existing) {
      await Favorite.deleteOne({ _id: existing._id });
      product = await Product.findByIdAndUpdate(req.params.id, { $inc: { interested: -1 } }, { new: true });
    } else {
      await Favorite.create({ user: req.user._id, product: req.params.id });
      product = await Product.findByIdAndUpdate(req.params.id, { $inc: { interested: 1 } }, { new: true });
    }

    res.json({ success: true, interested: product.interested, isFavorited: !existing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/products/favorites — list user's favorited products with pagination
const getFavorites = async (req, res) => {
  try {
    const Favorite = require('../../models/Favorite');
    const page  = Math.max(parseInt(req.query.page,  10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
    const skip  = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      Favorite.find({ user: req.user._id })
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'product',
          select: 'title price quantity images category condition status seller interested ratingAverage ratingCount soldAt',
          populate: { path: 'seller', select: 'name nickname avatar' }
        })
        .lean(),
      Favorite.countDocuments({ user: req.user._id })
    ]);

    // Filter out favorites whose product was deleted
    const items = favorites
      .filter(f => f.product)
      .map(f => ({ ...f.product, favoritedAt: f.createdAt }));

    res.json({
      success: true,
      data: items,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/products/favorites/ids — return array of favorited product IDs for client-side checks
const getFavoriteIds = async (req, res) => {
  try {
    const Favorite = require('../../models/Favorite');
    const favs = await Favorite.find({ user: req.user._id }).select('product').lean();
    res.json({ success: true, data: favs.map(f => String(f.product)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getMyProducts, toggleInterested, getFavorites, getFavoriteIds };
