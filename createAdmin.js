const bcrypt = require('bcryptjs');
const { db } = require('./src/config/database');

async function createAdmin() {
  try {
    console.log('🔐 Creating admin account...');

    // Check if admin exists
    const existing = await db.getAsync('SELECT * FROM users WHERE email = ?', ['admin@mac-te.com']);

    if (existing) {
      console.log('✅ Admin already exists:', existing.email);
      console.log('📧 Email:', existing.email);
      console.log('🔑 Password: Admin@123');
      process.exit(0);
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);
    const id = 'admin_' + Date.now();

    // Create admin
    await db.runAsync(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, 'admin@mac-te.com', hashedPassword, 'Admin', 'User', '08012345678', 'admin', 1]);

    console.log('✅ Admin created successfully!');
    console.log('📧 Email: admin@mac-te.com');
    console.log('🔑 Password: Admin@123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();