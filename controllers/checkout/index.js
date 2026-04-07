const Product = require('../../models/Product');

// Render checkout page (shared implementation)
const getCheckoutPage = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId)
      .populate('seller', 'name nickname avatar university phone');

    if (!product) {
      return res.status(404).render('error', { message: 'Không tìm thấy sản phẩm', user: req.user });
    }

    // Prevent owner from buying own product
    if (String(product.seller._id) === String(req.user._id)) {
      return res.redirect('/products/' + product._id);
    }

    // Prevent buying sold product
    if (product.status === 'sold') {
      return res.redirect('/products/' + product._id);
    }

    res.render('checkout', {
      title: 'Đặt hàng — ' + product.title,
      product,
      user: req.user,
    });
  } catch (err) {
    console.error('[checkout] getCheckoutPage:', err);
    res.status(500).render('error', { message: err.message, user: req.user });
  }
};

module.exports = { getCheckoutPage };
