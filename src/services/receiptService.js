const PDFDocument = require('pdfkit');
const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

const resend = new Resend(process.env.RESEND_API_KEY);

// Generate Official Receipt PDF with Images
const generateReceiptPDF = (order, user) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filePath = path.join(__dirname, `receipt_${order.payment_reference}.pdf`);
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc.fontSize(28).fillColor('#0B132B').text('Mac-TE Smart Shopping', { align: 'center' });
      doc.fontSize(12).fillColor('#00B4D8').text('Official Order Receipt', { align: 'center' });
      doc.moveDown();

      // Divider
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#00B4D8');
      doc.moveDown();

      // Order Details
      doc.fontSize(12).fillColor('#333');
      doc.text(`Tracking Number: ${order.payment_reference}`);
      doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`);
      doc.text(`Customer: ${user.first_name} ${user.last_name}`);
      doc.text(`Email: ${user.email}`);
      doc.text(`Phone: ${user.phone || 'N/A'}`);
      doc.moveDown();

      // Delivery Address
      doc.fontSize(14).fillColor('#0B132B').text('Delivery Address:');
      doc.fontSize(12).fillColor('#333').text(`${order.shipping_address?.address || ''}`);
      doc.text(`${order.shipping_address?.city || ''}, ${order.shipping_address?.state || ''}`);
      doc.moveDown();

      // Divider
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#00B4D8');
      doc.moveDown();

      // Items
      doc.fontSize(14).fillColor('#0B132B').text('Order Items:');
      doc.moveDown();

      const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');

      items.forEach((item, index) => {
        // Try to insert image if available
        if (item.image) {
          try {
            doc.image(item.image, { width: 60, height: 60, fit: [60, 60] });
            doc.text(`${index + 1}. ${item.name || 'Product'}`, { continued: true });
          } catch (imageError) {
            doc.text(`${index + 1}. ${item.name || 'Product'}`);
          }
        } else {
          doc.text(`${index + 1}. ${item.name || 'Product'}`);
        }
        doc.text(`   Quantity: ${item.quantity || 1} x ₦${(item.price || 0).toLocaleString()} = ₦${((item.price || 0) * (item.quantity || 1)).toLocaleString()}`, { indent: 10 });
        doc.moveDown(0.5);
      });

      // Divider
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#00B4D8');
      doc.moveDown();

      // Totals
      doc.fontSize(14).fillColor('#0B132B');
      doc.text(`Subtotal: ₦${(order.subtotal || 0).toLocaleString()}`, { align: 'right' });
      doc.text(`VAT (7.5%): ₦${(order.vat || 0).toLocaleString()}`, { align: 'right' });
      doc.text(`Delivery Fee: ₦${(order.delivery_fee || 0).toLocaleString()}`, { align: 'right' });
      doc.fontSize(18).fillColor('#00B4D8').text(`Total: ₦${(order.total_amount || 0).toLocaleString()}`, { align: 'right' });
      doc.moveDown();

      // Footer
      doc.fontSize(10).fillColor('#888');
      doc.text('Thank you for shopping with Mac-TE Smart Shopping!', { align: 'center' });
      doc.text('24/7 Support: +234 708 797 0714 | Email: macplus.te@gmail.com', { align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

// Send Receipt Email
const sendReceiptEmail = async (order, user) => {
  try {
    const filePath = await generateReceiptPDF(order, user);
    const pdfBuffer = fs.readFileSync(filePath);

    // Build email content with images
    const itemsHtml = (Array.isArray(order.items) ? order.items : []).map((item) => `
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        <img src="${item.image}" width="50" height="50" style="border-radius: 5px; margin-right: 10px;" />
        <div>
          <p style="margin: 0; font-weight: bold;">${item.name}</p>
          <p style="margin: 0; color: #666;">Quantity: ${item.quantity}</p>
          <p style="margin: 0; color: #00B4D8; font-weight: bold;">₦${(item.price * item.quantity).toLocaleString()}</p>
        </div>
      </div>
    `).join('');

    const emailResponse = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Mac-TE Smart Shopping <onboarding@resend.dev>',
      to: user.email,
      subject: `Order Confirmation - ${order.payment_reference}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0B132B;">Mac-TE Smart Shopping</h2>
          <p style="color: #00B4D8; font-size: 18px;"><strong>Order Confirmed!</strong></p>
          <p>Thank you ${user.first_name}!</p>
          <p><strong>Tracking Number:</strong> ${order.payment_reference}</p>
          <p><strong>Delivery Address:</strong> ${order.shipping_address?.address || ''}, ${order.shipping_address?.city || ''}, ${order.shipping_address?.state || ''}</p>
          <h3>Items:</h3>
          ${itemsHtml}
          <hr>
          <p><strong>Subtotal:</strong> ₦${(order.subtotal || 0).toLocaleString()}</p>
          <p><strong>VAT (7.5%):</strong> ₦${(order.vat || 0).toLocaleString()}</p>
          <p><strong>Delivery Fee:</strong> ₦${(order.delivery_fee || 0).toLocaleString()}</p>
          <p style="font-size: 18px; color: #00B4D8; font-weight: bold;"><strong>Total:</strong> ₦${(order.total_amount || 0).toLocaleString()}</p>
          <hr>
          <p style="color: #888; font-size: 12px;">Mac-TE Smart Shopping<br>24/7 Support: +234 708 797 0714<br>Email: macplus.te@gmail.com</p>
        </div>
      `,
      attachments: [
        {
          filename: `receipt_${order.payment_reference}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    fs.unlinkSync(filePath);
    console.log(`✅ Receipt email sent to: ${user.email}`);
    return emailResponse;
  } catch (error) {
    console.error('Error sending receipt email:', error);
    throw error;
  }
};

// Send Phone Notification (SMS placeholder)
const sendPhoneNotification = async (phone, trackingNumber, total) => {
  try {
    console.log(`📱 SMS sent to ${phone}: Your Mac-TE order ${trackingNumber} is confirmed. Total: ₦${total.toLocaleString()}`);
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
};

module.exports = { generateReceiptPDF, sendReceiptEmail, sendPhoneNotification };