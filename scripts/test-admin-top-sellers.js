const assert = require('assert');

const Order = require('../models/Order');
const pageRepository = require('../repositories/pageRepository');

function findStage(pipeline, key) {
  return pipeline.find((stage) => Object.prototype.hasOwnProperty.call(stage, key));
}

async function captureTopSellerPipeline(limit) {
  const originalAggregate = Order.aggregate;
  let capturedPipeline;
  Order.aggregate = async (pipeline) => {
    capturedPipeline = pipeline;
    return [];
  };

  try {
    await pageRepository.getAdminTopSellers(limit, new Date('2026-06-15T12:00:00.000Z'));
  } finally {
    Order.aggregate = originalAggregate;
  }

  return capturedPipeline;
}

async function main() {
  const pipeline = await captureTopSellerPipeline(7);
  assert(Array.isArray(pipeline), 'getAdminTopSellers must run an aggregation pipeline');

  const match = findStage(pipeline, '$match').$match;
  assert.strictEqual(match.status, 'completed', 'Top sellers must only count completed orders');

  const matchSource = JSON.stringify(match);
  assert(matchSource.includes('completedAt'), 'Top sellers must use completedAt as the month boundary');
  assert(matchSource.includes('createdAt'), 'Top sellers must fall back to createdAt for legacy completed orders');
  assert(matchSource.includes('$gte') && matchSource.includes('$lt'), 'Top sellers must use a bounded monthly window');

  const limitStage = findStage(pipeline, '$limit');
  assert.strictEqual(limitStage.$limit, 7, 'Top sellers should honor the requested limit');

  const project = findStage(pipeline, '$project').$project;
  const nameProjection = JSON.stringify(project.name);
  assert(nameProjection.includes('$trim'), 'Seller display name should trim blank nicknames');
  assert(nameProjection.includes('$sellerInfo.nickname'), 'Seller display name should prefer nickname');
  assert(nameProjection.includes('$sellerInfo.name'), 'Seller display name should fall back to full name');
  assert(nameProjection.includes('Unknown seller'), 'Seller display name should have a final fallback');
  assert.deepStrictEqual(project.rating, { $ifNull: ['$sellerInfo.rating', 0] }, 'Seller rating should default to 0');

  const cappedPipeline = await captureTopSellerPipeline(999);
  assert.strictEqual(findStage(cappedPipeline, '$limit').$limit, 20, 'Top sellers limit should be capped');

  console.log('Admin top sellers test passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
