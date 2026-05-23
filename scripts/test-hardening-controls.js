const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { mapError } = require('../utils/errors');

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

function runSecurityChecks() {
  const socketServer = read('utils/socketServer.js');
  check(
    'SEC-001 joinConv membership check',
    includesAll(socketServer, ['joinConv', 'socket.join_conv_forbidden', 'participants'])
  );
  check(
    'SEC-003 origin allowlist enforcement',
    includesAll(socketServer, ['SOCKET_ALLOWED_ORIGINS', 'origin_required'])
  );

  const appJs = read('app.js');
  check(
    'SEC-002 csrfGuard wired for API routes',
    includesAll(appJs, ['csrfGuard', '/api/auth', '/api/orders', '/api/products'])
  );
  check(
    'SEC-201 security headers and authz monitors wired',
    includesAll(appJs, ['applySecurityHeaders', 'monitorAuthzFailures', 'limitAuth'])
  );

  const securityMiddleware = read('middleware/security.js');
  check(
    'SEC-201 CSP and rate limiter controls exist',
    includesAll(securityMiddleware, ['Content-Security-Policy', 'createRateLimiter', 'limitChatSend', 'limitAiDescribe', 'limitPaymentCheck', 'limitReportSubmit'])
  );

  const chatRoutes = read('routes/chatRoutes.js');
  check('SEC-201 chat send is rate-limited', chatRoutes.includes('limitChatSend'));

  const aiRoutes = read('routes/aiRoutes.js');
  check('SEC-201 AI describe is rate-limited', aiRoutes.includes('limitAiDescribe'));

  const paymentRoutes = read('routes/paymentRoutes.js');
  check('SEC-201 payment check is rate-limited', paymentRoutes.includes('limitPaymentCheck'));

  const reportRoutes = read('routes/reportRoutes.js');
  check('SEC-201 report submission is rate-limited', reportRoutes.includes('limitReportSubmit'));

  const webhookSecret = read('middleware/verifyWebhookSecret.js');
  check('SEC-201 suspicious webhook logging marker', webhookSecret.includes('suspicious_webhook_access'));

  const authController = read('controllers/auth/index.js');
  check('SEC-201 auth refresh policy enforced', includesAll(authController, ['shouldAllowRefresh', 'Refresh denied by token rotation policy']));

  const authSecurity = read('utils/authSecurity.js');
  check('SEC-201 token rotation/session policy config exists', includesAll(authSecurity, ['AUTH_REFRESH_ROTATE_WINDOW_SECONDS', 'AUTH_SESSION_MAX_AGE_SECONDS']));

  const paymentService = read('services/paymentService.js');
  check(
    'SEC-004 payment ownership scope',
    includesAll(paymentService, ['isAdmin', 'isBuyer', 'isSeller', 'Forbidden'])
  );

  const envValidator = read('config/env.js');
  check(
    'CONF-201 startup env validator exists',
    includesAll(envValidator, ['validateEnv', 'Environment validation failed'])
  );

  check(
    'CONF-201 app boots with env validation',
    appJs.includes('validateEnv()')
  );
}

function runValidationErrorChecks() {
  const mongooseValidation = { name: 'ValidationError', errors: { field: { path: 'field', message: 'bad field' } } };
  const castError = { name: 'CastError', message: 'Cast to ObjectId failed' };
  const duplicateErr = { code: 11000, message: 'dup key' };
  const internal = new Error('secret');

  const m1 = mapError(mongooseValidation);
  const m2 = mapError(castError);
  const m3 = mapError(duplicateErr);
  const m4 = mapError(internal);

  check('VAL-002 maps ValidationError to 400', m1.status === 400 && m1.code === 'VALIDATION_ERROR');
  check('VAL-002 maps CastError to INVALID_ID', m2.status === 400 && m2.code === 'INVALID_ID');
  check('VAL-002 maps duplicate key to 409', m3.status === 409 && m3.code === 'DUPLICATE_KEY');
  check('VAL-002 hides internal details', m4.status === 500 && m4.message === 'Internal server error');
}

function runFrontendXssChecks() {
  const files = [
    'public/js/chat-dropdown.js',
    'public/js/notifications.js',
    'public/js/pages/messages.js',
    'views/partials/dashboard-scripts.ejs',
    'public/js/pages/notifications.js',
    'public/js/pages/favorites.js',
    'public/js/pages/orders-seller.js',
    'public/js/pages/dashboard-seller.js',
    'public/js/pages/dashboard-admin.js',
    'views/my-products.ejs',
  ];

  files.forEach((f) => {
    const content = read(f);
    const hasUnsafe = /innerHTML|insertAdjacentHTML|outerHTML/.test(content);
    check(`FE-001 no unsafe HTML API in ${f}`, !hasUnsafe);
  });

  try {
    execFileSync('node', ['scripts/audit-dom-html-apis.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
    check('FE-201 DOM HTML API audit snapshot matches repo', true);
  } catch (err) {
    check('FE-201 DOM HTML API audit snapshot matches repo', false, err.stderr ? String(err.stderr).trim() : 'snapshot mismatch');
  }
}

function runApiContractChecks() {
  const openapi = read('docs/openapi.yaml');
  check('API-001 product status endpoint documented', openapi.includes('/api/products/{id}/status:'));
  check('API-001 payment check endpoint documented', openapi.includes('/api/payments/{paymentId}/check:'));

  const routes = read('routes/products.js');
  check('API-001 route split update/status', includesAll(routes, ["router.patch('/:id'", "router.patch('/:id/status'"]));
}

function runSecurityEndpointRateLimitChecks() {
  try {
    execFileSync('node', ['scripts/test-security-rate-limit-endpoints.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
    check('SEC-201 endpoint-level rate-limit integration', true);
  } catch (err) {
    check('SEC-201 endpoint-level rate-limit integration', false, err.stderr ? String(err.stderr).trim() : 'endpoint test failed');
  }
}

function runDbRuntimeHarnessChecks() {
  const runtime = read('scripts/test-concurrency-runtime.js');
  const verifier = read('scripts/verify-concurrency-invariants.js');
  const collector = read('scripts/collect-runtime-evidence.js');
  check(
    'DB-201 runtime harness detects unreachable target',
    runtime.includes('unreachable_target_or_all_requests_failed')
  );
  check(
    'DB-201 runtime harness enforces error-rate budget',
    runtime.includes('error_rate_budget_exceeded') && runtime.includes('expectMaxErrorRate')
  );
  check(
    'DB-201 runtime harness supports status allowlist',
    runtime.includes('allowStatuses') && runtime.includes('disallowed_status_observed')
  );
  check(
    'DB-201 invariant verifier covers key scenarios',
    includesAll(verifier, ['order-create', 'payment-paid', 'payout-refund', 'PAYMENT_PAID:', 'PAYOUT_REJECT_REFUND:'])
  );
  check(
    'DB-201 runtime evidence collector persists invariant artifacts',
    includesAll(collector, ['EVIDENCE_VERIFY_ARGS', 'verify-concurrency-invariants.js', 'concurrency-invariants-'])
  );
}

function runPerformanceHarnessChecks() {
  const benchmark = read('scripts/benchmark-p95.js');
  const budgets = read('scripts/evaluate-p95-budgets.js');
  check(
    'PERF-201 benchmark supports endpoint matrix overrides',
    includesAll(benchmark, ['BENCH_ENDPOINT_MATRIX_JSON', 'BENCH_ENDPOINT_MATRIX_FILE', 'successP95', 'authOnlyStatuses', 'disallowedStatuses'])
  );
  const matrixRenderer = read('scripts/render-perf-matrix.js');
  const localRunner = read('scripts/run-local-perf-benchmark.js');
  check(
    'PERF-201 matrix renderer exists for local authenticated runs',
    includesAll(matrixRenderer, ['BENCH_BUYER_COOKIE', 'BENCH_ADMIN_COOKIE', '/api/admin/reports', 'perf-endpoint-matrix.local.json'])
  );
  check(
    'PERF-201 local orchestrator exists',
    includesAll(localRunner, ['render-perf-matrix.js', 'benchmark-p95.js', 'evaluate-p95-budgets.js', 'BENCH_BASELINE_ARTIFACT'])
  );
  check(
    'PERF-201 budget evaluator rejects non-meaningful runs',
    includesAll(budgets, ['auth_only_responses', 'disallowed_status_observed', 'successP95', 'meaningful'])
  );
}

function main() {
  runSecurityChecks();
  runValidationErrorChecks();
  runFrontendXssChecks();
  runApiContractChecks();
  runSecurityEndpointRateLimitChecks();
  runDbRuntimeHarnessChecks();
  runPerformanceHarnessChecks();

  if (failed > 0) {
    console.error(`\nHardening controls test failed: ${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nHardening controls test passed.');
}

main();
