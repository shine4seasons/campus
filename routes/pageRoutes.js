const router  = require('express').Router();
const Product = require('../models/Product');

const requireAuth = require('../middleware/pageAuth');
const authController = require('../controllers/auth');

// ── GET / ──────────────────────────────────────────────
router.get('/', (req, res) => {
  res.render('index', { 
    title: 'Campus Marketplace',
    isLoginPage: false
  });
});

// ── GET /login ─────────────────────────────────────────
router.get('/login', (req, res) => {
  // Nếu đã login đầy đủ → về home (tránh vòng lặp redirect)
  if (res.locals.user && res.locals.user.profileComplete) {
    return res.redirect('/');
  }
  res.render('login', {
    title : 'Login — Campus Marketplace',
    error : req.query.error || null,
    step  : req.query.step  || null,
    isLoginPage: true,
  });
});

// ── GET /logout ────────────────────────────────────────
router.get('/logout', authController.logoutRedirect);

// ── GET /callback ──────────────────────────────────────
// Fallback page sau khi Google OAuth (server đã set cookie)
router.get('/callback', (req, res) => {
  res.render('callback', { title: 'Authenticating...' });
});

// ── GET /products/:id ──────────────────────────────────
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name nickname avatar university rating ratingCount totalSales createdAt')
      .lean();

    if (!product || product.status === 'hidden') {
      return res.status(404).render('404', { 
        title: '404 — Not Found',
        isLoginPage: false
      });
    }

    // Tăng view count (fire-and-forget)
    const { incrementViews } = require('../utils/viewCounter');
    incrementViews(req.params.id);

    // Fetch related products (same category, active, not the current one)
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      status: 'active'
    })
      .sort('-views') // Sort by popularity
      .limit(4)
      .lean();

    res.render('product', {
      title  : product.title + ' — Campus Marketplace',
      product,
      relatedProducts, // Pass related products to view
      isLoginPage: false
    });
  } catch {
    res.status(404).render('404', { 
      title: '404 — Not Found',
      isLoginPage: false
    });
  }
});

// ── GET /my-products ───────────────────────────────────
router.get('/my-products', requireAuth, async (req, res) => {
  try {
    const products = await Product.find({ seller: res.locals.user._id })
      .sort('-createdAt')
      .lean();

    res.render('my-products', {
      title: 'My Listings — Campus Marketplace',
      products,
      isLoginPage: false
    });
  } catch {
    res.status(500).render('404', { 
      title: 'Error',
      isLoginPage: false
    });
  }
});

// ── GET /sell ──────────────────────────────────────────
router.get('/sell', requireAuth, async (req, res) => {
  const editId = req.query.id || null;
  let editProduct = null;

  if (editId) {
    try {
      const p = await Product.findById(editId).lean();
      if (p && String(p.seller) === String(res.locals.user._id)) {
        editProduct = p;
      }
    } catch {}
  }

  res.render('sell', {
    title      : editProduct ? 'Edit Listing — Campus Marketplace' : 'Post a Listing — Campus Marketplace',
    editProduct,
    isLoginPage: false
  });
});

// ── GET /profile ───────────────────────────────────────
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const products = await Product.find({ seller: res.locals.user._id })
      .sort('-createdAt')
      .lean();
    res.render('profile', {
      title: 'My Profile — Campus Marketplace',
      products,
      isLoginPage: false
    });
  } catch {
    res.render('profile', { 
      title: 'My Profile — Campus Marketplace', 
      products: [],
      isLoginPage: false
    });
  }
});

// ── GET /orders ────────────────────────────────────────
router.get('/orders', requireAuth, (req, res) => {
  res.render('orders', { 
    title: 'My Orders — Campus Marketplace',
    isLoginPage: false
  });
});

// ── GET /messages ──────────────────────────────────────
router.get('/messages', requireAuth, (req, res) => {
  // Pass down standard variables; the JS polling handles the data fetching
  res.render('messages', {
    title: 'Messages — Campus Marketplace',
    conversationId: req.query.id || null, // Optional: auto-select a specific conversation
    isLoginPage: false
  });
});

// ── GET /dashboard ─────────────────────────────────────
router.get('/dashboard', requireAuth, (req, res) => {
  const role = res.locals.user && res.locals.user.role ? res.locals.user.role : null;
  if (role === 'admin') {
    return res.render('dashboard-admin', { title: 'Admin Dashboard — Campus Marketplace', isLoginPage: false });
  }
  // Serve seller dashboard to sellers. For regular users, serve a seller preview/dashboard
  // so toggling to seller mode from the UI leads to the expected page.
  if (role === 'seller') {
    return res.render('dashboard-seller', { title: 'Seller Dashboard — Campus Marketplace', isLoginPage: false, isSeller: true });
  }
  // Non-seller users: render seller dashboard in preview mode (no destructive actions).
  return res.render('dashboard-seller', { title: 'Seller Dashboard — Campus Marketplace', isLoginPage: false, isSeller: false });
});

// ── GET /dashboard-seller (explicit route) ─────────────────
router.get('/dashboard-seller', requireAuth, (req, res) => {
  const role = res.locals.user && res.locals.user.role ? res.locals.user.role : null;
  if (role === 'seller') {
    return res.render('dashboard-seller', { title: 'Seller Dashboard — Campus Marketplace', isLoginPage: false, isSeller: true });
  }
  return res.render('dashboard-seller', { title: 'Seller Dashboard — Campus Marketplace', isLoginPage: false, isSeller: false });
});

module.exports = router;
