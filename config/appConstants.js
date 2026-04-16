/**
 * appConstants.js
 * Centralized business logic constants for the Campus Marketplace.
 */

const ORDER_STATUS = Object.freeze({
  PENDING:   'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

const PRODUCT_STATUS = Object.freeze({
  ACTIVE: 'active',
  SOLD:   'sold',
  HIDDEN: 'hidden',
});

const USER_ROLES = Object.freeze({
  USER:  'user',
  ADMIN: 'admin',
});

const ORDER_ROLES = Object.freeze({
  BUYER:  'buyer',
  SELLER: 'seller',
});

const NOTIFICATION_TYPES = Object.freeze({
  ORDER:   'order',
  MESSAGE: 'message',
  RATING:  'rating',
  SYSTEM:  'system',
  INFO:    'info',
});

const PRODUCT_CATEGORIES = Object.freeze([
  'books', 'electronics', 'clothing', 'furniture', 'daily-needs', 'sports', 'gaming', 'other'
]);

const PRODUCT_CONDITIONS = Object.freeze([
  'new', 'like-new', 'good', 'fair'
]);

const DELIVERY_MODES = Object.freeze(['pickup', 'ship']);
const PAYMENT_MODES = Object.freeze(['cash', 'card']);

const TRANSITIONS = Object.freeze({
  seller: {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED],
  },
  buyer: {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.CANCELLED],
  },
});

module.exports = {
  ORDER_STATUS,
  PRODUCT_STATUS,
  USER_ROLES,
  ORDER_ROLES,
  NOTIFICATION_TYPES,
  PRODUCT_CATEGORIES,
  PRODUCT_CONDITIONS,
  DELIVERY_MODES,
  PAYMENT_MODES,
  TRANSITIONS,
};
