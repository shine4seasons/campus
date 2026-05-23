const pageRepository = require('../repositories/pageRepository');
const { ORDER_STATUS } = require('../config/appConstants');
const { APP_NAME, TITLE_SEPARATOR, VIEWS } = require('../config/pageConstants');
const { notFound, forbidden } = require('../utils/errors');
const { CATEGORIES } = require('../public/js/categories');

function isValidObjectId(value) {
  return /^[0-9a-fA-F]{24}$/.test(String(value || ''));
}

async function getDashboardViewModel({ user, path, baseUrl }) {
  if (!user) {
    return { redirectTo: '/login' };
  }

  if (path === '/dashboard' || baseUrl === '/dashboard') {
    const { stats, topSellers } = await pageRepository.getAdminDashboardSnapshot();
    return {
      view: VIEWS.DASHBOARD_ADMIN,
      locals: {
        title: `Admin Dashboard${TITLE_SEPARATOR}${APP_NAME}`,
        isLoginPage: false,
        CATEGORIES,
        isSuperAdmin: user.role === 'admin',
        stats,
        topSellers,
        initialSection: 'aDash'
      }
    };
  }

  const { stats, wallet, recentRatings } = await pageRepository.getSellerDashboardSnapshot(user._id);
  return {
    view: VIEWS.DASHBOARD_SELLER,
    locals: {
      title: `Seller Dashboard${TITLE_SEPARATOR}${APP_NAME}`,
      isLoginPage: false,
      isSeller: user.role === 'seller',
      stats,
      wallet,
      recentRatings,
      activePage: 'dashboard'
    }
  };
}

async function getSellerOrdersViewModel(sellerId) {
  const [orders, productsWithCounts] = await Promise.all([
    pageRepository.findSellerOrders(sellerId),
    pageRepository.getProductOrderCounts(sellerId)
  ]);

  return {
    title: `Orders${TITLE_SEPARATOR}${APP_NAME}`,
    orders,
    productsWithCounts,
    isLoginPage: false,
    activePage: 'seller-orders'
  };
}

async function getBuyerOrdersViewModel(buyerId) {
  const orders = await pageRepository.findBuyerOrders(buyerId);
  const statusCounts = {
    [ORDER_STATUS.PENDING]: 0,
    [ORDER_STATUS.CONFIRMED]: 0,
    [ORDER_STATUS.COMPLETED]: 0,
    [ORDER_STATUS.CANCELLED]: 0
  };

  orders.forEach((order) => {
    statusCounts[order.status] += 1;
  });

  return {
    title: `My Orders${TITLE_SEPARATOR}${APP_NAME}`,
    orders,
    statusCounts,
    isLoginPage: false,
    activePage: 'orders'
  };
}

async function getOrderTrackingViewModel({ orderId, actor }) {
  if (!isValidObjectId(orderId)) {
    throw notFound('Order not found');
  }

  const [order, payment] = await Promise.all([
    pageRepository.findOrderTrackingDetail(orderId),
    pageRepository.findLatestPaymentForOrder(orderId)
  ]);

  if (!order) {
    throw notFound('Order not found');
  }

  const actorId = String(actor._id);
  const isBuyer = String(order.buyer._id) === actorId;
  const isSeller = String(order.seller._id) === actorId;
  const isAdmin = actor.role === 'admin';

  if (!isBuyer && !isSeller && !isAdmin) {
    throw forbidden('Forbidden');
  }

  return {
    title: `Order Tracking${TITLE_SEPARATOR}${APP_NAME}`,
    order,
    payment,
    isBuyer,
    isSeller,
    isLoginPage: false,
    activePage: 'orders'
  };
}

module.exports = {
  getDashboardViewModel,
  getSellerOrdersViewModel,
  getBuyerOrdersViewModel,
  getOrderTrackingViewModel
};
