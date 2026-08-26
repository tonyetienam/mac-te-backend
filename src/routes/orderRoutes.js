const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { createOrder, getUserOrders, confirmOrder, getAllOrders, deleteCancelledOrder, cancelOrder, trackOrder } = require('../controllers/orderController');

// User routes
router.post('/', protect, createOrder);
router.get('/my-orders', protect, getUserOrders);
router.put('/:id/cancel', protect, cancelOrder);
router.get('/track/:trackingNumber', protect, trackOrder);

// Admin only routes
router.get('/all', protect, adminOnly, getAllOrders);
router.put('/:id/confirm', protect, adminOnly, confirmOrder);
router.delete('/:id/delete-cancelled', protect, adminOnly, deleteCancelledOrder);

module.exports = router;