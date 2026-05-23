const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function assert(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
}

const requiredPaths = [
  'app.js',
  'config/database.js',
  'middleware/csrf.js',
  'utils/errors.js',
  'routes/products.js',
  'routes/paymentRoutes.js',
  'scripts/migrate-indexes.js',
];

for (const rel of requiredPaths) {
  const fullPath = path.join(ROOT, rel);
  assert(fs.existsSync(fullPath), `Missing required file: ${rel}`);
}

const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
assert(appSource.includes('csrfGuard'), 'app.js must register csrfGuard for API routes');
assert(appSource.includes('mapError'), 'app.js must map errors via mapError');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert(pkg.scripts && pkg.scripts['migrate:indexes'], 'package.json must include migrate:indexes');

console.log('Smoke test passed.');
