const { initializePayment, verifyPayment } = require('../services/paystackService');
const { pool } = require('../config/database');

// Initialize payment
const initPayment = async (req, res) => {
  try {
    const { email, amount, reference, metadata } = req.body;

    if (!email || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and amount are required',
      });
    }

    const result = await initializePayment({ email, amount, reference, metadata });

    res.status(200).json({
      status: 'success',
      data: result.data,
    });
  } catch (error) {
    console.error('Error initializing payment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initialize payment',
    });
  }
};

// Verify payment
const verifyPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;

    const result = await verifyPayment(reference);

    if (result.data.status === 'success') {
      // Update order status if payment is successful
      await pool.query(
        `UPDATE orders SET payment_status = 'paid', status = 'processing' WHERE payment_reference = $1`,
        [reference]
      );
    }

    res.status(200).json({
      status: 'success',
      data: result.data,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify payment',
    });
  }
};

module.exports = { initPayment, verifyPaymentStatus };