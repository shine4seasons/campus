require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const passport     = require('./src/config/passport');   // import để register strategy
const connectDB    = require('./src/config/database');
const authRoutes   = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');  

connectDB();

const app = express();
app.use('/api/products', productRoutes);  
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin:      process.env.CLIENT_URL,
  credentials: true,        // ← bắt buộc để cookie cross-origin hoạt động
}));
app.use(cookieParser());     // ← đọc req.cookies
app.use(express.json({ limit: '10mb' }));
app.use(passport.initialize());   // không dùng session

// Routes
app.use('/api/auth', authRoutes);

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