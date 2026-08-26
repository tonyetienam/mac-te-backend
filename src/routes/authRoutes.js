const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public routes (no authentication required)
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected route (requires authentication)
router.get('/me', authController.getCurrentUser);

module.exports = router;