// Authentication configuration constants
const AUTH_ROUTES = {
  GOOGLE: '/google',
  GOOGLE_CALLBACK: '/google/callback',
  ME: '/me',
  LOGOUT: '/logout',
  REFRESH: '/refresh',
  UPDATE_PROFILE: '/profile'
};

const OAUTH_FAILURE_REDIRECT = '/pages/login.html?error=oauth_failed';

const PASSPORT_STRATEGIES = {
  GOOGLE: 'google'
};

module.exports = {
  AUTH_ROUTES,
  OAUTH_FAILURE_REDIRECT,
  PASSPORT_STRATEGIES
};