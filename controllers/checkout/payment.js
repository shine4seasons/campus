const paymentService = require('../../services/paymentService');
const logger = require('../../utils/logger');

exports.getPaymentStatus = async (req, res, next) => {
  try {
    const data = await paymentService.getPaymentStatus({
      paymentId: req.params.id,
      buyerId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

exports.webhook = async (req, res, next) => {
  try {
    const result = await paymentService.webhook({
      paymentCode: req.body.paymentCode,
      amount: req.body.amount,
      status: req.body.status
    });

    if (result && result.alreadyProcessed) {
      return res.json({ success: true, message: 'Already processed' });
    }
    return res.json({ success: true });
  } catch (err) {
    if ((err.status || 500) === 500) {
      logger.error('payment.webhook_failed', {
        err: err.message,
        stack: err.stack
      });
    }
    return next(err);
  }
};

exports.checkPaymentViaSePay = async (req, res, next) => {
  try {
    const data = await paymentService.checkPaymentViaSePay({
      paymentId: req.params.paymentId,
      actor: req.user
    });
    return res.json(data);
  } catch (err) {
    if (err.payload) {
      return res.status(err.status || 500).json(err.payload);
    }
    logger.error('payment.check_failed', {
      err: err.message,
      stack: err.stack,
      paymentId: req.params.paymentId
    });
    return next(err);
  }
};
