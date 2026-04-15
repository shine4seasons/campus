// Admin configuration constants
const ADMIN_SECTIONS = ['analytics', 'users', 'products', 'orders', 'reports', 'settings'];

const SECTION_MAP = {
  analytics: 'aAnalytics',
  users: 'aUsers',
  products: 'aProducts',
  orders: 'aOrders',
  reports: 'aReports',
  settings: 'aSettings'
};

const ADMIN_ROLES = {
  ADMIN: 'admin'
};

module.exports = {
  ADMIN_SECTIONS,
  SECTION_MAP,
  ADMIN_ROLES
};