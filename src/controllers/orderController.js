const { pool } = require('../config/database');
const { sendOrderConfirmation, sendDeliveryNotification } = require('../services/emailService');

// Calculate estimated delivery date based on location
const calculateDeliveryDate = (state) => {
  const states = {
    'Lagos': 5, 'Abuja': 4, 'Ogun': 7, 'Rivers': 7, 'Kano': 8,
    'Enugu': 8, 'Anambra': 7, 'Delta': 7, 'Oyo': 7, 'Edo': 7
  };
  const days = states[state] || 5;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// Create a new order
const createOrder = async (req, res) => {
  try {
    const { items, total_amount, shipping_address, payment_method, payment_reference, subtotal, vat, delivery_fee } = req.body;
    const userId = req.user.id;

    const validatedItems = items.map(item => ({
      product_id: item.product_id || item.id,
      name: item.name || 'Unknown Product',
      price: parseFloat(item.price || 0),
      quantity: parseInt(item.quantity || 1),
      image: item.image || '',
    }));

    // Calculate estimated delivery date
    const estimatedDeliveryDate = calculateDeliveryDate(shipping_address?.state);

    // INSERT ORDER
    const result = await pool.query(
      `INSERT INTO orders (user_id, items, total_amount, shipping_address, payment_status, payment_reference, status, subtotal, vat, delivery_fee, estimated_delivery_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [userId, JSON.stringify(validatedItems), total_amount, JSON.stringify(shipping_address), 'pending', payment_reference, 'processing', subtotal, vat, delivery_fee, estimatedDeliveryDate]
    );

    const order = result.rows[0];
    order.items = validatedItems;

    // Get user details
    const userResult = await pool.query('SELECT first_name, last_name, email, phone FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    // Send confirmation email
    try {
      await sendOrderConfirmation(order, user);
    } catch (e) {
      console.error('Email error:', e);
    }

    res.status(201).json({ status: 'success', data: order });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create order' });
  }
};

// Get ALL orders for the logged-in user
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);

    const orders = result.rows.map(order => {
      let items = [];
      try {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      } catch (e) { console.error('Parse error:', e); }
      return { ...order, items: items.map(i => ({ ...i, image: i.image || '' })) };
    });

    res.status(200).json({ status: 'success', data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch orders' });
  }
};

// Admin: Confirm Order
const confirmOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const result = await pool.query(
      `UPDATE orders SET delivery_confirmed = true, confirmed_by = $1, confirmed_at = NOW(), status = 'confirmed' WHERE id = $2 RETURNING *`,
      [adminId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    const order = result.rows[0];

    // Send delivery notification email
    const userResult = await pool.query('SELECT first_name, last_name, email, phone FROM users WHERE id = $1', [order.user_id]);
    const user = userResult.rows[0];

    try {
      await sendDeliveryNotification(order, user);
    } catch (e) {
      console.error('Email error:', e);
    }

    res.status(200).json({ status: 'success', data: order });
  } catch (error) {
    console.error('Error confirming order:', error);
    res.status(500).json({ status: 'error', message: 'Failed to confirm order' });
  }
};

// Admin: Get ALL orders (including guests)
const getAllOrders = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    const orders = result.rows.map(order => {
      let items = [];
      try {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      } catch (e) { console.error('Parse error:', e); }
      return { ...order, items: items.map(i => ({ ...i, image: i.image || '' })) };
    });
    res.status(200).json({ status: 'success', data: orders });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch orders' });
  }
};

// Admin: Delete cancelled order
const deleteCancelledOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM orders WHERE id = $1 AND status = $2 RETURNING *', [id, 'cancelled']);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Order not found or not cancelled' });
    }

    res.status(200).json({ status: 'success', message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete order' });
  }
};

// Cancel order (user can cancel if status is 'processing')
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 AND user_id = $2 AND status = 'processing' 
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Order cannot be cancelled' });
    }

    res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ status: 'error', message: 'Failed to cancel order' });
  }
};

// User: Track order by tracking number
const trackOrder = async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    const result = await pool.query('SELECT * FROM orders WHERE payment_reference = $1', [trackingNumber]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    const order = result.rows[0];
    let items = [];
    try {
      items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    } catch (e) { console.error('Parse error:', e); }

    res.status(200).json({ status: 'success', data: { ...order, items: items.map(i => ({ ...i, image: i.image || '' })) } });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ status: 'error', message: 'Failed to track order' });
  }
};

module.exports = { createOrder, getUserOrders, confirmOrder, getAllOrders, deleteCancelledOrder, cancelOrder, trackOrder };