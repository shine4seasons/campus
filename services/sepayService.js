const axios = require('axios');

const SEPAY_BASE_URL = (process.env.SEPAY_API_URL || 'https://userapi.sepay.vn/v2').replace(/\/+$/, '');
const SEPAY_API_KEY = process.env.SEPAY_API_KEY;
const SEPAY_QR_ACC = process.env.SEPAY_QR_ACC || process.env.SEPAY_ACCOUNT_NUMBER;
const SEPAY_QR_BANK = process.env.SEPAY_QR_BANK || process.env.SEPAY_BANK_CODE || 'BIDV';

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.CI === 'true';
const suppressMissingKeyWarn = process.env.SEPAY_SUPPRESS_WARN === '1';
if (!SEPAY_API_KEY && !isTestEnv && !suppressMissingKeyWarn) {
  console.error('[SePay] CRITICAL: SEPAY_API_KEY is not set in environment variables');
}

const sepayClient = axios.create({
  baseURL: SEPAY_BASE_URL,
  headers: {
    Authorization: `Bearer ${SEPAY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

const TX_CACHE_TTL_MS = 5000;
let txCache = { at: 0, key: '', data: [] };
let txInFlight = null;

const formatError = (action, err) => {
  if (err.response && err.response.data) {
    return `[SePay ${action}] ${JSON.stringify(err.response.data)}`;
  }
  return `[SePay ${action}] ${err.message}`;
};

const getPaymentCode = (order, description) => {
  if (description && /^[A-Z0-9]{6,50}$/.test(description)) {
    return description;
  }
  return `SMP${String(order._id).toUpperCase()}`;
};

exports.createSePayPayment = async (order, amount, description) => {
  try {
    const paymentCode = getPaymentCode(order, description);

    if (!SEPAY_QR_ACC) {
      throw new Error('SEPAY_QR_ACC is not set. Cannot generate SePay QR.');
    }

    const qrParams = new URLSearchParams({
      acc: SEPAY_QR_ACC,
      bank: SEPAY_QR_BANK,
      amount: String(Math.round(Number(amount) || 0)),
      des: paymentCode
    });

    return {
      sepayPaymentId: paymentCode,
      qrUrl: `https://qr.sepay.vn/img?${qrParams.toString()}`,
      referenceCode: paymentCode,
      expiryTime: null,
      bankAccountId: null,
      status: 'PENDING'
    };
  } catch (err) {
    console.error(formatError('CreatePayment', err));
    throw err;
  }
};

exports.getRecentTransactions = async (page = 1, perPage = 100) => {
  try {
    const response = await sepayClient.get('/transactions', {
      params: {
        page,
        per_page: perPage
      }
    });

    if (!response.data || !response.data.data) {
      throw new Error('Invalid transaction response format');
    }

    return response.data.data;
  } catch (err) {
    console.error(formatError('GetTransactions', err));
    throw err;
  }
};

exports.getRecentTransactionsCached = async (page = 1, perPage = 100) => {
  const key = `${page}:${perPage}`;
  const now = Date.now();
  if (txCache.key === key && now - txCache.at < TX_CACHE_TTL_MS) {
    return txCache.data;
  }

  if (txInFlight) {
    return txInFlight;
  }

  txInFlight = exports.getRecentTransactions(page, perPage)
    .then((data) => {
      txCache = { at: Date.now(), key, data };
      return data;
    })
    .finally(() => {
      txInFlight = null;
    });

  return txInFlight;
};

exports.findMatchingTransaction = (payment, transactions) => {
  if (!transactions || !Array.isArray(transactions)) {
    return null;
  }

  for (const tx of transactions) {
    const txAmount = Number(tx.amount_in || tx.amount || 0);
    if (txAmount !== Number(payment.amount)) {
      continue;
    }

    const haystack = [
      tx.reference,
      tx.reference_number,
      tx.description,
      tx.transaction_content,
      tx.transfer_memo,
      tx.code
    ].filter(Boolean).join(' ');

    const needles = [
      payment.paymentCode,
      payment.sepayReferenceCode,
      payment.sepayPaymentId,
      payment.order && String(payment.order._id || payment.order)
    ].filter(Boolean).map(String);

    if (needles.some(needle => haystack.includes(needle))) {
      return tx;
    }
  }

  return null;
};

module.exports = exports;
