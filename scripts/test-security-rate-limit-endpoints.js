const express = require('express');
const cookieParser = require('cookie-parser');

let failed = 0;

function check(name, cond, detail = '') {
  if (cond) {
    console.log(`[PASS] ${name}`);
    return;
  }
  failed += 1;
  console.error(`[FAIL] ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function hit(url, init = {}) {
  const res = await fetch(url, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, headers: res.headers, body };
}

async function burst(url, count, init) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(await hit(url, init));
  }
  return out;
}

async function main() {
  process.env.RATE_LIMIT_AUTH_MAX = '2';
  process.env.RATE_LIMIT_CHAT_SEND_MAX = '2';
  process.env.RATE_LIMIT_AI_DESCRIBE_MAX = '2';
  process.env.RATE_LIMIT_PAYMENT_CHECK_MAX = '2';
  process.env.RATE_LIMIT_REPORT_SUBMIT_MAX = '2';
  process.env.RATE_LIMIT_AUTH_WINDOW_MS = '60000';
  process.env.RATE_LIMIT_CHAT_SEND_WINDOW_MS = '60000';
  process.env.RATE_LIMIT_AI_DESCRIBE_WINDOW_MS = '60000';
  process.env.RATE_LIMIT_PAYMENT_CHECK_WINDOW_MS = '60000';
  process.env.RATE_LIMIT_REPORT_SUBMIT_WINDOW_MS = '60000';

  const {
    applySecurityHeaders,
    monitorAuthzFailures,
    limitAuth,
    limitChatSend,
    limitAiDescribe,
    limitPaymentCheck,
    limitReportSubmit
  } = require('../middleware/security');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(applySecurityHeaders);
  app.use(monitorAuthzFailures);

  app.post('/api/auth/refresh', limitAuth, (req, res) => res.status(401).json({ success: false }));
  app.post('/api/chat/:id/messages', limitChatSend, (req, res) => res.json({ success: true }));
  app.post('/api/ai/describe', limitAiDescribe, (req, res) => res.json({ success: true }));
  app.get('/api/payments/:paymentId/check', limitPaymentCheck, (req, res) => res.json({ success: true }));
  app.post('/api/report', limitReportSubmit, (req, res) => res.json({ success: true }));

  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const refreshHits = await burst(`${base}/api/auth/refresh`, 3, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    check('SEC-201 auth refresh endpoint rate-limits', refreshHits[2].status === 429, `status=${refreshHits[2].status}`);
    check('SEC-201 auth refresh sets Retry-After', Boolean(refreshHits[2].headers.get('retry-after')));

    const chatHits = await burst(`${base}/api/chat/abc/messages`, 3, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    check('SEC-201 chat send endpoint rate-limits', chatHits[2].status === 429, `status=${chatHits[2].status}`);

    const aiHits = await burst(`${base}/api/ai/describe`, 3, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    check('SEC-201 AI describe endpoint rate-limits', aiHits[2].status === 429, `status=${aiHits[2].status}`);

    const paymentHits = await burst(`${base}/api/payments/p1/check`, 3, { method: 'GET' });
    check('SEC-201 payment check endpoint rate-limits', paymentHits[2].status === 429, `status=${paymentHits[2].status}`);

    const reportHits = await burst(`${base}/api/report`, 3, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    check('SEC-201 report submit endpoint rate-limits', reportHits[2].status === 429, `status=${reportHits[2].status}`);

    check(
      'SEC-201 endpoint responses include CSP header',
      (refreshHits[0].headers.get('content-security-policy') || '').includes("default-src 'self'")
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  if (failed > 0) {
    console.error(`\nSecurity rate-limit endpoint test failed: ${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nSecurity rate-limit endpoint test passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
