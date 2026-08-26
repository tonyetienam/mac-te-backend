const { db } = require('../config/database');

// Get all products
const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category = ?`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name LIKE ? OR description LIKE ?)`;
      params.push(`%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) as total FROM products WHERE is_active = 1${category ? ' AND category = ?' : ''}${search ? ' AND (name LIKE ? OR description LIKE ?)' : ''}`;
    const countParams = [];
    
    if (category) countParams.push(category);
    if (search) {
      countParams.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    const total = db.prepare(countQuery).get(...countParams).total;
    
    params.push(parseInt(limit), offset);
    const products = db.prepare(query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params);

    res.status(200).json({
      status: 'success',
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch products',
    });
  }
};

// Get single product
const getProductById = async (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: product,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch product',
    });
  }
};

// Create new product
const createProduct = async (req, res) => {
  try {
    const { name, description, category, price_ngn, price_usd, stock_quantity, main_image, images, seller_id, location, delivery_days, old_price, discounted_price, promo_ends_at } = req.body;

    if (!name || !price_ngn) {
      return res.status(400).json({
        status: 'error',
        message: 'Name and price are required',
      });
    }

    const id = 'p' + Date.now();
    db.prepare(`
      INSERT INTO products (id, name, description, category, price_ngn, price_usd, stock_quantity, main_image, images, seller_id, location, delivery_days, old_price, discounted_price, promo_ends_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, category, price_ngn, price_usd, stock_quantity, main_image, images || '[]', seller_id, location, delivery_days, old_price, discounted_price, promo_ends_at);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    res.status(201).json({
      status: 'success',
      data: product,
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create product',
    });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'name', 'description', 'category', 'price_ngn', 'price_usd',
      'stock_quantity', 'main_image', 'images', 'is_active', 'location',
      'delivery_days', 'old_price', 'discounted_price', 'promo_ends_at'
    ];

    const updateFields = Object.keys(updates).filter(
      (key) => allowedFields.includes(key) && updates[key] !== undefined
    );

    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid fields to update',
      });
    }

    const setClause = updateFields.map(field => `${field} = ?`).join(', ');
    const values = updateFields.map(field => updates[field]);
    values.push(id);

    const result = db.prepare(`UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);

    if (result.changes === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    res.status(200).json({
      status: 'success',
      data: product,
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update product',
    });
  }
};

// Delete product (soft delete)
const deleteProduct = async (req, res) => {
  try {
    const result = db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete product',
    });
  }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct };