/**
 * Payment Code Generation Utility
 * 
 * Generates unique payment codes for QR payment transfers
 * Format: SCM_ORDER_{orderId}_{timestamp}_{random}
 * 
 * Example: SCM_ORDER_65a8b2c_1705316400_a1b2c3d
 * 
 * Used in:
 * - QR code generation (transfer content field)
 * - Payment model record
 * - Bank transfer verification
 */

/**
 * Generate unique payment code
 * @param {string} orderId - MongoDB ObjectId of the order
 * @returns {string} Unique payment code
 */
function generatePaymentCode(orderId) {
  // Timestamp in seconds
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Random alphanumeric suffix (6 characters)
  const random = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
  
  // Format: SCM_ORDER_{orderId}_{timestamp}_{random}
  return `SCM_ORDER_${orderId}_${timestamp}_${random}`;
}

/**
 * Validate payment code format
 * @param {string} paymentCode - Code to validate
 * @returns {boolean} True if valid format
 */
function validatePaymentCode(paymentCode) {
  // Expected format: SCM_ORDER_[orderId]_[timestamp]_[random]
  const regex = /^SCM_ORDER_[a-f0-9]{24}_\d{10}_[A-Z0-9]{6}$/;
  return regex.test(paymentCode);
}

/**
 * Parse payment code to extract orderId
 * @param {string} paymentCode - Code to parse
 * @returns {string|null} OrderId if valid, null otherwise
 */
function parsePaymentCode(paymentCode) {
  const parts = paymentCode.split('_');
  
  if (parts.length !== 5 || parts[0] !== 'SCM' || parts[1] !== 'ORDER') {
    return null;
  }
  
  // parts[2] = orderId
  const orderId = parts[2];
  
  // Validate if it's a valid MongoDB ObjectId
  if (/^[a-f0-9]{24}$/.test(orderId)) {
    return orderId;
  }
  
  return null;
}

module.exports = {
  generatePaymentCode,
  validatePaymentCode,
  parsePaymentCode
};
