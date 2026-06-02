const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { validate, validateParams, validateQuery } = require('../middleware/validate');
const {
  idParamSchema,
  productFeedQuerySchema,
  productSellerQuerySchema,
  orderListQuerySchema,
  ratingEntityQuerySchema,
} = require('../validation/requestSchemas');
const { emptyBodySchema } = require('../validation/mutateSchemas');

const ROOT = path.join(__dirname, '..');
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`[FAIL] ${name} :: ${err.message}`);
  }
}

function runMiddleware(middleware, req) {
  let statusCode = null;
  let payload = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
      return this;
    },
  };

  middleware(req, res, () => {
    nextCalled = true;
  });

  return { statusCode, payload, nextCalled };
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function assertRouteHas(relPath, routeFragment, middlewareName) {
  const line = read(relPath).split(/\r?\n/).find((item) => item.includes(routeFragment));
  assert(line, `${routeFragment} not found in ${relPath}`);
  assert(line.includes(middlewareName), `${routeFragment} missing ${middlewareName}`);
}

check('VAL-201 body validator accepts empty schema', () => {
  const req = { body: {} };
  const result = runMiddleware(validate(emptyBodySchema), req);
  assert.strictEqual(result.nextCalled, true);
});

check('VAL-201 params validator rejects invalid object id', () => {
  const req = { params: { id: 'not-an-object-id' } };
  const result = runMiddleware(validateParams(idParamSchema), req);
  assert.strictEqual(result.statusCode, 400);
  assert.strictEqual(result.payload.code, 'VALIDATION_ERROR');
});

check('VAL-201 query validator coerces pagination', () => {
  const req = { query: { page: '2', limit: '12', sort: 'price-asc', minPrice: '1000', maxPrice: '5000' } };
  const result = runMiddleware(validateQuery(productFeedQuerySchema), req);
  assert.strictEqual(result.nextCalled, true);
  assert.strictEqual(req.query.page, 2);
  assert.strictEqual(req.query.limit, 12);
  assert.strictEqual(req.query.minPrice, 1000);
});

check('VAL-201 seller product query accepts pagination', () => {
  const req = { query: { page: '1', limit: '12' } };
  const result = runMiddleware(validateQuery(productSellerQuerySchema), req);
  assert.strictEqual(result.nextCalled, true);
  assert.strictEqual(req.query.page, 1);
  assert.strictEqual(req.query.limit, 12);
});

check('VAL-201 query validator rejects invalid role', () => {
  const req = { query: { role: 'owner' } };
  const result = runMiddleware(validateQuery(orderListQuerySchema), req);
  assert.strictEqual(result.statusCode, 400);
  assert.strictEqual(result.payload.code, 'VALIDATION_ERROR');
});

check('VAL-201 rating entity query requires object id', () => {
  const req = { query: { entityType: 'product', entityId: 'bad' } };
  const result = runMiddleware(validateQuery(ratingEntityQuerySchema), req);
  assert.strictEqual(result.statusCode, 400);
});

check('VAL-201 product API validates list query and id params', () => {
  assertRouteHas('routes/products.js', "router.get('/',", 'validateQuery(productFeedQuerySchema)');
  assertRouteHas('routes/products.js', "router.get('/:id'", 'validateParams(idParamSchema)');
  assertRouteHas('routes/products.js', "router.patch('/:id'", 'validateParams(idParamSchema)');
});

check('VAL-201 order API validates list query and id params', () => {
  assertRouteHas('routes/orderApiRoutes.js', "router.get('/',", 'validateQuery(orderListQuerySchema)');
  assertRouteHas('routes/orderApiRoutes.js', "router.get('/:id'", 'validateParams(idParamSchema)');
  assertRouteHas('routes/orderApiRoutes.js', "router.patch('/:id/status'", 'validateParams(idParamSchema)');
});

check('VAL-201 admin API validates queries and moderation ids', () => {
  assertRouteHas('routes/adminApi.js', "router.get('/users'", 'validateQuery(adminUsersQuerySchema)');
  assertRouteHas('routes/adminApi.js', "router.get('/products'", 'validateQuery(adminProductsQuerySchema)');
  assertRouteHas('routes/adminApi.js', "router.patch('/users/:id/ban'", 'validateParams(idParamSchema)');
  assertRouteHas('routes/adminApi.js', "router.post('/payouts/:id/reject'", 'validateParams(idParamSchema)');
});

if (failed > 0) {
  console.error(`\nRequest validation tests failed: ${failed} check(s) failed.`);
  process.exit(1);
}

console.log('\nRequest validation tests passed.');
