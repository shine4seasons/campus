const router = require('express').Router();
const passport = require('passport');
const { googleCallback, getMe, logout, refresh, updateProfile } = require('../controllers/auth');
const { protect } = require('../middleware/auth');
const { AUTH_ROUTES, OAUTH_FAILURE_REDIRECT, PASSPORT_STRATEGIES } = require('../config/authConstants');

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
router.post(AUTH_ROUTES.LOGOUT, logout);

// Refresh authentication token
router.post(AUTH_ROUTES.REFRESH, refresh);

// Update user profile from onboarding
router.patch(AUTH_ROUTES.UPDATE_PROFILE, protect, updateProfile);

module.exports = router;
router.patch('/profile', protect, updateProfile);

module.exports = router;
