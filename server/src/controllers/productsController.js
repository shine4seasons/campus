const Product = require('../models/Product');

// ── Controllers ──────────────────────────────────────────

/**
 * GET /api/products
 * Lấy danh sách sản phẩm
 */
const getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate('seller', 'name email');
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/products/:id
 * Lấy chi tiết sản phẩm
 */
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('seller', 'name email');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/products
 * Tạo sản phẩm mới (chỉ seller)
 */
const createProduct = async (req, res) => {
  try {
    const { title, description, price, category, images } = req.body;
    const product = new Product({
      title,
      description,
      price,
      category,
      images,
      seller: req.user._id,
    });
    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/products/:id
 * Cập nhật sản phẩm (chỉ seller của sản phẩm)
 */
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const { title, description, price, category, images, status } = req.body;
    product.title = title || product.title;
    product.description = description || product.description;
    product.price = price || product.price;
    product.category = category || product.category;
    product.images = images || product.images;
    product.status = status || product.status;
    await product.save();
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/products/:id
 * Xóa sản phẩm (chỉ seller của sản phẩm)
 */
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await product.remove();
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct };