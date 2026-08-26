const { db } = require('./src/config/database');

async function checkUser() {
  try {
    console.log('🔍 Checking for admin user...');
    
    const user = await db.getAsync('SELECT * FROM users WHERE email = ?', ['admin@mac-te.com']);
    
    if (user) {
      console.log('✅ User found:');
      console.log('📧 Email:', user.email);
      console.log('👤 Role:', user.role);
      console.log('📋 First Name:', user.first_name);
      console.log('📋 Last Name:', user.last_name);
      console.log('📞 Phone:', user.phone);
      console.log('🔓 Is Active:', user.is_active);
      console.log('📅 Created:', user.created_at);
      console.log('\n📦 Full user object:', JSON.stringify(user, null, 2));
    } else {
      console.log('❌ Admin user NOT found.');
      console.log('Run: npm run create-admin');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking user:', error);
    process.exit(1);
  }
}

checkUser();