require('dotenv').config();
const express      = require('express');
const path         = require('path');
const cookieParser = require('cookie-parser');

const connectDB    = require('./config/database');
const passport     = require('./config/passport');
const injectUser   = require('./middleware/locals');

const authRoutes    = require('./routes/authRoutes');
const productRoutes = require('./routes/products');
const uploadRoutes  = require('./routes/uploadRoutes');
const aiRoutes      = require('./routes/aiRoutes');
const pageRoutes    = require('./routes/pageRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const adminRoutes   = require('./routes/adminRoutes');

const app = express();

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());
app.use(injectUser);

app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload',   uploadRoutes);
app.use('/api/ai',       aiRoutes);
app.use('/api/chat',     require('./routes/chatRoutes'));
app.use('/',             pageRoutes);
app.use('/checkout',     checkoutRoutes);
app.use('/admin',        adminRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: '404 — Not Found' });
});

const PORT = process.env.PORT || 5000;
const http = require('http');
const server = http.createServer(app);

// Initialize socket server
try {
  const { init } = require('./utils/socketServer');
  init(server);
} catch (e) {
  console.error('Socket init error:', e.message);
}

server.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));