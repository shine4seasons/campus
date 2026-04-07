const validDelivery = ['pickup', 'ship'];
const validPayment = ['cash', 'card'];

const TRANSITIONS = {
  seller: {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed'],
  },
  buyer: {
    pending: ['cancelled'],
  },
};

module.exports = { validDelivery, validPayment, TRANSITIONS };
