// Complete Rule-Based AI Chat System (Guaranteed to Work)
const getAIResponse = async (message) => {
  try {
    const lowerMessage = message.toLowerCase().trim();

    // Greetings
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey') || lowerMessage.includes('good morning') || lowerMessage.includes('good afternoon') || lowerMessage.includes('good evening')) {
      return "Hello! 👋 Welcome to Mac-TE Smart Shopping. I'm your AI assistant. How can I help you today? You can ask me about products, prices, delivery, payments, or track your order.";
    }

    // Delivery related
    if (lowerMessage.includes('delivery') || lowerMessage.includes('shipping') || lowerMessage.includes('deliver') || lowerMessage.includes('when is my')) {
      return "📦 Delivery typically takes 3-5 business days depending on your location. For Lagos, it's usually 2-3 days. Once your order is confirmed, you'll receive an email with your estimated delivery date.";
    }

    // Payment related
    if (lowerMessage.includes('payment') || lowerMessage.includes('pay') || lowerMessage.includes('card') || lowerMessage.includes('transfer')) {
      return "💳 We accept multiple payment methods:\n• Card Payment (Paystack)\n• Bank Transfer\n• Cash on Delivery (for orders under ₦70,000)\n\nOrders above ₦70,000 require payment before delivery.";
    }

    // Product related
    if (lowerMessage.includes('product') || lowerMessage.includes('available') || lowerMessage.includes('stock') || lowerMessage.includes('which product')) {
      return "🛒 We have a wide range of engineering products available:\n• Industrial Generators\n• Power Tools\n• Safety Equipment\n• Electronics & Multimeters\n\nCheck the Home page to browse all products!";
    }

    // Price related
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
      return "💰 Our prices vary by product. You can check the price of any product by clicking on it. Some products have discounts, so look for the red discount badge!";
    }

    // Tracking/Order status
    if (lowerMessage.includes('track') || lowerMessage.includes('order status') || lowerMessage.includes('where is my order')) {
      return "📦 You can track your order in the 'Orders' section of your account. Look for the tracking number on your confirmation email. If you need more help, please provide your tracking number.";
    }

    // Return/Refund related
    if (lowerMessage.includes('return') || lowerMessage.includes('refund')) {
      return "🔄 We have a 7-day return policy. If you're not satisfied with your purchase, you can return it within 7 days for a full refund. Just contact our support team with your order number.";
    }

    // Account related
    if (lowerMessage.includes('login') || lowerMessage.includes('sign in') || lowerMessage.includes('account')) {
      return "📱 You can login or create an account by going to the 'Account' tab at the bottom of the screen. It only takes a minute!";
    }
    if (lowerMessage.includes('register') || lowerMessage.includes('sign up') || lowerMessage.includes('create account')) {
      return "🎉 You can create a free account in seconds! Go to the 'Account' tab and tap 'Login / Register'. Fill in your details and you're ready to shop!";
    }

    // Support related
    if (lowerMessage.includes('help') || lowerMessage.includes('support') || lowerMessage.includes('contact')) {
      return "🤝 I'm here to help! For immediate assistance, you can contact our support team:\n📞 Phone: +234 708 797 0714\n📧 Email: macplus.te@gmail.com\nYou can also visit the Help & Support section in your account.";
    }

    // Complaint/Issue (transfer to agent)
    if (lowerMessage.includes('complaint') || lowerMessage.includes('problem') || lowerMessage.includes('issue') || lowerMessage.includes('agent') || lowerMessage.includes('human')) {
      return "🤝 I understand you need more help. Let me transfer you to a human agent who can assist you better. A support specialist will respond shortly.";
    }

    // Thank you
    if (lowerMessage.includes('thank')) {
      return "You're welcome! 😊 Is there anything else I can help you with? If not, happy shopping! 🛒";
    }

    // Generator specific
    if (lowerMessage.includes('generator')) {
      return "⚡ We have high-quality industrial generators starting from ₦2,500,000. The Industrial Generator 5kVA is one of our bestsellers! Would you like to see it?";
    }

    // Drill specific
    if (lowerMessage.includes('drill')) {
      return "🔧 Our Cordless Drill Set is a professional-grade tool with 2 batteries, priced at ₦45,000. It's perfect for both professional and DIY use!";
    }

    // Safety specific
    if (lowerMessage.includes('helmet') || lowerMessage.includes('safety')) {
      return "🛡️ We have industrial safety helmets with visors starting from ₦15,000. Safety is our top priority!";
    }

    // Default response
    return "Thank you for your message! I can help you with:\n• Product information & prices\n• Delivery & shipping details\n• Payment methods\n• Order tracking\n• Returns & refunds\n\nWhat would you like to know?";
  } catch (error) {
    console.error('AI response error:', error);
    return "I'm having trouble processing that. Please try again or contact our support team at macplus.te@gmail.com.";
  }
};

// Determine if transfer to human agent is needed
const shouldTransferToAgent = (message) => {
  const lowerMessage = message.toLowerCase();
  const transferKeywords = [
    'agent', 'human', 'person', 'complaint', 'problem', 'issue',
    'speak to someone', 'talk to', 'refund my money', 'cancel my order'
  ];
  
  return transferKeywords.some(keyword => lowerMessage.includes(keyword));
};

module.exports = { getAIResponse, shouldTransferToAgent };