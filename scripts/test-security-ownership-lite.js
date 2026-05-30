process.env.SEPAY_SUPPRESS_WARN = '1';
const paymentService = require('../services/paymentService');
const chatService = require('../services/chatService');
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const notificationController = require('../controllers/notificationController');
const disputeController = require('../controllers/orders/dispute');
const Payment = require('../models/Payment');
const chatRepository = require('../repositories/chatRepository');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');
const notificationRepository = require('../repositories/notificationRepository');
const { USER_ROLES, PAYMENT_STATUS, ORDER_STATUS, DISPUTE_RESOLUTIONS } = require('../config/appConstants');

let failed = 0;

function check(name, cond, detail = '') {
  if (cond) {
    console.log(`[PASS] ${name}`);
    return;
  }
  failed += 1;
  console.error(`[FAIL] ${name}${detail ? ` :: ${detail}` : ''}`);
}

function makeQueryResult(paymentDoc) {
  return {
    populate() {
      return this;
    },
    then(resolve) {
      return Promise.resolve(resolve(paymentDoc));
    },
    catch(reject) {
      return Promise.resolve().catch(reject);
    }
  };
}

function makeJsonRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

async function run() {
  const originalFindById = Payment.findById;
  const originalFindConversationByIdForUser = chatRepository.findConversationByIdForUser;
  const originalFindProductById = productRepository.findProductById;
  const originalFindOrderById = orderRepository.findOrderById;
  const originalFindOrderForDispute = orderRepository.findOrderForDispute;
  const originalMarkNotificationAsRead = notificationRepository.markNotificationAsRead;
  const originalDeleteNotificationForRecipient = notificationRepository.deleteNotificationForRecipient;

  try {
    const paymentDoc = {
      _id: 'pay_1',
      buyer: { _id: 'buyer_1' },
      seller: { _id: 'seller_1' },
      status: PAYMENT_STATUS.PAID,
      paidAt: new Date(),
      expiredAt: new Date(Date.now() + 60_000),
      order: { _id: 'order_1' }
    };

    Payment.findById = () => makeQueryResult(paymentDoc);

    // Buyer is allowed
    {
      const out = await paymentService.checkPaymentViaSePay({
        paymentId: 'pay_1',
        actor: { _id: 'buyer_1', role: USER_ROLES.USER }
      });
      check('SEC-004 buyer can access own payment', out && out.success === true && out.status === PAYMENT_STATUS.PAID);
    }

    // Seller is allowed
    {
      const out = await paymentService.checkPaymentViaSePay({
        paymentId: 'pay_1',
        actor: { _id: 'seller_1', role: USER_ROLES.USER }
      });
      check('SEC-004 seller can access own payment', out && out.success === true && out.status === PAYMENT_STATUS.PAID);
    }

    // Admin is allowed
    {
      const out = await paymentService.checkPaymentViaSePay({
        paymentId: 'pay_1',
        actor: { _id: 'admin_1', role: USER_ROLES.ADMIN }
      });
      check('SEC-004 admin can access payment', out && out.success === true && out.status === PAYMENT_STATUS.PAID);
    }

    // Unrelated user is denied
    {
      let denied = false;
      try {
        await paymentService.checkPaymentViaSePay({
          paymentId: 'pay_1',
          actor: { _id: 'other_1', role: USER_ROLES.USER }
        });
      } catch (err) {
        denied = Number(err.status) === 403 && err.message === 'Forbidden';
      }
      check('SEC-004 unrelated user is forbidden', denied);
    }

    // Chat lookup must be participant-scoped at repository boundary.
    {
      let observedQuery = null;
      chatRepository.findConversationByIdForUser = async (conversationId, userId) => {
        observedQuery = { conversationId, userId };
        return null;
      };

      const out = await chatService.getConversationForUser('conv_1', 'other_1');
      check(
        'SEC-004 chat lookup is participant scoped',
        out === null && observedQuery?.conversationId === 'conv_1' && observedQuery?.userId === 'other_1'
      );
    }

    // Product mutations must allow owner/admin and reject unrelated users.
    {
      productRepository.findProductById = async () => ({ _id: 'product_1', seller: 'seller_1' });

      const ownerProduct = await productService.ensureProductOwnerOrAdmin('product_1', {
        _id: 'seller_1',
        role: USER_ROLES.USER
      });
      check('SEC-004 product owner can mutate product', ownerProduct && ownerProduct._id === 'product_1');

      const adminProduct = await productService.ensureProductOwnerOrAdmin('product_1', {
        _id: 'admin_1',
        role: USER_ROLES.ADMIN
      });
      check('SEC-004 admin can mutate product', adminProduct && adminProduct._id === 'product_1');

      let denied = false;
      try {
        await productService.ensureProductOwnerOrAdmin('product_1', {
          _id: 'other_1',
          role: USER_ROLES.USER
        });
      } catch (err) {
        denied = Number(err.status) === 403;
      }
      check('SEC-004 unrelated user cannot mutate product', denied);
    }

    // Order status changes must be scoped to buyer/seller/admin before transitions run.
    {
      orderRepository.findOrderById = async () => ({
        _id: 'order_1',
        buyer: 'buyer_1',
        seller: 'seller_1',
        status: ORDER_STATUS.PENDING
      });

      let denied = false;
      try {
        await orderService.updateOrderStatus({
          actor: { _id: 'other_1', role: USER_ROLES.USER },
          orderId: 'order_1',
          status: ORDER_STATUS.CANCELLED
        });
      } catch (err) {
        denied = Number(err.status) === 403 && err.message === 'Unauthorized';
      }
      check('SEC-004 unrelated user cannot update order status', denied);
    }

    // Notification mutations must be scoped to the authenticated recipient.
    {
      let observed = null;
      notificationRepository.markNotificationAsRead = async ({ notificationId, recipientId }) => {
        observed = { notificationId, recipientId };
        return { _id: notificationId };
      };

      const res = makeJsonRes();
      await notificationController.markAsRead(
        { params: { id: 'notif_1' }, user: { _id: 'recipient_1' } },
        res,
        (err) => { throw err; }
      );
      check(
        'SEC-004 notification read is recipient scoped',
        res.payload?.success === true && observed?.notificationId === 'notif_1' && observed?.recipientId === 'recipient_1'
      );
    }

    {
      let observed = null;
      notificationRepository.deleteNotificationForRecipient = async ({ notificationId, recipientId }) => {
        observed = { notificationId, recipientId };
        return { deletedCount: 0 };
      };

      const res = makeJsonRes();
      await notificationController.deleteNotification(
        { params: { id: 'notif_2' }, user: { _id: 'recipient_2' } },
        res,
        (err) => { throw err; }
      );
      check(
        'SEC-004 notification delete is recipient scoped',
        res.payload?.success === true && observed?.notificationId === 'notif_2' && observed?.recipientId === 'recipient_2'
      );
    }

    // Disputes must reject non-parties and non-admin resolution attempts.
    {
      orderRepository.findOrderForDispute = async () => ({
        _id: 'order_2',
        buyer: 'buyer_1',
        seller: 'seller_1',
        status: ORDER_STATUS.CONFIRMED,
        dispute: null
      });

      const res = makeJsonRes();
      await disputeController.openDispute(
        {
          params: { id: 'order_2' },
          user: { _id: 'other_1', role: USER_ROLES.USER },
          body: { category: 'other', reason: 'Need help', description: '', evidenceImages: [] }
        },
        res,
        (err) => { throw err; }
      );
      check('SEC-004 non-party cannot open order dispute', res.statusCode === 403);
    }

    {
      const res = makeJsonRes();
      await disputeController.resolveDispute(
        {
          params: { id: 'order_2' },
          user: { _id: 'buyer_1', role: USER_ROLES.USER },
          body: { resolution: DISPUTE_RESOLUTIONS.BUYER_FAVOR, resolutionNote: '', refund: false }
        },
        res,
        (err) => { throw err; }
      );
      check('SEC-004 non-admin cannot resolve order dispute', res.statusCode === 403);
    }
  } finally {
    Payment.findById = originalFindById;
    chatRepository.findConversationByIdForUser = originalFindConversationByIdForUser;
    productRepository.findProductById = originalFindProductById;
    orderRepository.findOrderById = originalFindOrderById;
    orderRepository.findOrderForDispute = originalFindOrderForDispute;
    notificationRepository.markNotificationAsRead = originalMarkNotificationAsRead;
    notificationRepository.deleteNotificationForRecipient = originalDeleteNotificationForRecipient;
  }

  if (failed > 0) {
    console.error(`\nSecurity ownership-lite test failed: ${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nSecurity ownership-lite test passed.');
}

run();
