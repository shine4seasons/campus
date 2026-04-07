// Middleware used by server-rendered page routes to ensure a user is logged in
module.exports = function requirePageAuth(req, res, next) {
  if (!res.locals.user) {
    const back = encodeURIComponent(req.originalUrl || '/');
    return res.redirect('/login?redirect=' + back);
  }
  next();
};
