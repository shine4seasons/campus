const mongoose = require('mongoose');

const WalletTransactionSchema = new mongoose.Schema({
  wallet:        { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:          { type: String, enum: ['DEPOSIT', 'WITHDRAW', 'CREDIT', 'DEBIT', 'WITHDRAWAL'], required: true },
  amount:        { type: Number, required: true },                // positive = credit, negative = debit
  status:        { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'COMPLETED' },
  description:   { type: String, required: true },
  referenceId:   { type: mongoose.Schema.Types.ObjectId, default: null },
  referenceType: { type: String, default: null },  // 'Order', 'PayoutRequest', etc.
  idempotencyKey:{ type: String, default: null }
}, { timestamps: true });

WalletTransactionSchema.index(
  { idempotencyKey: 1 },
  {
    name: 'uniq_wallet_tx_idempotencyKey',
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } }
  }
);

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);
