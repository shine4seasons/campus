const Product = require('../models/Product');
const User    = require('../models/User');

// ── Helpers ────────────────────────────────────────────────

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

// ── GET /api/products ──────────────────────────────────────
// Lấy danh sách sản phẩm, hỗ trợ filter + sort + pagination + search
const getProducts = async (req, res) => {
  try {
    const {
      q,           // full-text search
      page  = 1,
      limit = 12,
      sort  = '-createdAt',   // newest first
    } = req.query;

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
      .populate('seller', 'name nickname avatar university rating')
      .lean();

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/products/:id ──────────────────────────────────
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name nickname avatar university rating ratingCount totalSales createdAt')
      .lean();

    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    // Tăng view count (fire-and-forget, không block response)
    Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }).catch(() => {});

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/products ─────────────────────────────────────
const createProduct = async (req, res) => {
  try {
    const { title, description, price, category, condition, images, location } = req.body;

    const product = await Product.create({
      title, description, price, category, condition,
      images:   images || [],
      location: location || {},
      seller:   req.user._id,
    });

    // Tăng totalSales counter khi đăng sản phẩm (sẽ tăng lại khi sold)
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalSales: 0 } });

    const populated = await product.populate('seller', 'name nickname avatar university');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/products/:id ────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy' });

    // Chỉ seller hoặc admin mới được sửa
    if (String(product.seller) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const ALLOWED = ['title', 'description', 'price', 'category', 'condition', 'images', 'status', 'location'];
    ALLOWED.forEach(k => { if (req.body[k] !== undefined) product[k] = req.body[k]; });

    // Nếu đánh dấu sold → ghi nhận thời gian và update seller stats
    if (req.body.status === 'sold' && product.status !== 'sold') {
      product.soldAt = new Date();
      if (req.body.buyerId) product.buyer = req.body.buyerId;
      User.findByIdAndUpdate(product.seller, { $inc: { totalSales: 1 } }).catch(() => {});
    }

    await product.save();
    await product.populate('seller', 'name nickname avatar university');
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── DELETE /api/products/:id ───────────────────────────────
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

// ── GET /api/products/my ───────────────────────────────────
// Lấy sản phẩm của chính mình (mọi status)
const getMyProducts = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { seller: req.user._id };
    if (status) filter.status = status;

    const products = await Product.find(filter)
      .sort('-createdAt')
      .lean();

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/products/:id/interested ─────────────────────
const toggleInterested = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { interested: 1 } },
      { new: true }
    );
    res.json({ success: true, interested: product.interested });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getMyProducts, toggleInterested };
