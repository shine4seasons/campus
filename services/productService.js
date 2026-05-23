const { sendNotification } = require('../utils/notifService');
const { USER_ROLES, NOTIFICATION_TYPES } = require('../config/appConstants');
const { forbidden, notFound } = require('../utils/errors');
const productRepository = require('../repositories/productRepository');

async function ensureProductOwnerOrAdmin(productId, actor) {
  const product = await productRepository.findProductById(productId);
  if (!product) throw notFound('Product not found');
  const isOwner = String(product.seller) === String(actor && actor._id);
  const isAdmin = actor && actor.role === USER_ROLES.ADMIN;
  if (!isOwner && !isAdmin) throw forbidden('Unauthorized');
  return product;
}

async function notifyPriceDropFollowers(product) {
  const favorites = await productRepository.findFavoriteUserIdsByProductId(product._id);
  if (!favorites.length) return 0;

  const message = `The price of "${product.title}" has dropped to ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(product.price)}!`;

  await Promise.all(
    favorites.map((fav) => sendNotification({
      recipient: fav.user,
      sender: product.seller,
      type: NOTIFICATION_TYPES.INFO,
      title: 'Price Drop!',
      message,
      link: `/products/${product._id}`
    }))
  );
  return favorites.length;
}

module.exports = {
  ensureProductOwnerOrAdmin,
  notifyPriceDropFollowers
};
