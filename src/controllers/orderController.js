const { db } = require('../config/database');

// Create a new order
const createOrder = async (req, res) => {
  try {
    const { items, total_amount, shipping_address, payment_method, payment_reference, subtotal, vat, delivery_fee, estimated_delivery_date } = req.body;
    const userId = req.user.id;

    if (!items || !total_amount) {
      return res.status(400).json({ status: 'error', message: 'Items and total amount are required' });
    }

    const id = 'o' + Date.now();
    db.prepare(`
      INSERT INTO orders (id, user_id, items, total_amount, status, shipping_address, payment_status, payment_reference, subtotal, vat, delivery_fee, estimated_delivery_date)
      VALUES (?, ?, ?, ?, 'processing', ?, 'pending', ?, ?, ?, ?, ?)
    `).run(id, userId, JSON.stringify(items), total_amount, JSON.stringify(shipping_address), payment_reference, subtotal, vat, delivery_fee, estimated_delivery_date || null);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
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
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);

    const parsedOrders = orders.map(order => ({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      shipping_address: typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address
    }));

    res.status(200).json({ status: 'success', data: parsedOrders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch orders' });
  }
};

// Admin: Confirm Order
const confirmOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare("UPDATE orders SET delivery_confirmed = 1, confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP, status = 'confirmed' WHERE id = ?").run(req.user.id, id);

    if (result.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.status(200).json({ status: 'success', data: order });
  } catch (error) {
    console.error('Error confirming order:', error);
    res.status(500).json({ status: 'error', message: 'Failed to confirm order' });
  }
};

// Admin: Get ALL orders
const getAllOrders = async (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    const parsedOrders = orders.map(order => ({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      shipping_address: typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address
    }));

    res.status(200).json({ status: 'success', data: parsedOrders });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch orders' });
  }
};

// Admin: Delete cancelled order
const deleteCancelledOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare("DELETE FROM orders WHERE id = ? AND status = 'cancelled'").run(id);

    if (result.changes === 0) {
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
    const result = db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'processing'").run(id, req.user.id);

    if (result.changes === 0) {
      return res.status(400).json({ status: 'error', message: 'Order cannot be cancelled' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.status(200).json({ status: 'success', data: order });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ status: 'error', message: 'Failed to cancel order' });
  }
};

// User: Track order by tracking number
const trackOrder = async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE payment_reference = ?').get(trackingNumber);

    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    const parsedOrder = {
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      shipping_address: typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address
    };

    res.status(200).json({ status: 'success', data: parsedOrder });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ status: 'error', message: 'Failed to track order' });
  }
};

module.exports = { createOrder, getUserOrders, confirmOrder, getAllOrders, deleteCancelledOrder, cancelOrder, trackOrder };