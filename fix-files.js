const fs = require('fs');
const path = require('path');

// Ensure directories exist
const dirs = [
    'src/controllers',
    'src/middleware', 
    'src/routes',
    'src/config',
    'src/services',
    'src/models'
];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// ============================================
// 1. CREATE database.js
// ============================================
const dbContent = `const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const connectDB = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { pool, connectDB };`;

fs.writeFileSync('src/config/database.js', dbContent);
console.log('✅ database.js created');

// ============================================
// 2. CREATE authMiddleware.js
// ============================================
const authMiddlewareContent = `const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, no token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, user not found',
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      status: 'error',
      message: 'Not authorized, invalid token',
    });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied, admin only',
    });
  }
};

module.exports = { protect, adminOnly };`;

fs.writeFileSync('src/middleware/authMiddleware.js', authMiddlewareContent);
console.log('✅ authMiddleware.js created');

// ============================================
// 3. CREATE authController.js
// ============================================
const authControllerContent = `const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register new user
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        status: 'error',
        message: 'All fields are required',
      });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'User already exists',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      \`INSERT INTO users (email, password_hash, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, phone, role, created_at\`,
      [email, hashedPassword, firstName, lastName, phone]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.role);

    res.status(201).json({
      status: 'success',
      data: { user, token },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed',
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required',
      });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'Account is deactivated',
      });
    }

    const token = generateToken(user.id, user.role);
    delete user.password_hash;

    res.status(200).json({
      status: 'success',
      data: { user, token },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Login failed',
    });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      \`SELECT id, email, first_name, last_name, phone, role, created_at 
       FROM users WHERE id = $1\`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user',
    });
  }
};

module.exports = { register, login, getCurrentUser };`;

fs.writeFileSync('src/controllers/authController.js', authControllerContent);
console.log('✅ authController.js created');

// ============================================
// 4. CREATE productController.js
// ============================================
const productControllerContent = `const { pool } = require('../config/database');

// Get all products with filtering and pagination
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM products WHERE is_active = true';
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += \` AND category = \${paramIndex}\`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      query += \` AND (name ILIKE \${paramIndex} OR description ILIKE \${paramIndex})\`;
      params.push(\`%\${search}%\`);
      paramIndex++;
    }

    if (minPrice) {
      query += \` AND price_ngn >= \${paramIndex}\`;
      params.push(parseFloat(minPrice));
      paramIndex++;
    }

    if (maxPrice) {
      query += \` AND price_ngn <= \${paramIndex}\`;
      params.push(parseFloat(maxPrice));
      paramIndex++;
    }

    const allowedSortFields = ['name', 'price_ngn', 'created_at', 'rating'];
    const safeSortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += \` ORDER BY \${safeSortField} \${safeSortOrder} LIMIT \${paramIndex} OFFSET \${paramIndex + 1}\`;
    params.push(parseInt(limit), offset);

    let countQuery = 'SELECT COUNT(*) FROM products WHERE is_active = true';
    const countParams = [];
    let countIndex = 1;

    if (category) {
      countQuery += \` AND category = \${countIndex}\`;
      countParams.push(category);
      countIndex++;
    }

    if (search) {
      countQuery += \` AND (name ILIKE \${countIndex} OR description ILIKE \${countIndex})\`;
      countParams.push(\`%\${search}%\`);
      countIndex++;
    }

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0].count);

    res.status(200).json({
      status: 'success',
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch products',
    });
  }
};

// Get single product
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      \`SELECT p.*, u.first_name, u.last_name as seller_name 
       FROM products p 
       LEFT JOIN users u ON p.seller_id = u.id 
       WHERE p.id = $1 AND p.is_active = true\`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch product',
    });
  }
};

// Create new product (admin only)
const createProduct = async (req, res) => {
  try {
    const {
      name, description, category, price_ngn, price_usd,
      stock_quantity, main_image, images, seller_id,
      location, delivery_days, specifications,
    } = req.body;

    if (!name || !price_ngn) {
      return res.status(400).json({
        status: 'error',
        message: 'Name and price are required',
      });
    }

    const result = await pool.query(
      \`INSERT INTO products (name, description, category, price_ngn, price_usd, stock_quantity, main_image, images, seller_id, location, delivery_days, specifications)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *\`,
      [name, description, category, price_ngn, price_usd, stock_quantity, main_image, images, seller_id, location, delivery_days, specifications]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create product',
    });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'name', 'description', 'category', 'price_ngn', 'price_usd',
      'stock_quantity', 'main_image', 'images', 'is_active', 'location', 'delivery_days'
    ];

    const updateFields = Object.keys(updates).filter(
      (key) => allowedFields.includes(key) && updates[key] !== undefined
    );

    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid fields to update',
      });
    }

    const setClause = updateFields.map((field, index) => \`\${field} = \${index + 1}\`).join(', ');
    const values = updateFields.map((field) => updates[field]);
    values.push(id);

    const result = await pool.query(
      \`UPDATE products SET \${setClause}, updated_at = NOW() WHERE id = \${updateFields.length + 1} RETURNING *\`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update product',
    });
  }
};

// Delete product (soft delete)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete product',
    });
  }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct };`;

fs.writeFileSync('src/controllers/productController.js', productControllerContent);
console.log('✅ productController.js created');

// ============================================
// 5. CREATE authRoutes.js
// ============================================
const authRoutesContent = `const express = require('express');
const router = express.Router();
const { register, login, getCurrentUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getCurrentUser);

module.exports = router;`;

fs.writeFileSync('src/routes/authRoutes.js', authRoutesContent);
console.log('✅ authRoutes.js created');

// ============================================
// 6. CREATE productRoutes.js
// ============================================
const productRoutesContent = `const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', protect, adminOnly, createProduct);
router.put('/:id', protect, adminOnly, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);

module.exports = router;`;

fs.writeFileSync('src/routes/productRoutes.js', productRoutesContent);
console.log('✅ productRoutes.js created');

// ============================================
// 7. CREATE server.js
// ============================================
const serverContent = `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/database');

// Route imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Mac-TE Engineering API is running',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    status: 'error',
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log('🚀 Server running on port ' + PORT);
    console.log('📊 Environment: ' + (process.env.NODE_ENV || 'development'));
  });
});`;

fs.writeFileSync('src/server.js', serverContent);
console.log('✅ server.js created');

// ============================================
// FINAL MESSAGE
// ============================================
console.log('🎉🎉🎉 ALL FILES CREATED SUCCESSFULLY!');
console.log('Now run: npm run dev');