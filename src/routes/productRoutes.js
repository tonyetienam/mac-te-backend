const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const productController = require('../controllers/productController');

// Public routes
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

// Authenticated routes
router.post('/', authenticate, productController.createProduct);
router.put('/:id', authenticate, productController.updateProduct);
router.delete('/:id', authenticate, productController.deleteProduct);

// Admin only routes
router.post('/admin', authenticate, authorize(['admin']), productController.createProduct);
router.put('/admin/:id', authenticate, authorize(['admin']), productController.updateProduct);
router.delete('/admin/:id', authenticate, authorize(['admin']), productController.deleteProduct);

module.exports = router;