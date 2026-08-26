const Database = require('better-sqlite3');
const path = require('path');

// Create SQLite database (file-based, works anywhere)
const db = new Database(path.join(__dirname, 'macte.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'customer',
    is_active INTEGER DEFAULT 1,
    profile_image TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    price_ngn REAL NOT NULL,
    price_usd REAL,
    stock_quantity INTEGER DEFAULT 0,
    main_image TEXT,
    images TEXT DEFAULT '[]',
    rating REAL DEFAULT 5.00,
    reviews_count INTEGER DEFAULT 0,
    seller_id TEXT,
    location TEXT,
    delivery_days INTEGER DEFAULT 3,
    specifications TEXT DEFAULT '{}',
    old_price REAL,
    discounted_price REAL,
    promo_ends_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    items TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'processing',
    shipping_address TEXT,
    payment_status TEXT DEFAULT 'pending',
    payment_reference TEXT,
    subtotal REAL DEFAULT 0,
    vat REAL DEFAULT 0,
    delivery_fee REAL DEFAULT 0,
    estimated_delivery_date TEXT,
    delivery_confirmed INTEGER DEFAULT 0,
    confirmed_by TEXT,
    confirmed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    otp TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    intent TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    items TEXT DEFAULT '[]',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Insert admin user (password: admin123)
  INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, role)
  VALUES ('admin', 'admin@macte.com', '$2a$10$X9N0mYyTJpYxIWBRCCqRfOq5P0wYx7kRk0JCvVZFRk2U0hG0vY2qW', 'Admin', 'Mac-TE', 'admin');

  -- Insert sample products
  INSERT OR IGNORE INTO products (id, name, description, category, price_ngn, stock_quantity, main_image)
  VALUES 
    ('p1', 'Industrial Generator 5kVA', 'Heavy duty generator for industrial use', 'Machinery', 2500000, 10, 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e'),
    ('p2', 'Cordless Drill Set', 'Professional cordless drill with 2 batteries', 'Tools', 45000, 50, 'https://images.unsplash.com/photo-1504148455328-c376907d081c'),
    ('p3', 'Safety Helmet Pro', 'Industrial safety helmet with visor', 'Safety', 15000, 100, 'https://images.unsplash.com/photo-1563281577-a7be47e20db9'),
    ('p4', 'Digital Multimeter', 'Professional digital multimeter with case', 'Electronics', 25000, 30, 'https://images.unsplash.com/photo-1553406830-ef2513450d76');
`);

module.exports = { db, pool: db };