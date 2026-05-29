const router = require('express').Router();
const pageController = require('../controllers/pageController');
const authController = require('../controllers/auth');
const requireAuth = require('../middleware/pageAuth');
const requireAdminPage = require('../middleware/adminPageAuth');
const { VIEWS, APP_NAME, TITLE_SEPARATOR } = require('../config/pageConstants');
const { CATEGORIES } = require('../public/js/categories');

router.get('/', (req, res) => {
  if (res.locals.user) {
    if (res.locals.user.role === 'admin') {
      return res.redirect('/dashboard');
    }

    if (res.locals.mode === 'seller') {
      return res.redirect('/dashboard-seller');
    }
  }

  return res.render(VIEWS.INDEX, {
    title: APP_NAME,
    isLoginPage: false,
    CATEGORIES,
  });
});

router.get('/search', pageController.getSearchResults);

router.get('/login', (req, res) => {
  if (res.locals.user && res.locals.user.profileComplete) {
    return res.redirect('/');
  }

  return res.render(VIEWS.LOGIN, {
    title: `Login${TITLE_SEPARATOR}${APP_NAME}`,
    error: req.query.error || null,
    step: req.query.step || null,
    isLoginPage: true,
  });
});

router.get('/logout', authController.logoutRedirect);

router.get('/callback', (req, res) => {
  return res.render(VIEWS.CALLBACK, { title: 'Authenticating...' });
});

router.get('/products/:id', pageController.getProduct);
router.get('/my-products', requireAuth, pageController.getMyProducts);
router.get('/sell', requireAuth, pageController.getSellPage);
router.get('/profile', requireAuth, pageController.getProfile);
router.get('/user/:userId', pageController.getUserProfile);
router.get('/orders', requireAuth, pageController.getBuyerOrders);
router.get('/orders/tracking/:orderId', requireAuth, pageController.getOrderTracking);

router.get('/messages', requireAuth, (req, res) => {
  return res.render(VIEWS.MESSAGES, {
    title: `Messages${TITLE_SEPARATOR}${APP_NAME}`,
    conversationId: req.query.id || null,
    isLoginPage: false,
    activePage: 'messages',
  });
});

router.get('/notifications', requireAuth, (req, res) => {
  return res.render(VIEWS.NOTIFICATIONS, {
    title: `Notifications${TITLE_SEPARATOR}${APP_NAME}`,
    isLoginPage: false,
    activePage: 'notifications',
  });
});

router.get('/favorites', requireAuth, (req, res) => {
  return res.render(VIEWS.FAVORITES, {
    title: `Favorites${TITLE_SEPARATOR}${APP_NAME}`,
    isLoginPage: false,
    activePage: 'favorites',
  });
});

router.get('/dashboard', requireAuth, requireAdminPage, pageController.getDashboard);
router.get('/dashboard-seller', requireAuth, pageController.getDashboard);
router.get('/orders-seller', requireAuth, pageController.getSellerOrders);
router.get('/revenue', requireAuth, pageController.getRevenue);
router.get('/wallet-payouts', requireAuth, pageController.getWalletPayouts);

module.exports = router;
