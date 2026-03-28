const router   = require('express').Router();
const passport = require('passport');
const { googleCallback, getMe, logout, refresh } =
  require('../controllers/authController');
const { protect } = require('../middleware/auth');

// ① Bước 1: redirect sang Google
router.get(
  '/google',
  passport.authenticate('google', { session: false })
);

// ② Bước 2: Google redirect về đây sau khi user đồng ý
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session:        false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed`,
  }),
  googleCallback
);

// ③ Lấy thông tin user đang đăng nhập
router.get('/me', protect, getMe);

// ④ Đăng xuất
router.post('/logout', logout);

// ⑤ Refresh token (silent renewal)
router.post('/refresh', refresh);

module.exports = router;