// Constants for page routes and views
const APP_NAME = 'Campus Marketplace';
const TITLE_SEPARATOR = ' — ';

// View names
const VIEWS = {
  INDEX: 'index',
  LOGIN: 'login',
  CALLBACK: 'callback',
  PRODUCT: 'product',
  MY_PRODUCTS: 'my-products',
  SELL: 'sell',
  PROFILE: 'profile',
  ORDERS: 'orders',
  ORDERS_BUYER: 'orders-buyer',
  ORDER_TRACKING: 'order-tracking',
  MESSAGES: 'messages',
  DASHBOARD_ADMIN: 'dashboard-admin',
  DASHBOARD_SELLER: 'dashboard-seller',
  ORDERS_SELLER: 'orders-seller',
  REVENUE: 'revenue',
  NOT_FOUND: '404'
};

// Limits and configurations
const LIMITS = {
  RELATED_PRODUCTS: 4
};

// Error messages
const ERROR_MESSAGES = {
  PRODUCT_NOT_FOUND: 'Product not found',
  UNAUTHORIZED: 'Unauthorized access',
  SERVER_ERROR: 'Internal server error'
};

module.exports = {
  APP_NAME,
  TITLE_SEPARATOR,
  VIEWS,
  LIMITS,
  ERROR_MESSAGES
};