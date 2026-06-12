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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSearchTokens(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 2)
    .slice(0, 6);
}

function buildKeywordFilter(tokens) {
  if (!tokens.length) return null;

  return {
    $and: tokens.map((token) => {
      const regex = new RegExp(escapeRegExp(token), 'i');
      return {
        $or: [
          { title: regex },
          { description: regex },
          { aiDescription: regex },
          { category: regex },
          { condition: regex },
          { 'location.address': regex }
        ]
      };
    })
  };
}

function buildActiveProductFilter(query, userId, blockedSellerIds = []) {
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

  if (!query.seller) {
    const excludedSellerIds = [...blockedSellerIds];
    if (userId) excludedSellerIds.push(userId);
    if (excludedSellerIds.length) filter.seller = { $nin: excludedSellerIds };
  }

  return filter;
}

async function findProductsForFeed({ query, userId }) {
  const { q, page = 1, limit = 12, sort = '-createdAt' } = query;
  const blockedSellerIds = await User.distinct('_id', { banned: true });

  if (query.seller && blockedSellerIds.some((sellerId) => String(sellerId) === String(query.seller))) {
    return {
      total: 0,
      page: Number(page),
      limit: Number(limit),
      totalPages: 0,
      products: []
    };
  }

  const baseFilter = buildActiveProductFilter(query, userId, blockedSellerIds);
  const normalizedSort = normalizeSort(sort);
  const skip = (Number(page) - 1) * Number(limit);
  const tokens = normalizeSearchTokens(q);
  const keywordFilter = buildKeywordFilter(tokens);
  const countFilter = keywordFilter ? { $and: [baseFilter, keywordFilter] } : baseFilter;

  const cursor = Product.find(countFilter).sort(normalizedSort);

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

function findProductById(productId) {
  return Product.findById(productId);
}

function findProductOwnershipSnapshot(productId) {
  return Product.findById(productId).select('seller status quantity price title').lean();
}

function claimActiveStock({ productId, buyerId, quantity, soldStatus, activeStatus, options = {} }) {
  return Product.findOneAndUpdate(
    {
      _id: productId,
      status: activeStatus,
      seller: { $ne: buyerId },
      $or: [
        { quantity: { $gte: quantity } },
        ...(quantity === 1 ? [{ quantity: { $exists: false } }] : [])
      ]
    },
    [
      {
        $set: {
          quantity: { $subtract: [{ $ifNull: ['$quantity', 1] }, quantity] },
          status: {
            $cond: [
              { $lte: [{ $subtract: [{ $ifNull: ['$quantity', 1] }, quantity] }, 0] },
              soldStatus,
              activeStatus
            ]
          },
          buyer: {
            $cond: [
              { $lte: [{ $subtract: [{ $ifNull: ['$quantity', 1] }, quantity] }, 0] },
              buyerId,
              '$buyer'
            ]
          },
          soldAt: {
            $cond: [
              { $lte: [{ $subtract: [{ $ifNull: ['$quantity', 1] }, quantity] }, 0] },
              new Date(),
              '$soldAt'
            ]
          }
        }
      }
    ],
    { new: true, ...options }
  );
}

function reclaimReservedProduct({ productId, buyerId, quantity, activeStatus, soldStatus }) {
  return Product.findOneAndUpdate(
    { _id: productId, status: activeStatus, quantity: { $gte: quantity } },
    [
      {
        $set: {
          quantity: { $subtract: ['$quantity', quantity] },
          status: {
            $cond: [
              { $lte: [{ $subtract: ['$quantity', quantity] }, 0] },
              soldStatus,
              activeStatus
            ]
          },
          buyer: {
            $cond: [
              { $lte: [{ $subtract: ['$quantity', quantity] }, 0] },
              buyerId,
              '$buyer'
            ]
          },
          soldAt: {
            $cond: [
              { $lte: [{ $subtract: ['$quantity', quantity] }, 0] },
              new Date(),
              '$soldAt'
            ]
          }
        }
      }
    ],
    { new: true }
  );
}

function restoreProductReservation({ productId, quantity, activeStatus, options = {} }) {
  return Product.findByIdAndUpdate(productId, {
    $inc: { quantity: quantity || 1 },
    $set: { status: activeStatus, buyer: null, soldAt: null }
  }, options);
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

async function findProductsBySeller({ sellerId, status, page = 1, limit = 12 }) {
  const filter = { seller: sellerId };
  if (status) filter.status = status;
  const normalizedPage = Number(page);
  const normalizedLimit = Number(limit);
  const skip = (normalizedPage - 1) * normalizedLimit;

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(normalizedLimit)
      .lean()
  ]);

  return {
    products,
    total,
    page: normalizedPage,
    limit: normalizedLimit,
    totalPages: Math.ceil(total / normalizedLimit)
  };
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

async function findFavoritesForUser({ userId, page = 1, limit = 12, q = '' }) {
  const skip = (page - 1) * limit;
  const term = String(q || '').trim().toLowerCase();

  if (term) {
    const favorites = await Favorite.find({ user: userId })
      .sort('-createdAt')
      .populate({
        path: 'product',
        select: 'title price quantity images category condition status seller interested ratingAverage ratingCount soldAt',
        populate: { path: 'seller', select: 'name nickname avatar' }
      })
      .lean();
    const items = favorites
      .filter((favorite) => favorite.product)
      .map((favorite) => ({
        ...favorite.product,
        favoritedAt: favorite.createdAt
      }))
      .filter((product) => {
        const seller = product.seller || {};
        const haystack = [
          product.title,
          product.category,
          product.condition,
          seller.nickname,
          seller.name
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(term);
      });

    return {
      items: items.slice(skip, skip + limit),
      total: items.length
    };
  }

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

function findFavoriteUserIdsByProductId(productId) {
  return Favorite.find({ product: productId }).select('user').lean();
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
  findProductById,
  findProductOwnershipSnapshot,
  claimActiveStock,
  reclaimReservedProduct,
  restoreProductReservation,
  createProductForSeller,
  incrementSellerSalesPlaceholder,
  incrementSellerSales,
  findProductsBySeller,
  findFavoriteByUserAndProduct,
  deleteFavoriteById,
  createFavorite,
  updateInterestedCount,
  findFavoritesForUser,
  findFavoriteIdsForUser,
  findFavoriteUserIdsByProductId
};
