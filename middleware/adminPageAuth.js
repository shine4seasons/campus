const { ADMIN_ROLES } = require('../config/adminConstants');

/**
 * Middleware to protect admin-only pages
 * Redirects admin dashboard access to non-admins
 * Used specifically for page routes that show admin-specific content
 */
const requireAdminPage = (req, res, next) => {
  const user = res.locals.user;

  if (!user) {
    const back = encodeURIComponent(req.originalUrl || '/');
    return res.redirect('/login?redirect=' + back);
  }

  // Only admin can proceed
  if (user.role !== ADMIN_ROLES.ADMIN) {
    // Redirect non-admins to seller dashboard
    return res.redirect('/dashboard-seller');
  }

  next();
};

module.exports = requireAdminPage;
