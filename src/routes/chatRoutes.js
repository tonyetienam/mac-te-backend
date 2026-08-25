const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { pool } = require('../config/database');
const { getAIResponse, shouldTransferToAgent } = require('../services/aiChatService');

// Send message to AI (auto-response first)
router.post('/message', protect, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ status: 'error', message: 'Message is required' });
    }

    // Get AI response (rule-based - guaranteed to work)
    const aiResponse = await getAIResponse(message);
    const needsAgent = shouldTransferToAgent(message);

    // Save message and AI response to database
    const result = await pool.query(
      `INSERT INTO chat_logs (user_id, message, response, intent)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, message, aiResponse, needsAgent ? 'admin_transfer' : 'ai_response']
    );

    // Return the response to the frontend
    res.status(201).json({
      status: 'success',
      data: result.rows[0],
      aiResponse: aiResponse,
      needsAgent: needsAgent
    });
  } catch (error) {
    console.error('Error sending message:', error);
    // Fallback response even if database fails
    const fallbackAI = await getAIResponse(message || '');
    res.status(200).json({
      status: 'success',
      data: null,
      aiResponse: fallbackAI,
      needsAgent: shouldTransferToAgent(message || '')
    });
  }
});

// Get ALL chat messages for the logged-in customer (including admin replies)
router.get('/my-full-chat', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all messages between this user and admin
    const result = await pool.query(
      `SELECT * FROM chat_logs 
       WHERE user_id = $1 
       ORDER BY created_at ASC`,
      [userId]
    );

    res.status(200).json({ 
      status: 'success', 
      data: result.rows 
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch chat history' 
    });
  }
});

// Get all messages (admin)
router.get('/messages', protect, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cl.*, u.first_name, u.last_name, u.email, u.phone
       FROM chat_logs cl 
       JOIN users u ON cl.user_id = u.id 
       ORDER BY cl.created_at DESC`
    );
    res.status(200).json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch messages' });
  }
});

// Admin reply to customer
router.post('/reply', protect, adminOnly, async (req, res) => {
  try {
    const { userId, response } = req.body;

    const result = await pool.query(
      `INSERT INTO chat_logs (user_id, message, response, intent)
       VALUES ($1, 'Admin reply', $2, 'admin_reply')
       RETURNING *`,
      [userId, response]
    );

    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    console.error('Error sending reply:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send reply' });
  }
});

// Get messages for a specific user (customer view)
router.get('/my-messages', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM chat_logs WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );
    res.status(200).json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch messages' });
  }
});

module.exports = router;