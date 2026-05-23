const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failed = 0;

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function check(name, cond, detail = '') {
  if (cond) {
    console.log(`[PASS] ${name}`);
    return;
  }
  failed += 1;
  console.error(`[FAIL] ${name}${detail ? ` :: ${detail}` : ''}`);
}

function includesAll(content, patterns) {
  return patterns.every((p) => content.includes(p));
}

function runDb001Checks() {
  const paymentService = read('services/paymentService.js');
  const orderService = read('services/orderService.js');
  const walletTxModel = read('models/WalletTransaction.js');
  const adminController = read('controllers/admin/index.js');

  check(
    'DB-001 payment expiry update is conditional',
    includesAll(paymentService, ['updateOne', 'status: PAYMENT_STATUS.PENDING', 'PAYMENT_STATUS.EXPIRED'])
  );

  check(
    'DB-001 order cancel path uses conditional status guard',
    includesAll(paymentService, ['findOneAndUpdate', 'status: { $ne: ORDER_STATUS.CANCELLED }'])
  );

  check(
    'DB-001 idempotency key for payment credit',
    paymentService.includes('idempotencyKey: `PAYMENT_PAID:${payment._id}`')
  );

  check(
    'DB-001 idempotency key for order completion credit',
    orderService.includes('idempotencyKey: `ORDER_COMPLETE:${updatedOrder._id}`')
  );

  check(
    'DB-001 idempotency key for payout reject refund',
    adminController.includes('PAYOUT_REJECT_REFUND:')
  );

  check(
    'DB-001 unique partial index on idempotencyKey',
    includesAll(walletTxModel, ['uniq_wallet_tx_idempotencyKey', 'idempotencyKey', 'unique: true', 'partialFilterExpression'])
  );
}

function main() {
  runDb001Checks();

  if (failed > 0) {
    console.error(`\nConcurrency controls test failed: ${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nConcurrency controls test passed.');
}

main();
