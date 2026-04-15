const router = require('express').Router();
const pageController = require('../controllers/pageController');
const authController = require('../controllers/auth');
const requireAuth = require('../middleware/pageAuth');
const requireAdminPage = require('../middleware/adminPageAuth');
const { VIEWS, APP_NAME, TITLE_SEPARATOR } = require('../config/pageConstants');
const { CATEGORIES } = require('../public/js/categories');

// ── GET / ──────────────────────────────────────────────
router.get('/', (req, res) => {
  res.render(VIEWS.INDEX, {
    title: APP_NAME,
    isLoginPage: false,
    CATEGORIES
  });
});

// ── GET /login ─────────────────────────────────────────
router.get('/login', (req, res) => {
  // Redirect if already logged in with complete profile
  if (res.locals.user && res.locals.user.profileComplete) {
    return res.redirect('/');
  }

  res.render(VIEWS.LOGIN, {
    title: `Login${TITLE_SEPARATOR}${APP_NAME}`,
    error: req.query.error || null,
    step: req.query.step || null,
    isLoginPage: true
  });
});

// ── GET /logout ────────────────────────────────────────
router.get('/logout', authController.logoutRedirect);

// ── GET /callback ──────────────────────────────────────
router.get('/callback', (req, res) => {
  res.render(VIEWS.CALLBACK, { title: 'Authenticating...' });
});

// ── GET /products/:id ──────────────────────────────────
router.get('/products/:id', pageController.getProduct);

// ── GET /my-products ───────────────────────────────────
router.get('/my-products', requireAuth, pageController.getMyProducts);

// ── GET /sell ──────────────────────────────────────────
router.get('/sell', requireAuth, pageController.getSellPage);

// ── GET /profile ───────────────────────────────────────
router.get('/profile', requireAuth, pageController.getProfile);

// ── GET /user/:userId ──────────────────────────────────
router.get('/user/:userId', pageController.getUserProfile);

// ── GET /orders ────────────────────────────────────────
// Buyer's orders page
router.get('/orders', requireAuth, pageController.getBuyerOrders);

// ── GET /orders/tracking/:orderId ───────────────────────────────────
// Order tracking page with map
router.get('/orders/tracking/:orderId', requireAuth, pageController.getOrderTracking);

// ── GET /messages ──────────────────────────────────────
router.get('/messages', requireAuth, (req, res) => {
  res.render(VIEWS.MESSAGES, {
    title: `Messages${TITLE_SEPARATOR}${APP_NAME}`,
    conversationId: req.query.id || null,
    isLoginPage: false
  });
});

// ── GET /dashboard ───────────────────────────────────────────── 
// Admin-only dashboard
router.get('/dashboard', requireAuth, requireAdminPage, pageController.getDashboard);

// ── GET /dashboard-seller ────────────────────────────────────────
// Seller/user dashboard - accessible to all authenticated users
router.get('/dashboard-seller', requireAuth, pageController.getDashboard);

// ── GET /orders-seller ───────────────────────────────────
router.get('/orders-seller', requireAuth, pageController.getSellerOrders);

// ── GET /revenue ───────────────────────────────────────────
router.get('/revenue', requireAuth, pageController.getRevenue);

module.exports = router;
