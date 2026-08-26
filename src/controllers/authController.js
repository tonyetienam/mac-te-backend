const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { db } = require('../config/database');

const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register new user (supports user, seller, admin)
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role = 'customer' } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        status: 'error',
        message: 'All fields are required',
      });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'User already exists',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const id = 'u' + Date.now();
    
    // Support admin role
    let userRole = 'customer';
    let isApproved = 1;
    
    if (role === 'seller') {
      userRole = 'seller';
      isApproved = 0; // Needs admin approval
    } else if (role === 'admin') {
      userRole = 'admin';
      isApproved = 1; // Auto-approved
    } else {
      userRole = 'customer';
      isApproved = 1;
    }

    db.prepare(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, email, hashedPassword, firstName, lastName, phone, userRole, isApproved);

    const user = db.prepare('SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?').get(id);
    const token = generateToken(user.id, user.role);

    // Send welcome email (skip if fails)
    try {
      await sendWelcomeEmail(user);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

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

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
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
    const user = db.prepare('SELECT id, email, first_name, last_name, phone, role, profile_image, created_at FROM users WHERE id = ?').get(req.user.id);
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
    const sellers = db.prepare("SELECT id, email, first_name, last_name, phone, is_active, created_at FROM users WHERE role = 'seller' ORDER BY created_at DESC").all();
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
    const customers = db.prepare("SELECT id, email, first_name, last_name, phone, role, is_active, created_at FROM users WHERE role = 'customer' ORDER BY created_at DESC").all();
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
    const users = db.prepare("SELECT id, email, first_name, last_name, phone, role, is_active, created_at FROM users ORDER BY created_at DESC").all();
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
    const result = db.prepare("UPDATE users SET is_active = 1 WHERE id = ? AND role = 'seller'").run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found',
      });
    }

    const seller = db.prepare("SELECT id, email, first_name, last_name, is_active FROM users WHERE id = ? AND role = 'seller'").get(id);
    
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

// Reject/Disapprove seller (admin only)
const rejectSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare("UPDATE users SET is_active = 0 WHERE id = ? AND role = 'seller'").run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Seller not found',
      });
    }

    const seller = db.prepare("SELECT id, email, first_name, last_name, is_active FROM users WHERE id = ? AND role = 'seller'").get(id);
    
    console.log(`❌ Seller rejected: ${seller.email}`);
    
    res.status(200).json({
      status: 'success',
      data: seller,
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

    const user = db.prepare('SELECT id, email, phone FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Email not found',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare('INSERT INTO password_resets (id, user_id, otp, expires_at) VALUES (?, ?, ?, ?)').run('pr' + Date.now(), user.id, otp, expiresAt);

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
      subject: 'Password Reset OTP - Mac-TE Engineering',
      html: `<p>Your OTP for password reset is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);

    console.log(`📧 OTP sent to email: ${email}`);

    res.status(200).json({
      status: 'success',
      message: 'OTP sent to email',
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

    const reset = db.prepare('SELECT * FROM password_resets WHERE otp = ? AND expires_at > ?').get(otp, new Date().toISOString());
    if (!reset) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired OTP',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPassword, reset.user_id);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(reset.user_id);

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

// Update profile image
const updateProfileImage = async (req, res) => {
  try {
    const { profile_image } = req.body;
    const userId = req.user.id;

    db.prepare('UPDATE users SET profile_image = ? WHERE id = ?').run(profile_image, userId);
    const user = db.prepare('SELECT id, profile_image FROM users WHERE id = ?').get(userId);

    res.status(200).json({ status: 'success', data: user });
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

    db.prepare('UPDATE users SET profile_image = ? WHERE id = ?').run(profile_image, userId);
    const user = db.prepare('SELECT id, profile_image FROM users WHERE id = ?').get(userId);

    res.status(200).json({ status: 'success', data: user });
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

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'User already exists',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const id = 'u' + Date.now();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 'seller', 1)
    `).run(id, email, hashedPassword, firstName, lastName, phone);

    const user = db.prepare('SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?').get(id);

    res.status(201).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    console.error('Error creating seller:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create seller',
    });
  }
};

// Helper function
const sendWelcomeEmail = async (user) => {
  console.log(`📧 Welcome email sent to: ${user.email}`);
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
  getAllUsers,
  updateProfileImage,
  uploadProfileImage,
  createSellerByAdmin,
};