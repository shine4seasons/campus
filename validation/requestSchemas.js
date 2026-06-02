const { z } = require('zod');
const {
  ORDER_ROLES,
  ORDER_STATUS,
  PRODUCT_CATEGORIES,
  PRODUCT_CONDITIONS,
  PRODUCT_STATUS,
  PAYOUT_STATUS
} = require('../config/appConstants');

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid object id');
const idParamSchema = z.object({ id: objectIdSchema }).strict();
const paymentIdParamSchema = z.object({ paymentId: objectIdSchema }).strict();

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
}).strict();

const searchPaginationQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(120).optional().default(''),
});

const productFeedQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
  sort: z.enum(['newest', '-createdAt', 'createdAt', 'price-asc', 'price', 'price-desc', '-price', 'rating', '-ratingAverage']).optional().default('-createdAt'),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  condition: z.enum(PRODUCT_CONDITIONS).optional(),
  seller: objectIdSchema.optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
}).strict().refine((query) => (
  query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice
), {
  message: 'minPrice must be less than or equal to maxPrice',
  path: ['minPrice'],
});

const productSellerQuerySchema = z.object({
  status: z.enum(Object.values(PRODUCT_STATUS)).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
}).strict();

const favoriteQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
}).strict();

const orderListQuerySchema = z.object({
  role: z.enum(Object.values(ORDER_ROLES)).optional().default(ORDER_ROLES.BUYER),
  status: z.enum(Object.values(ORDER_STATUS)).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
}).strict();

const orderRoleQuerySchema = z.object({
  role: z.enum(Object.values(ORDER_ROLES)).optional().default(ORDER_ROLES.BUYER),
}).strict();

const orderAnalyticsQuerySchema = z.object({
  role: z.enum(Object.values(ORDER_ROLES)).optional().default(ORDER_ROLES.SELLER),
}).strict();

const ratingEntityQuerySchema = z.object({
  entityType: z.enum(['product', 'user']),
  entityId: objectIdSchema,
}).strict();

const notificationsQuerySchema = z.object({
  filter: z.enum(['all', 'unread', 'read', 'system', 'order', 'message', 'rating']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
}).strict();

const adminUsersQuerySchema = searchPaginationQuerySchema.extend({
  status: z.enum(['active', 'banned']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
}).strict();

const adminOrdersQuerySchema = z.object({
  status: z.enum(Object.values(ORDER_STATUS)).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
}).strict();

const adminProductsQuerySchema = searchPaginationQuerySchema.extend({
  status: z.enum([...Object.values(PRODUCT_STATUS), 'reported']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
}).strict();

const adminReportsQuerySchema = searchPaginationQuerySchema.extend({
  status: z.enum(['all', 'pending', 'under-review', 'resolved', 'dismissed']).optional(),
}).strict();

const adminPayoutsQuerySchema = searchPaginationQuerySchema.extend({
  status: z.enum(['ALL', ...Object.values(PAYOUT_STATUS)]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
}).strict();

module.exports = {
  objectIdSchema,
  idParamSchema,
  paymentIdParamSchema,
  paginationQuerySchema,
  productFeedQuerySchema,
  productSellerQuerySchema,
  favoriteQuerySchema,
  orderListQuerySchema,
  orderRoleQuerySchema,
  orderAnalyticsQuerySchema,
  ratingEntityQuerySchema,
  notificationsQuerySchema,
  adminUsersQuerySchema,
  adminOrdersQuerySchema,
  adminProductsQuerySchema,
  adminReportsQuerySchema,
  adminPayoutsQuerySchema,
};
