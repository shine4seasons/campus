const assert = require('assert');
const fs = require('fs');
const path = require('path');

const productRepository = require('../repositories/productRepository');
const notificationRepository = require('../repositories/notificationRepository');
const orderRepository = require('../repositories/orderRepository');
const chatRepository = require('../repositories/chatRepository');
const walletRepository = require('../repositories/walletRepository');
const paymentRepository = require('../repositories/paymentRepository');
const ratingRepository = require('../repositories/ratingRepository');
const adminRepository = require('../repositories/adminRepository');
const authRepository = require('../repositories/authRepository');
const pageRepository = require('../repositories/pageRepository');

const ROOT = path.join(__dirname, '..');
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${name}`);
    return;
  }
  failed += 1;
  console.error(`[FAIL] ${name}${detail ? ` :: ${detail}` : ''}`);
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function checkExports() {
  check('ARCH-201 productRepository feed query method', typeof productRepository.findProductsForFeed === 'function');
  check('ARCH-201 orderRepository detail method', typeof orderRepository.findOrderDetailById === 'function');
  check('ARCH-201 chatRepository conversation list method', typeof chatRepository.findConversationsForUser === 'function');
  check('ARCH-201 walletRepository payout list method', typeof walletRepository.findPayoutRequestsByUser === 'function');
  check('ARCH-201 notificationRepository list method', typeof notificationRepository.findNotificationsForRecipient === 'function');
  check('ARCH-201 paymentRepository checkout product method', typeof paymentRepository.findCheckoutProductById === 'function');
  check('ARCH-201 ratingRepository aggregate method', typeof ratingRepository.getRatingAggregate === 'function');
  check('ARCH-201 adminRepository users method', typeof adminRepository.findAdminUsers === 'function');
  check('ARCH-201 authRepository profile update method', typeof authRepository.updateUserProfileById === 'function');
  check('ARCH-201 pageRepository product detail method', typeof pageRepository.findPageProductById === 'function');
}

function checkPureHelpers() {
  const productFilter = productRepository.buildActiveProductFilter(
    { category: 'books', minPrice: '1000', maxPrice: '5000' },
    'user-123'
  );
  check('ARCH-201 product filter includes category', productFilter.category === 'books');
  check('ARCH-201 product filter price min/max', productFilter.price.$gte === 1000 && productFilter.price.$lte === 5000);
  check('ARCH-201 product filter excludes current seller', productFilter.seller && productFilter.seller.$ne === 'user-123');

  const notifUnread = notificationRepository.buildNotificationFilter({ recipientId: 'user-1', filter: 'unread' });
  check('ARCH-201 notification filter unread flag', notifUnread.isRead === false);
  const notifType = notificationRepository.buildNotificationFilter({ recipientId: 'user-1', filter: 'system' });
  check('ARCH-201 notification filter type', notifType.type === 'system');

  const ratingAgg = ratingRepository.getRatingAggregate;
  check('ARCH-201 ratingRepository aggregate export is callable', typeof ratingAgg === 'function');
}

function checkControllerBoundaries() {
  const files = [
    'controllers/product/index.js',
    'controllers/orders/index.js',
    'controllers/orders/dispute.js',
    'controllers/chat/index.js',
    'controllers/chat/conversation.js',
    'controllers/walletController.js',
    'controllers/notificationController.js',
    'controllers/checkout/index.js',
    'controllers/rating/index.js',
    'controllers/admin/index.js',
    'controllers/auth/index.js',
    'controllers/pageController.js'
  ];

  files.forEach((relPath) => {
    const content = read(relPath);
    check(
      `ARCH-201 ${relPath} uses repository layer`,
      /repositories\//.test(content),
      'missing repository import'
    );
  });
}

function main() {
  checkExports();
  checkPureHelpers();
  checkControllerBoundaries();

  if (failed > 0) {
    console.error(`\nArchitecture repository controls failed: ${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nArchitecture repository controls passed.');
}

main();
