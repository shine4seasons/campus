const router   = require('express').Router();
const passport = require('passport');
const { googleCallback, getMe, logout, refresh, updateProfile } =
  require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Bước 1: redirect sang Google
router.get('/google', passport.authenticate('google', { session: false }));

// Bước 2: Google gọi về sau khi user đồng ý
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session:        false,
    failureRedirect: `${process.env.CLIENT_URL}/pages/login.html?error=oauth_failed`,
  }),
  googleCallback
);

// Lấy user hiện tại
router.get('/me', protect, getMe);

// Đăng xuất
router.post('/logout', logout);

// Refresh token
router.post('/refresh', refresh);

// Cập nhật profile từ onboarding step 2
// PATCH — chỉ cho phép update các field an toàn, không đổi được role
router.patch('/profile', protect, updateProfile);

module.exports = router;
