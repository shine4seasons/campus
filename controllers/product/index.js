const Product = require('../../models/Product');
const User    = require('../../models/User');
const { ALLOWED_UPDATE_FIELDS } = require('./constants');

const buildFilter = (query) => {
  const filter = { status: 'active' };
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

    let query;
    if (q) {
      query = Product.find({ ...filter, $text: { $search: q } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
    } else {
      query = Product.find(filter).sort(sort);
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);
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

    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

      incrementViews(req.params.id);

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const { title, description, price, category, condition, images, location } = req.body;

    const product = await Product.create({
      title, description, price, category, condition,
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
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy' });

    if (String(product.seller) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const oldPrice = product.price;
    ALLOWED_UPDATE_FIELDS.forEach(k => { if (req.body[k] !== undefined) product[k] = req.body[k]; });

    const priceDropped = req.body.price !== undefined && req.body.price < oldPrice;

    if (req.body.status === 'sold' && product.status !== 'sold') {
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
            title:     'Price Drop! 🔥',
            message:   `The price of "${product.title}" has dropped to ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}!`,
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
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy' });

    if (String(product.seller) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    await product.deleteOne();
    res.json({ success: true, message: 'Đã xóa sản phẩm' });
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

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getMyProducts, toggleInterested };
