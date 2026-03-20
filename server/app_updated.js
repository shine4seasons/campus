// Thêm vào server/src/app.js (sau dòng authRoutes đã có)

const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);

// ── app.js đầy đủ sau khi thêm product routes ───────────
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const passport     = require('./config/passport');
const connectDB    = require('./config/database');
const authRoutes    = require('./routes/auth');
const productRoutes = require('./routes/products');   // ← THÊM

connectDB();

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin:      process.env.CLIENT_URL,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(passport.initialize());

// Routes
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);   // ← THÊM

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Server error' : err.message,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
