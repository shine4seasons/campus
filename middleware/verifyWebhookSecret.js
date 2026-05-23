const crypto = require('crypto');

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left), 'utf8');
  const rightBuffer = Buffer.from(String(right), 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = function verifyWebhookSecret(req, res, next) {
  const expectedSecret = process.env.SEPAY_WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.error('[payments] SEPAY_WEBHOOK_SECRET is not configured');
    return res.status(503).json({
      success: false,
      message: 'Webhook is not configured',
    });
  }

  const providedSecret =
    req.get('x-sepay-webhook-secret') ||
    req.get('x-webhook-secret');

  if (!providedSecret || !safeEqual(providedSecret, expectedSecret)) {
    const ip = req.get('x-forwarded-for') || req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    console.warn('[security] suspicious_webhook_access', {
      ip: String(ip).split(',')[0].trim(),
      path: req.originalUrl || req.url,
      method: req.method,
      userAgent
    });
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook signature',
    });
  }

  return next();
};
