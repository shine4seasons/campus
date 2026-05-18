const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  availableBalance: { type: Number, default: 0 },
  pendingBalance: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Wallet', WalletSchema);
