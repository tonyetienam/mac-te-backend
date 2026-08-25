-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'customer',
  is_active BOOLEAN DEFAULT true,
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price_ngn DECIMAL(12, 2) NOT NULL,
  price_usd DECIMAL(12, 2),
  stock_quantity INTEGER DEFAULT 0,
  main_image VARCHAR(500),
  images JSONB DEFAULT '[]',
  rating DECIMAL(3, 2) DEFAULT 5.00,
  reviews_count INTEGER DEFAULT 0,
  seller_id UUID REFERENCES users(id),
  location VARCHAR(100),
  delivery_days INTEGER DEFAULT 3,
  specifications JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  items JSONB NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  shipping_address JSONB,
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  payment_reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  user_id UUID REFERENCES users(id),
  provider VARCHAR(50),
  provider_reference VARCHAR(255),
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'NGN',
  status VARCHAR(50) DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cart table
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  items JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat logs for AI
CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  intent VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price_ngn);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES (
  'admin@macte.com',
  '$2a$10$X9N0mYyTJpYxIWBRCCqRfOq5P0wYx7kRk0JCvVZFRk2U0hG0vY2qW',
  'Admin',
  'Mac-TE',
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- Insert sample products
INSERT INTO products (name, description, category, price_ngn, stock_quantity, main_image)
VALUES 
  ('Industrial Generator 5kVA', 'Heavy duty generator for industrial use', 'Machinery', 2500000, 10, 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e'),
  ('Cordless Drill Set', 'Professional cordless drill with 2 batteries', 'Tools', 45000, 50, 'https://images.unsplash.com/photo-1504148455328-c376907d081c'),
  ('Safety Helmet Pro', 'Industrial safety helmet with visor', 'Safety', 15000, 100, 'https://images.unsplash.com/photo-1563281577-a7be47e20db9'),
  ('Digital Multimeter', 'Professional digital multimeter with case', 'Electronics', 25000, 30, 'https://images.unsplash.com/photo-1553406830-ef2513450d76')
ON CONFLICT DO NOTHING;