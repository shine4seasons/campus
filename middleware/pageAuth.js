// Middleware used by server-rendered page routes to ensure a user is logged in
module.exports = function requirePageAuth(req, res, next) {
  if (!res.locals.user) {
    const back = encodeURIComponent(req.originalUrl || '/');
    const error = req.authError === 'banned' ? '&error=banned' : '';
    return res.redirect('/login?redirect=' + back + error);
  }
  next();
};
