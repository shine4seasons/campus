// Admin configuration constants
const ADMIN_SECTIONS = ['analytics', 'users', 'products', 'orders', 'payouts', 'reports', 'settings'];

const SECTION_MAP = {
  analytics: 'aAnalytics',
  users: 'aUsers',
  products: 'aProducts',
  orders: 'aOrders',
  payouts: 'aPayouts',
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