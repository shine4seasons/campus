process.env.SEPAY_SUPPRESS_WARN = '1';
const paymentService = require('../services/paymentService');
const Payment = require('../models/Payment');
const { USER_ROLES, PAYMENT_STATUS } = require('../config/appConstants');

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

async function run() {
  const originalFindById = Payment.findById;

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
  } finally {
    Payment.findById = originalFindById;
  }

  if (failed > 0) {
    console.error(`\nSecurity ownership-lite test failed: ${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nSecurity ownership-lite test passed.');
}

run();
