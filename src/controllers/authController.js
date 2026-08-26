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

// REGISTER
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;
    const userRole = role || 'customer';

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        status: 'error',
        message: 'All fields are required'
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
        message: 'User already exists'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const id = 'u' + Date.now();

    let isActive = 1;
    let finalRole = 'customer';
    if (userRole === 'seller') {
      finalRole = 'seller';
      isActive = 0;
    } else if (userRole === 'admin') {
      finalRole = 'admin';
      isActive = 1;
    }

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, email, hashedPassword, firstName, lastName, phone || '', finalRole, isActive],
        function(err) {
          if (err) reject(err);
          else resolve(this);
        }
      );
    });

    const user = await new Promise((resolve, reject) => {
      db.get('SELECT id, email, first_name, last_name, phone, role, is_active, created_at FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const token = generateToken(user.id, user.role);

    res.status(201).json({
      status: 'success',
      data: { user, token }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed'
    });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required'
      });
    }

    console.log('🔐 Login attempt:', email);

    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          console.log('✅ Raw user from DB:', JSON.stringify(row));
          resolve(row);
        }
      });
    });

    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    console.log('✅ User found:', user.email);

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      console.log('❌ Invalid password');
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'Account is deactivated'
      });
    }

    const token = generateToken(user.id, user.role);

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

    console.log('📤 Returning user data:', JSON.stringify(userData));

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
      message: 'Login failed: ' + error.message
    });
  }
};

// GET CURRENT USER - Added this function
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
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user'
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser
};