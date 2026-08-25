const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { pool } = require('../config/database');
const { notifyAdminOfNewSeller, sendWelcomeEmail } = require('../services/emailService');

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
    const { email, password, firstName, lastName, phone, role } = req.body;

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

    let userRole = 'customer';
    let isApproved = true;

    if (role === 'seller') {
      userRole = 'seller';
      isApproved = false;
    }

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, first_name, last_name, phone, role, is_approved, created_at`,
      [email, hashedPassword, firstName, lastName, phone, userRole, isApproved]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.role);

    // Send welcome email
    try {
      await sendWelcomeEmail(user);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    if (userRole === 'seller') {
      try {
        await notifyAdminOfNewSeller(user);
      } catch (notifyError) {
        console.error('Failed to notify admin:', notifyError);
      }
    }

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
      `SELECT id, email, first_name, last_name, phone, role, is_approved, profile_image, created_at 
       FROM users WHERE id = $1`,
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

// Get all sellers (admin only)
const getSellers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, phone, is_approved, created_at 
       FROM users WHERE role = 'seller' ORDER BY created_at DESC`
    );

    res.status(200).json({
      status: 'success',
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch sellers',
    });
  }
};

// Approve seller (admin only)
const approveSeller = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE users SET is_approved = true WHERE id = $1 AND role = $2 RETURNING id, email, first_name, last_name, is_approved',
      [id, 'seller']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error approving seller:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to approve seller',
    });
  }
};

// Reject/Disapprove seller (admin only)
const rejectSeller = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE users SET is_approved = false WHERE id = $1 AND role = $2 RETURNING id, email, first_name, last_name, is_approved',
      [id, 'seller']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error rejecting seller:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reject seller',
    });
  }
};

// Forgot Password - Send OTP to email
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required',
      });
    }

    const result = await pool.query(
      'SELECT id, email, phone FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Email not found',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO password_resets (user_id, otp, expires_at)
       VALUES ($1, $2, $3)`,
      [result.rows[0].id, otp, expiryTime]
    );

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset OTP - Mac-TE Smart Shopping',
      html: `<p>Your OTP for password reset is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);

    console.log(`📧 OTP sent to email: ${email}`);
    console.log(`📱 OTP sent to phone: ${result.rows[0].phone}`);

    res.status(200).json({
      status: 'success',
      message: 'OTP sent to email and phone',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send OTP',
    });
  }
};

// Reset Password - Verify OTP and update password
const resetPassword = async (req, res) => {
  try {
    const { otp, newPassword } = req.body;

    if (!otp || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'OTP and new password are required',
      });
    }

    const result = await pool.query(
      `SELECT pr.user_id, pr.otp, pr.expires_at, u.email
       FROM password_resets pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.otp = $1 AND pr.expires_at > NOW()
       ORDER BY pr.created_at DESC
       LIMIT 1`,
      [otp]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired OTP',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, result.rows[0].user_id]
    );

    await pool.query(
      'DELETE FROM password_resets WHERE user_id = $1',
      [result.rows[0].user_id]
    );

    res.status(200).json({
      status: 'success',
      message: 'Password reset successful',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset password',
    });
  }
};

// Admin: Get all registered customers
const getAllCustomers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, phone, role, is_approved, created_at FROM users ORDER BY created_at DESC'
    );
    res.status(200).json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch customers' });
  }
};

// Update profile image
const updateProfileImage = async (req, res) => {
  try {
    const { profile_image } = req.body;
    const userId = req.user.id;

    const result = await pool.query(
      'UPDATE users SET profile_image = $1 WHERE id = $2 RETURNING id, profile_image',
      [profile_image, userId]
    );

    res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    console.error('Error updating profile image:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update profile image' });
  }
};

// Upload profile image
const uploadProfileImage = async (req, res) => {
  try {
    const { profile_image } = req.body;
    const userId = req.user.id;

    const result = await pool.query(
      'UPDATE users SET profile_image = $1 WHERE id = $2 RETURNING id, profile_image',
      [profile_image, userId]
    );

    res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ status: 'error', message: 'Failed to upload profile image' });
  }
};

// Admin: Create a new seller
const createSellerByAdmin = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        status: 'error',
        message: 'All fields are required',
      });
    }

    // Check if user already exists
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

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create seller (auto-approved)
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_approved)
       VALUES ($1, $2, $3, $4, $5, 'seller', true)
       RETURNING id, email, first_name, last_name, phone, role, is_approved, created_at`,
      [email, hashedPassword, firstName, lastName, phone]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating seller:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create seller',
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  getSellers,
  approveSeller,
  rejectSeller,
  forgotPassword,
  resetPassword,
  getAllCustomers,
  updateProfileImage,
  uploadProfileImage,
  createSellerByAdmin,
};