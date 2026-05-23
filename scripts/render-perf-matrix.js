const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function read(value, fallback = '') {
  return String(value || fallback || '').trim();
}

function resolveOutPath(filePath) {
  const value = read(filePath, 'docs/perf-endpoint-matrix.local.json');
  return path.isAbsolute(value) ? value : path.join(__dirname, '..', value);
}

function ensureCookie(value, label) {
  const cookie = read(value);
  if (!cookie) {
    throw new Error(`Missing ${label}. Set it in environment before rendering perf matrix.`);
  }
  return cookie;
}

function main() {
  const outPath = resolveOutPath(process.env.BENCH_ENDPOINT_MATRIX_OUTPUT);
  const buyerCookie = ensureCookie(process.env.BENCH_BUYER_COOKIE || process.env.BENCH_COOKIE, 'BENCH_BUYER_COOKIE or BENCH_COOKIE');
  const adminCookie = ensureCookie(process.env.BENCH_ADMIN_COOKIE, 'BENCH_ADMIN_COOKIE');

  const matrix = {
    '/api/products': {
      method: 'GET',
      allowStatuses: ['200'],
      successStatuses: ['200']
    },
    '/api/chat': {
      method: 'GET',
      headers: { cookie: buyerCookie },
      allowStatuses: ['200'],
      successStatuses: ['200']
    },
    '/api/orders': {
      method: 'GET',
      headers: { cookie: buyerCookie },
      allowStatuses: ['200'],
      successStatuses: ['200']
    },
    '/api/admin/reports': {
      method: 'GET',
      headers: { cookie: adminCookie },
      allowStatuses: ['200'],
      successStatuses: ['200']
    }
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    output: path.relative(path.join(__dirname, '..'), outPath),
    endpoints: Object.keys(matrix)
  }, null, 2));
}

main();
