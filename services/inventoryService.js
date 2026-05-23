const { PRODUCT_STATUS } = require('../config/appConstants');
const logger = require('../utils/logger');
const productRepository = require('../repositories/productRepository');
const userRepository = require('../repositories/userRepository');

async function releaseProductForOrder(order, { session } = {}) {
  const quantity = order?.quantity || 1;
  const updateOptions = session ? { session } : {};

  await productRepository.restoreProductReservation({
    productId: order.product,
    quantity,
    activeStatus: PRODUCT_STATUS.ACTIVE,
    options: updateOptions
  });

  const settled = await Promise.allSettled([
    userRepository.incrementUserById(
      order.seller,
      { totalSales: -quantity },
      updateOptions
    ),
    userRepository.incrementUserById(
      order.buyer,
      { totalOrders: -1 },
      updateOptions
    )
  ]);
  settled
    .filter((r) => r.status === 'rejected')
    .forEach((r) => logger.error('orders.counter_rollback_failed', {
      err: r.reason?.message || String(r.reason),
      orderId: order?._id ? String(order._id) : null,
      sellerId: order?.seller ? String(order.seller) : null,
      buyerId: order?.buyer ? String(order.buyer) : null,
      quantity
    }));
}

module.exports = { releaseProductForOrder };
