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

    const existing = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

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

    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, email, hashedPassword, firstName, lastName, phone || '', userRole, isActive], function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });

    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, first_name, last_name, phone, role, is_active, created_at FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const token = generateToken(user.id, user.role);

    console.log(`✅ User registered: ${email} as ${userRole}`);

    res.status(201).json({
      status: 'success',
      data: {
        user: user,
        token: token
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed: ' + error.message,
    });
  }
};

// ⭐⭐⭐ LOGIN - COMPLETELY FIXED ⭐⭐⭐
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required',
      });
    }

    console.log('🔐 Login attempt:', email);

    // Get user from database
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          console.error('❌ Database error:', err);
          reject(err);
        } else {
          console.log('📦 Raw user from DB:', JSON.stringify(row, null, 2));
          resolve(row);
        }
      });
    });

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    console.log('✅ User found in DB:', user.email);

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    // Check if account is active
    if (!user.is_active) {
      console.log('❌ Account inactive:', email);
      return res.status(403).json({
        status: 'error',
        message: 'Account is deactivated or pending approval',
      });
    }

    // Generate token
    const token = generateToken(user.id, user.role);

    // ⭐ CRITICAL: Create userData with ALL fields
    const userData = {
      id: user.id,
      email: user.email,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      role: user.role || 'customer',
      is_active: user.is_active || 1,
      created_at: user.created_at || new Date().toISOString()
    };

    console.log('✅ Login successful:', email);
    console.log('📦 User data being returned:', JSON.stringify(userData, null, 2));

    // ⭐ CRITICAL: Send back userData INSIDE data.user
    res.status(200).json({
      status: 'success',
      data: {
        user: userData,
        token: token
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Login failed: ' + error.message,
    });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, first_name, last_name, phone, role, is_active, created_at FROM users WHERE id = ?',
        [req.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: user
    });

  } catch (error) {
    console.error('❌ Get current user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user',
    });
  }
};

// Get all sellers (admin only)
const getSellers = async (req, res) => {
  try {
    const sellers = await new Promise((resolve, reject) => {
      db.all(`
        SELECT id, email, first_name, last_name, phone, is_active, created_at 
        FROM users WHERE role = 'seller' ORDER BY created_at DESC
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.status(200).json({
      status: 'success',
      data: sellers,
    });

  } catch (error) {
    console.error('❌ Error fetching sellers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch sellers',
    });
  }
};

// Get all customers (admin only)
const getAllCustomers = async (req, res) => {
  try {
    const customers = await new Promise((resolve, reject) => {
      db.all(`
        SELECT id, email, first_name, last_name, phone, role, is_active, created_at 
        FROM users WHERE role = 'customer' ORDER BY created_at DESC
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.status(200).json({
      status: 'success',
      data: customers,
    });

  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch customers',
    });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await new Promise((resolve, reject) => {
      db.all(`
        SELECT id, email, first_name, last_name, phone, role, is_active, created_at 
        FROM users ORDER BY created_at DESC
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.status(200).json({
      status: 'success',
      data: users,
    });

  } catch (error) {
    console.error('❌ Error fetching users:', error);
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
    const result = await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET is_active = 1 WHERE id = ? AND role = ?',
        [id, 'seller'],
        function(err) {
          if (err) reject(err);
          else resolve(this);
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found',
      });
    }

    const seller = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, first_name, last_name, is_active FROM users WHERE id = ? AND role = ?',
        [id, 'seller'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    console.log(`✅ Seller approved: ${seller.email}`);

    res.status(200).json({
      status: 'success',
      data: seller,
    });

  } catch (error) {
    console.error('❌ Error approving seller:', error);
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