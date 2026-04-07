const Product = require('../models/Product');

async function incrementViews(productId) {
  if (!productId) return;
  try {
    await Product.findByIdAndUpdate(productId, { $inc: { views: 1 } });
  } catch (e) {
    // ignore failures updating view count
  }
}

module.exports = { incrementViews };
