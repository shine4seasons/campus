const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function fail(message) {
  console.error(`[security-check] FAIL: ${message}`);
  process.exit(1);
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

if (!fs.existsSync(path.join(ROOT, '.env.example'))) {
  fail('.env.example is missing');
}

const gitignore = read('.gitignore');
if (!gitignore.includes('.env')) {
  fail('.gitignore must include .env');
}

const app = read('app.js');
if (!app.includes('csrfGuard')) {
  fail('app.js does not include csrfGuard');
}
if (!app.includes('mapError')) {
  fail('app.js does not include mapError');
}
if (!app.includes('validateEnv')) {
  fail('app.js does not include startup validateEnv');
}
if (!app.includes('applySecurityHeaders')) {
  fail('app.js does not include applySecurityHeaders');
}
if (!app.includes('limitAuth')) {
  fail('app.js does not include auth rate limiting');
}

const securityMiddleware = read('middleware/security.js');
if (!securityMiddleware.includes('Content-Security-Policy')) {
  fail('middleware/security.js does not set Content-Security-Policy');
}
if (!securityMiddleware.includes('createRateLimiter')) {
  fail('middleware/security.js does not define createRateLimiter');
}
if (!securityMiddleware.includes('monitorAuthzFailures')) {
  fail('middleware/security.js does not include authz failure monitoring');
}

const paymentRoutes = read('routes/paymentRoutes.js');
if (!paymentRoutes.includes('limitPaymentCheck')) {
  fail('routes/paymentRoutes.js missing limitPaymentCheck middleware');
}

const chatRoutes = read('routes/chatRoutes.js');
if (!chatRoutes.includes('limitChatSend')) {
  fail('routes/chatRoutes.js missing limitChatSend middleware');
}

const reportRoutes = read('routes/reportRoutes.js');
if (!reportRoutes.includes('limitReportSubmit')) {
  fail('routes/reportRoutes.js missing limitReportSubmit middleware');
}

const authController = read('controllers/auth/index.js');
if (!authController.includes('shouldAllowRefresh')) {
  fail('controllers/auth/index.js missing refresh policy guard');
}
if (!authController.includes('Refresh denied by token rotation policy')) {
  fail('controllers/auth/index.js missing refresh policy denial message');
}

const authSecurity = read('utils/authSecurity.js');
if (!authSecurity.includes('AUTH_REFRESH_ROTATE_WINDOW_SECONDS')) {
  fail('utils/authSecurity.js missing AUTH_REFRESH_ROTATE_WINDOW_SECONDS policy');
}
if (!authSecurity.includes('AUTH_SESSION_MAX_AGE_SECONDS')) {
  fail('utils/authSecurity.js missing AUTH_SESSION_MAX_AGE_SECONDS policy');
}

const socketServerPath = path.join(ROOT, 'utils', 'socketServer.js');
if (!fs.existsSync(socketServerPath)) {
  fail('utils/socketServer.js is missing');
}
const socketServer = fs.readFileSync(socketServerPath, 'utf8');
if (!socketServer.includes('SOCKET_ALLOWED_ORIGINS')) {
  fail('socket origin allowlist variable SOCKET_ALLOWED_ORIGINS not found in socketServer');
}

const envValidatorPath = path.join(ROOT, 'config', 'env.js');
if (!fs.existsSync(envValidatorPath)) {
  fail('config/env.js is missing');
}
const envValidator = fs.readFileSync(envValidatorPath, 'utf8');
if (!envValidator.includes('validateEnv')) {
  fail('config/env.js missing validateEnv export');
}
if (!envValidator.includes('Environment validation failed')) {
  fail('config/env.js missing explicit validation failure messages');
}

console.log('[security-check] PASS');
