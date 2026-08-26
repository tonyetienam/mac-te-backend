const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { db } = require('../config/database');

// Send message to AI (auto-response first)
router.post('/message', protect, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ status: 'error', message: 'Message is required' });
    }

    const aiResponse = getAIResponse(message);
    const needsAgent = shouldTransferToAgent(message);
    const id = 'chat' + Date.now();

    db.prepare(`
      INSERT INTO chat_logs (id, user_id, message, response, intent)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, message, aiResponse, needsAgent ? 'admin_transfer' : 'ai_response');

    res.status(201).json({
      status: 'success',
      data: { id, message, response: aiResponse, intent: needsAgent ? 'admin_transfer' : 'ai_response' },
      aiResponse,
      needsAgent
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send message' });
  }
});

// Get ALL chat messages for the logged-in customer (including admin replies)
router.get('/my-full-chat', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const messages = db.prepare('SELECT * FROM chat_logs WHERE user_id = ? ORDER BY created_at ASC').all(userId);
    res.status(200).json({ status: 'success', data: messages });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch chat history' });
  }
});

// Get all messages (admin)
router.get('/messages', protect, adminOnly, async (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT cl.*, u.first_name, u.last_name, u.email, u.phone
      FROM chat_logs cl 
      JOIN users u ON cl.user_id = u.id 
      ORDER BY cl.created_at DESC
    `).all();
    res.status(200).json({ status: 'success', data: messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch messages' });
  }
});

// Admin reply to customer
router.post('/reply', protect, adminOnly, async (req, res) => {
  try {
    const { userId, response } = req.body;
    const id = 'reply' + Date.now();

    db.prepare(`
      INSERT INTO chat_logs (id, user_id, message, response, intent)
      VALUES (?, ?, 'Admin reply', ?, 'admin_reply')
    `).run(id, userId, response);

    res.status(201).json({ status: 'success', data: { id, userId, response } });
  } catch (error) {
    console.error('Error sending reply:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send reply' });
  }
});

// Helper functions
const getAIResponse = (message) => {
  const lower = message.toLowerCase().trim();
  
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return "Hello! 👋 Welcome to Mac-TE Smart Shopping. How can I help you today?";
  }
  if (lower.includes('delivery') || lower.includes('shipping')) {
    return "Delivery takes 3-5 business days depending on location.";
  }
  if (lower.includes('payment') || lower.includes('pay')) {
    return "We accept Card (Paystack), Bank Transfer, and Cash on Delivery.";
  }
  if (lower.includes('price') || lower.includes('cost')) {
    return "Our prices vary by product. Check the product page for details!";
  }
  if (lower.includes('return') || lower.includes('refund')) {
    return "We have a 7-day return policy. You can return items within 7 days.";
  }
  if (lower.includes('track') || lower.includes('order status')) {
    return "You can track your order in the Orders section of your account.";
  }
  return "Thank you for your message! How else can I assist you?";
};

const shouldTransferToAgent = (message) => {
  const lower = message.toLowerCase();
  const keywords = ['agent', 'human', 'complaint', 'problem', 'issue', 'speak to someone'];
  return keywords.some(keyword => lower.includes(keyword));
};

module.exports = router;