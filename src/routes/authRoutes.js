const express = require('express');
const router = express.Router();
const {
  register, login, getCurrentUser, getSellers, approveSeller, rejectSeller,
  forgotPassword, resetPassword, getAllCustomers, updateProfileImage, uploadProfileImage,
  createSellerByAdmin,
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// User routes (authenticated)
router.get('/me', protect, getCurrentUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/profile-image', protect, updateProfileImage);
router.put('/upload-profile-image', protect, uploadProfileImage);

// Admin only routes
router.get('/customers', protect, adminOnly, getAllCustomers);
router.get('/sellers', protect, adminOnly, getSellers);
router.put('/sellers/:id/approve', protect, adminOnly, approveSeller);
router.put('/sellers/:id/reject', protect, adminOnly, rejectSeller);
router.post('/sellers/create', protect, adminOnly, createSellerByAdmin);

module.exports = router;