const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || 'mac-te-secret-2024',
    { expiresIn: '7d' }
  );
};

// Register user
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role = 'customer' } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        status: 'error',
        message: 'All fields are required',
      });
    }

    // Check if user exists
    const existing = await db.getAsync('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({
        status: 'error',
        message: 'User already exists',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const id = 'u' + Date.now();

    let userRole = 'customer';
    let isActive = 1;

    if (role === 'seller') {
      userRole = 'seller';
      isActive = 0;
    } else if (role === 'admin') {
      userRole = 'admin';
      isActive = 1;
    }

    await db.runAsync(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, email, hashedPassword, firstName, lastName, phone || '', userRole, isActive]);

    const user = await db.getAsync(
      'SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?',
      [id]
    );

    const token = generateToken(user.id, user.role);

    console.log(`✅ User registered: ${email} as ${userRole}`);

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

    const user = await db.getAsync('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

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
        message: 'Account is deactivated or pending approval',
      });
    }

    const token = generateToken(user.id, user.role);
    delete user.password_hash;

    console.log(`✅ Login successful: ${email} as ${user.role}`);

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
    const user = await db.getAsync(
      'SELECT id, email, first_name, last_name, phone, role, profile_image, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user',
    });
  }
};

// Get all sellers (admin only)
const getSellers = async (req, res) => {
  try {
    const sellers = await db.allAsync(`
      SELECT id, email, first_name, last_name, phone, is_active, created_at 
      FROM users WHERE role = 'seller' ORDER BY created_at DESC
    `);

    res.status(200).json({
      status: 'success',
      data: sellers,
    });
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch sellers',
    });
  }
};

// Get all customers (admin only)
const getAllCustomers = async (req, res) => {
  try {
    const customers = await db.allAsync(`
      SELECT id, email, first_name, last_name, phone, role, is_active, created_at 
      FROM users WHERE role = 'customer' ORDER BY created_at DESC
    `);

    res.status(200).json({
      status: 'success',
      data: customers,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch customers',
    });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await db.allAsync(`
      SELECT id, email, first_name, last_name, phone, role, is_active, created_at 
      FROM users ORDER BY created_at DESC
    `);

    res.status(200).json({
      status: 'success',
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users',
    });
  }
};

// Approve seller (admin only)
const approveSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.runAsync(
      'UPDATE users SET is_active = 1 WHERE id = ? AND role = ?',
      [id, 'seller']
    );

    if (result.changes === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found',
      });
    }

    const seller = await db.getAsync(
      'SELECT id, email, first_name, last_name, is_active FROM users WHERE id = ? AND role = ?',
      [id, 'seller']
    );

    console.log(`✅ Seller approved: ${seller.email}`);

    res.status(200).json({
      status: 'success',
      data: seller,
    });
  } catch (error) {
    console.error('Error approving seller:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to approve seller',
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  getSellers,
  getAllCustomers,
  getAllUsers,
  approveSeller,
};