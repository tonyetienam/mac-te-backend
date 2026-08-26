const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/me', authenticate, authController.getCurrentUser);

// Admin only routes
router.get('/customers', authenticate, authorize(['admin']), authController.getAllCustomers);
router.get('/sellers', authenticate, authorize(['admin']), authController.getSellers);
router.get('/users', authenticate, authorize(['admin']), authController.getAllUsers);
router.put('/sellers/:id/approve', authenticate, authorize(['admin']), authController.approveSeller);

module.exports = router;