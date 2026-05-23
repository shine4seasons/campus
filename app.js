require('dotenv').config();
const { validateEnv } = require('./config/env');
validateEnv();

const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/database');
const passport = require('./config/passport');
const injectUser = require('./middleware/locals');
const { issueCsrfCookie, csrfGuard } = require('./middleware/csrf');
const { applySecurityHeaders, monitorAuthzFailures, limitAuth } = require('./middleware/security');
const { renderNotFound, renderServerError } = require('./utils/pageResponses');
const { mapError } = require('./utils/errors');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/products');
const uploadRoutes = require('./routes/uploadRoutes');
const aiRoutes = require('./routes/aiRoutes');
const pageRoutes = require('./routes/pageRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminApiRoutes = require('./routes/adminApi');
const orderApiRoutes = require('./routes/orderApiRoutes');
const reportRoutes = require('./routes/reportRoutes');
const ratingRoutes = require('./routes/ratingRoutes');

const app = express();

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(applySecurityHeaders);
app.use(issueCsrfCookie);
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());
app.use(injectUser);
app.use(monitorAuthzFailures);
app.use((req, res, next) => {
  const originalRender = res.render.bind(res);

  res.render = (view, locals = {}, callback) => {
    let renderLocals = locals;
    let renderCallback = callback;

    if (typeof renderLocals === 'function') {
      renderCallback = renderLocals;
      renderLocals = {};
    }

    if (view === '404' && res.statusCode >= 500) {
      return originalRender('error', {
        ...renderLocals,
        title: 'Error - Campus Marketplace',
        message: 'An unexpected error occurred. Please try again.',
        isLoginPage: false,
      }, renderCallback);
    }

    if (view === '404' && res.statusCode === 403) {
      return originalRender('error', {
        ...renderLocals,
        title: 'Forbidden - Campus Marketplace',
        message: 'You do not have permission to access this page.',
        isLoginPage: false,
      }, renderCallback);
    }

    return originalRender(view, renderLocals, renderCallback);
  };

  return next();
});

app.use([
  '/api/auth',
  '/api/orders',
  '/api/products',
  '/api/ratings',
  '/api/chat',
  '/api/payments',
  '/api/wallet',
  '/api/admin',
  '/api/report',
  '/api/notifications',
  '/api/upload',
  '/api/ai'
], csrfGuard);
app.use('/api/auth', limitAuth);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/orders', orderApiRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/', pageRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/admin', adminRoutes);
app.use('/api/admin', adminApiRoutes);

app.use((req, res) => renderNotFound(res));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const { status, message, code, details } = mapError(err);
  if (status >= 500) {
    console.error('[app] unhandled error:', err);
  }

  if (req.path.startsWith('/api/')) {
    const payload = {
      success: false,
      message,
      code,
    };
    if (status < 500 && details) {
      payload.details = details;
    }
    return res.status(status).json(payload);
  }

  if (status >= 500) return renderServerError(res);
  return renderNotFound(res);
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

try {
  const { init } = require('./utils/socketServer');
  init(server);
} catch (error) {
  console.error('Socket init error:', error.message);
}

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
