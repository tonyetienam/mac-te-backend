const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { initPayment, verifyPaymentStatus } = require('../controllers/paymentController');

// Initialize a payment
router.post('/initialize', protect, initPayment);

// Verify a payment
router.get('/verify/:reference', protect, verifyPaymentStatus);

module.exports = router;