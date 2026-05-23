const Product = require('../models/Product');
const User = require('../models/User');
const { PRODUCT_STATUS } = require('../config/appConstants');
const logger = require('../utils/logger');

async function releaseProductForOrder(order, { session } = {}) {
  const quantity = order?.quantity || 1;
  const updateOptions = session ? { session } : {};

  await Product.findByIdAndUpdate(
    order.product,
    {
      $inc: { quantity },
      $set: { status: PRODUCT_STATUS.ACTIVE, buyer: null, soldAt: null }
    },
    updateOptions
  );

  const settled = await Promise.allSettled([
    User.findByIdAndUpdate(
      order.seller,
      { $inc: { totalSales: -quantity } },
      updateOptions
    ),
    User.findByIdAndUpdate(
      order.buyer,
      { $inc: { totalOrders: -1 } },
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
