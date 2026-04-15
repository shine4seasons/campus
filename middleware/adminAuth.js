const { ADMIN_ROLES } = require('../config/adminConstants');

/**
 * Middleware to check if user has admin role
 * Redirects to 403 page if not authorized
 */
const requireAdmin = (req, res, next) => {
  const user = res.locals.user;

  if (!user || user.role !== ADMIN_ROLES.ADMIN) {
    return res.status(403).render('404', {
      title: 'Forbidden',
      isLoginPage: false
    });
  }

  next();
};

module.exports = requireAdmin;