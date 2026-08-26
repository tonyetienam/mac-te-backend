const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes (authenticated)
router.get('/me', authenticate, authController.getCurrentUser);
router.put('/profile-image', authenticate, authController.updateProfileImage);
router.post('/profile-image', authenticate, authController.uploadProfileImage);

// Admin only routes
router.get('/customers', authenticate, authorize(['admin']), authController.getAllCustomers);
router.get('/sellers', authenticate, authorize(['admin']), authController.getSellers);
router.get('/users', authenticate, authorize(['admin']), authController.getAllUsers);
router.put('/sellers/:id/approve', authenticate, authorize(['admin']), authController.approveSeller);
router.put('/sellers/:id/reject', authenticate, authorize(['admin']), authController.rejectSeller);
router.post('/sellers', authenticate, authorize(['admin']), authController.createSellerByAdmin);

module.exports = router;