const { db } = require('../config/database');

// Get all products
const getProducts = async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = "SELECT * FROM products WHERE is_active = 1";
    let params = [];

    if (category && category !== 'all') {
      query += " AND category = ?";
      params.push(category);
    }

    if (search) {
      query += " AND (name LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += " ORDER BY created_at DESC";

    const products = await db.allAsync(query, params);

    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch products',
    });
  }
};

// Get product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await db.getAsync(
      'SELECT * FROM products WHERE id = ? AND is_active = 1',
      [id]
    );

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

// Create product
const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, image, stock } = req.body;
    const sellerId = req.user.id;

    if (!name || !description || !price || !category) {
      return res.status(400).json({
        status: 'error',
        message: 'Name, description, price, and category are required',
      });
    }

    const id = 'p' + Date.now();
    const priceNgn = parseFloat(price);
    const stockQuantity = parseInt(stock) || 0;

    await db.runAsync(`
      INSERT INTO products (id, name, description, price_ngn, category, image_url, stock_quantity, seller_id, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, description, priceNgn, category, image || '', stockQuantity, sellerId, 1, new Date().toISOString()]);

    const product = await db.getAsync('SELECT * FROM products WHERE id = ?', [id]);

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
    const { name, description, price, category, image, stock } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const existing = await db.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    if (existing.seller_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to update this product',
      });
    }

    const updates = [];
    const params = [];

    if (name) { updates.push("name = ?"); params.push(name); }
    if (description) { updates.push("description = ?"); params.push(description); }
    if (price) { updates.push("price_ngn = ?"); params.push(parseFloat(price)); }
    if (category) { updates.push("category = ?"); params.push(category); }
    if (image !== undefined) { updates.push("image_url = ?"); params.push(image); }
    if (stock !== undefined) { updates.push("stock_quantity = ?"); params.push(parseInt(stock)); }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update',
      });
    }

    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    await db.runAsync(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);

    const product = await db.getAsync('SELECT * FROM products WHERE id = ?', [id]);

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

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const existing = await db.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    if (existing.seller_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to delete this product',
      });
    }

    await db.runAsync('UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);

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

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};