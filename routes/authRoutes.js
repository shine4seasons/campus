const router = require('express').Router();
const passport = require('passport');
const { googleCallback, getMe, logout, refresh, updateProfile } = require('../controllers/auth');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { emptyBodySchema, authUpdateProfileSchema } = require('../validation/mutateSchemas');
const { AUTH_ROUTES, OAUTH_FAILURE_REDIRECT, PASSPORT_STRATEGIES } = require('../config/authConstants');
const { getAuthCookieOptions } = require('../utils/authSecurity');

// Step 1: Redirect to Google OAuth
router.get(AUTH_ROUTES.GOOGLE, passport.authenticate(PASSPORT_STRATEGIES.GOOGLE, { session: false }));

// Step 2: Google callback after user authorization
router.get(
  AUTH_ROUTES.GOOGLE_CALLBACK,
  passport.authenticate(PASSPORT_STRATEGIES.GOOGLE, {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}${OAUTH_FAILURE_REDIRECT}`
  }),
  googleCallback
);

// Get current user information
router.get(AUTH_ROUTES.ME, protect, getMe);

// Logout user
router.post(AUTH_ROUTES.LOGOUT, validate(emptyBodySchema), logout);

// Refresh authentication token
router.post(AUTH_ROUTES.REFRESH, validate(emptyBodySchema), refresh);

// Update user profile from onboarding
router.patch(AUTH_ROUTES.UPDATE_PROFILE, protect, validate(authUpdateProfileSchema), updateProfile);

// Development-only dev-login bypass for testing and visual auditing
if (process.env.NODE_ENV === 'development') {
  router.get('/dev-login', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).send('userId is required');

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (user?.banned) {
      return res.redirect('/login?error=banned');
    }

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    });

    res.cookie('token', token, getAuthCookieOptions());

    // Set campus_mode cookie to buyer/seller/admin based on role
    if (user) {
      const mode = user.role === 'admin' ? 'admin' : 'buyer';
      res.cookie('campus_mode', mode, { path: '/', maxAge: 30*24*60*60*1000 });
    }
    res.redirect('/');
  });
}

module.exports = router;
