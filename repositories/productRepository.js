const Product = require('../models/Product');
const User = require('../models/User');
const Favorite = require('../models/Favorite');
const { PRODUCT_STATUS } = require('../config/appConstants');

const SORT_MAP = {
  newest: '-createdAt',
  '-createdAt': '-createdAt',
  createdAt: 'createdAt',
  'price-asc': 'price',
  price: 'price',
  'price-desc': '-price',
  '-price': '-price',
  rating: '-ratingAverage',
  '-ratingAverage': '-ratingAverage'
};

function normalizeSort(value) {
  return SORT_MAP[value] || '-createdAt';
}

function buildActiveProductFilter(query, userId) {
  const filter = {
    status: PRODUCT_STATUS.ACTIVE,
    $or: [{ quantity: { $gt: 0 } }, { quantity: { $exists: false } }]
  };

  if (query.category) filter.category = query.category;
  if (query.condition) filter.condition = query.condition;
  if (query.seller) filter.seller = query.seller;
  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }

  if (userId && !query.seller) {
    filter.seller = { $ne: userId };
  }

  return filter;
}

async function findProductsForFeed({ query, userId }) {
  const { q, page = 1, limit = 12, sort = '-createdAt' } = query;
  const baseFilter = buildActiveProductFilter(query, userId);
  const normalizedSort = normalizeSort(sort);
  const skip = (Number(page) - 1) * Number(limit);

  let cursor;
  let countFilter = baseFilter;

  if (q) {
    countFilter = { ...baseFilter, $text: { $search: q } };
    cursor = Product.find(countFilter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } });
  } else {
    cursor = Product.find(baseFilter).sort(normalizedSort);
  }

  const [total, products] = await Promise.all([
    Product.countDocuments(countFilter),
    cursor
      .skip(skip)
      .limit(Number(limit))
      .populate('seller', 'name nickname avatar university rating ratingCount totalSales')
      .lean()
  ]);

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
    products
  };
}

function findProductByIdWithSeller(productId) {
  return Product.findById(productId)
    .populate('seller', 'name nickname avatar university rating ratingCount totalSales createdAt')
    .lean();
}

function createProductForSeller({ sellerId, payload }) {
  return Product.create({
    ...payload,
    seller: sellerId
  });
}

function incrementSellerSalesPlaceholder(userId) {
  return User.findByIdAndUpdate(userId, { $inc: { totalSales: 0 } });
}

function incrementSellerSales(userId, amount) {
  return User.findByIdAndUpdate(userId, { $inc: { totalSales: amount } });
}

function findProductsBySeller({ sellerId, status }) {
  const filter = { seller: sellerId };
  if (status) filter.status = status;
  return Product.find(filter).sort('-createdAt').lean();
}

function findFavoriteByUserAndProduct(userId, productId) {
  return Favorite.findOne({ user: userId, product: productId });
}

function deleteFavoriteById(favoriteId) {
  return Favorite.deleteOne({ _id: favoriteId });
}

function createFavorite(userId, productId) {
  return Favorite.create({ user: userId, product: productId });
}

function updateInterestedCount(productId, delta) {
  return Product.findByIdAndUpdate(productId, { $inc: { interested: delta } }, { new: true });
}

async function findFavoritesForUser({ userId, page = 1, limit = 12 }) {
  const skip = (page - 1) * limit;

  const [favorites, total] = await Promise.all([
    Favorite.find({ user: userId })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'product',
        select: 'title price quantity images category condition status seller interested ratingAverage ratingCount soldAt',
        populate: { path: 'seller', select: 'name nickname avatar' }
      })
      .lean(),
    Favorite.countDocuments({ user: userId })
  ]);

  return {
    items: favorites.filter((favorite) => favorite.product).map((favorite) => ({
      ...favorite.product,
      favoritedAt: favorite.createdAt
    })),
    total
  };
}

async function findFavoriteIdsForUser(userId) {
  const favorites = await Favorite.find({ user: userId }).select('product').lean();
  return favorites.map((favorite) => String(favorite.product));
}

module.exports = {
  normalizeSort,
  buildActiveProductFilter,
  findProductsForFeed,
  findProductByIdWithSeller,
  createProductForSeller,
  incrementSellerSalesPlaceholder,
  incrementSellerSales,
  findProductsBySeller,
  findFavoriteByUserAndProduct,
  deleteFavoriteById,
  createFavorite,
  updateInterestedCount,
  findFavoritesForUser,
  findFavoriteIdsForUser
};
