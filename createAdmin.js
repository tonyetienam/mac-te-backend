const bcrypt = require('bcryptjs');
const { db } = require('./src/config/database');

async function createAdmin() {
  try {
    console.log('🔐 Creating admin account...');

    // Check if admin already exists
    const checkResult = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@mac-te.com');
    if (checkResult) {
      console.log('✅ Admin already exists:', checkResult.email);
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);
    const id = 'admin_' + Date.now();

    // Create admin
    db.prepare(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'admin@mac-te.com', hashedPassword, 'Admin', 'User', '08012345678', 'admin', 1);

    console.log('✅ Admin created successfully!');
    console.log('📧 Email: admin@mac-te.com');
    console.log('🔑 Password: Admin@123');
    console.log('👤 Role: admin');

  } catch (error) {
    console.error('❌ Error creating admin:', error);
  }
}

createAdmin();