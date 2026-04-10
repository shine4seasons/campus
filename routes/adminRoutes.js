const express = require('express');
const router = express.Router();
const requirePageAuth = require('../middleware/pageAuth');

// All admin pages require a logged-in user
router.use(requirePageAuth);

// Quick check middleware: only allow users with admin role
router.use((req, res, next) => {
  const u = res.locals.user;
  if (!u || u.role !== 'admin') {
    // for pages redirect to home or show 403 page
    return res.status(403).render('404', { title: 'Forbidden' });
  }
  next();
});

// Admin dashboard home
router.get('/', (req, res) => {
  res.render('dashboard-admin', { title: 'Admin Dashboard', initialSection: 'aDash' });
});

// Convenience routes that render the admin dashboard template but allow client-side nav to show the right section
// example: /admin/users -> dashboard with users section active
const adminSections = ['analytics','users','products','orders','reports','settings'];
adminSections.forEach(name => {
  router.get(`/${name}`, (req, res) => {
    // render same admin dashboard; client-side JS will pick up and show section
    const map = { analytics: 'aAnalytics', users: 'aUsers', products: 'aProducts', orders: 'aOrders', reports: 'aReports', settings: 'aSettings' };
    res.render('dashboard-admin', { title: 'Admin Dashboard - ' + name, initialSection: map[name] || 'aDash' });
  });
});

module.exports = router;
