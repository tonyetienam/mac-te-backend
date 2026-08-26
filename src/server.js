require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { pool, connectDB } = require('./config/database');
const { initDB } = require('./config/initDB');

// Route imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chat', chatRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Mac-TE Smart Shopping API is running',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    status: 'error',
    message: err.message || 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 8080;
connectDB().then(async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log('🚀 Server running on port ' + PORT);
    console.log('📊 Environment: ' + (process.env.NODE_ENV || 'development'));
  });
});