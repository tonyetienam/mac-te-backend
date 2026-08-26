const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
    console.log(`✅ Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ Email error:`, error);
    return false;
  }
};

const sendOrderConfirmation = async (order, user) => {
  try {
    const itemsHtml = (typeof order.items === 'string' ? JSON.parse(order.items) : order.items).map((item) => `
      <div style="margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:10px;">
        <p style="margin:0;font-weight:bold;">${item.name} x${item.quantity}</p>
        <p style="margin:0;color:#00B4D8;">₦${(item.price * item.quantity).toLocaleString()}</p>
      </div>
    `).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <h2 style="color:#0B132B;text-align:center;">Mac-TE Smart Shopping</h2>
        <p style="color:#00B4D8;font-size:18px;text-align:center;font-weight:bold;">🎉 Order Confirmed!</p>
        <p>Hi ${user.first_name},</p>
        <p><strong>Tracking:</strong> ${order.payment_reference}</p>
        <p><strong>Estimated Delivery:</strong> ${order.estimated_delivery_date ? new Date(order.estimated_delivery_date).toLocaleDateString() : 'Pending'}</p>
        <p><strong>Address:</strong> ${order.shipping_address ? JSON.parse(order.shipping_address).address : ''}</p>
        <h3>Items:</h3>
        ${itemsHtml}
        <hr>
        <p><strong>Total:</strong> ₦${(order.total_amount || 0).toLocaleString()}</p>
      </div>
    `;

    return await sendEmail(user.email, `Order Confirmed - ${order.payment_reference}`, html);
  } catch (error) {
    console.error('Error sending order confirmation:', error);
    return false;
  }
};

const sendDeliveryNotification = async (order, user) => {
  try {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <h2 style="color:#0B132B;text-align:center;">Mac-TE Smart Shopping</h2>
        <p style="color:#00B4D8;font-size:18px;text-align:center;font-weight:bold;">📦 Order Confirmed for Delivery!</p>
        <p>Hi ${user.first_name},</p>
        <p>Your order <strong>${order.payment_reference}</strong> has been confirmed by our team!</p>
        <p><strong>Estimated Delivery Date:</strong> ${order.estimated_delivery_date ? new Date(order.estimated_delivery_date).toLocaleDateString() : 'Pending'}</p>
        <p>Please be available at your delivery address on this date.</p>
      </div>
    `;

    return await sendEmail(user.email, `Delivery Confirmed - ${order.payment_reference}`, html);
  } catch (error) {
    console.error('Error sending delivery notification:', error);
    return false;
  }
};

const sendWelcomeEmail = async (user) => {
  try {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <h2 style="color:#0B132B;text-align:center;">Mac-TE Smart Shopping</h2>
        <p>Hi ${user.first_name},</p>
        <p>Welcome to Mac-TE Smart Shopping! 🎉</p>
        <p>Start shopping for top-quality engineering tools and equipment.</p>
      </div>
    `;
    return await sendEmail(user.email, 'Welcome to Mac-TE Smart Shopping!', html);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};

const notifyAdminOfNewSeller = async (seller) => {
  try {
    const adminEmail = process.env.EMAIL_USER;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <h2 style="color:#0B132B;text-align:center;">Mac-TE Smart Shopping</h2>
        <p>A new seller has registered!</p>
        <p><strong>Name:</strong> ${seller.first_name} ${seller.last_name}</p>
        <p><strong>Email:</strong> ${seller.email}</p>
        <p>Please log in to the Admin Dashboard to approve this seller.</p>
      </div>
    `;
    return await sendEmail(adminEmail, 'New Seller Registration', html);
  } catch (error) {
    console.error('Error notifying admin:', error);
    return false;
  }
};

const sendCancellationNotification = async (order, user) => {
  try {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
        <h2 style="color:#0B132B;text-align:center;">Mac-TE Smart Shopping</h2>
        <p style="color:#EF4444;font-size:18px;text-align:center;font-weight:bold;">❌ Order Cancelled</p>
        <p>Hi ${user.first_name},</p>
        <p>Your order <strong>${order.payment_reference}</strong> has been cancelled.</p>
      </div>
    `;
    return await sendEmail(user.email, `Order Cancelled - ${order.payment_reference}`, html);
  } catch (error) {
    console.error('Error sending cancellation notification:', error);
    return false;
  }
};

module.exports = { sendEmail, sendOrderConfirmation, sendDeliveryNotification, sendWelcomeEmail, notifyAdminOfNewSeller, sendCancellationNotification };