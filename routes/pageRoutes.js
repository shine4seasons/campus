const router  = require('express').Router();
const Product = require('../models/Product');
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
// ── Guard: redirect về /login nếu chưa đăng nhập ──────
const requireAuth = (req, res, next) => {
  if (!res.locals.user) {
    const back = encodeURIComponent(req.originalUrl);
    return res.redirect('/login?redirect=' + back);
  }
  next();
};

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
router.get('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.redirect('/login');
});

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
        isLoginPage: false,
        mapsKey: MAPS_KEY,
      });
    }

    // Tăng view count (fire-and-forget)
    Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }).catch(() => {});

    res.render('product', {
      title  : product.title + ' — Campus Marketplace',
      product,
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
    isLoginPage: false,
    mapsKey    : MAPS_KEY,
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
router.get('/orders', requireAuth, async (req, res) => {
  try {
    const orders = await Product.find({ buyer: res.locals.user._id })
      .sort('-soldAt')
      .populate('seller', 'name nickname avatar university rating')
      .lean();
    
    res.render('orders', { 
      title: 'My Orders — Campus Marketplace',
      isLoginPage: false,
      mapsKey: MAPS_KEY,
      orders: orders
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).render('orders', {
      title: 'My Orders — Campus Marketplace',
      isLoginPage: false,
      mapsKey: MAPS_KEY,
      orders: []
    });
  }
});

// ── GET /dashboard ─────────────────────────────────────
router.get('/dashboard', requireAuth, (req, res) => {
  if (res.locals.user.role !== 'admin') return res.redirect('/');
  res.render('dashboard', { 
    title: 'Admin Dashboard — Campus Marketplace',
    isLoginPage: false
  });
});

module.exports = router;
