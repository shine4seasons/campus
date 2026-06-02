const { z } = require('zod');
const { ORDER_STATUS, DISPUTE_CATEGORIES, DISPUTE_RESOLUTIONS } = require('../config/appConstants');

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid object id');
const emptyBodySchema = z.object({}).strict();

const authUpdateProfileSchema = z.object({
  nickname: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(6).max(30).optional(),
  university: z.string().trim().min(1).max(150).optional(),
  studentId: z.string().trim().min(1).max(50).optional(),
  bio: z.string().trim().max(500).optional(),
  profileComplete: z.boolean().optional(),
  avatar: z.string().url().optional(),
}).strict();

const chatInitSchema = z.object({
  productId: objectIdSchema,
}).strict();

const chatSendMessageSchema = z.object({
  text: z.string().trim().max(5000).optional().default(''),
  imageUrl: z.string().trim().url().optional().or(z.literal('')).or(z.null()),
}).strict();

const createOrderSchema = z.object({
  productId: objectIdSchema,
  quantity: z.coerce.number().int().min(1).optional().default(1),
  deliveryMode: z.enum(['pickup', 'ship']),
  paymentMode: z.enum(['cash', 'qr']),
  note: z.string().max(500).optional().default(''),
  shippingAddress: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(6).max(30),
    street: z.string().trim().min(1).max(255),
    district: z.string().trim().max(120).optional().default(''),
    city: z.string().trim().min(1).max(120),
    lat: z.coerce.number().optional().nullable(),
    lng: z.coerce.number().optional().nullable(),
  }).optional().nullable(),
  pickupLocation: z.object({
    address: z.string().trim().max(255).optional().default(''),
    lat: z.coerce.number().optional().nullable(),
    lng: z.coerce.number().optional().nullable(),
  }).optional().nullable(),
}).strict();

const updateOrderStatusSchema = z.object({
  status: z.enum(Object.values(ORDER_STATUS)),
}).strict();

const openDisputeSchema = z.object({
  category: z.enum(DISPUTE_CATEGORIES).optional().default('other'),
  reason: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default(''),
  evidenceImages: z.array(z.string().url()).max(6).optional().default([]),
}).strict();

const resolveDisputeSchema = z.object({
  resolution: z.enum(Object.values(DISPUTE_RESOLUTIONS)),
  resolutionNote: z.string().trim().max(1000).optional().default(''),
  refund: z.boolean().optional().default(false),
}).strict();

const ratingSubmitSchema = z.object({
  entityType: z.enum(['product', 'user']),
  entityId: objectIdSchema,
  score: z.coerce.number().min(1).max(5),
  comment: z.string().trim().max(500).optional().default(''),
}).strict();

const ratingDeleteSchema = z.object({
  entityType: z.enum(['product', 'user']),
  entityId: objectIdSchema,
}).strict();

const payoutRequestSchema = z.object({
  amount: z.coerce.number().int().min(50000),
  bankInfo: z.object({
    bankName: z.string().trim().min(1).max(120),
    accountNumber: z.string().trim().min(1).max(50),
    accountName: z.string().trim().min(1).max(120),
  }).strict(),
}).strict();

const adminToggleBanSchema = z.object({
  banned: z.boolean(),
}).strict();

const adminUpdateReportSchema = z.object({
  status: z.enum(['pending', 'under-review', 'resolved', 'dismissed']).optional(),
  adminNotes: z.string().trim().max(2000).optional(),
}).strict();

const adminPayoutApproveSchema = z.object({
  adminNote: z.string().trim().max(1000).optional().default(''),
}).strict();

const adminPayoutMarkPaidSchema = z.object({
  adminNote: z.string().trim().max(1000).optional().default(''),
  transferReference: z.string().trim().min(1).max(120),
  transferNote: z.string().trim().max(1000).optional().default(''),
}).strict();

const adminPayoutRejectSchema = z.object({
  adminNote: z.string().trim().min(1).max(1000),
}).strict();

const adminSettingsSchema = z.object({
  platformName: z.string().trim().min(1).max(150).optional(),
  serviceFee: z.coerce.number().min(0).max(100).optional(),
  productImageLimit: z.coerce.number().int().min(1).max(20).optional(),
  supportEmail: z.string().trim().email().optional(),
  announcement: z.string().trim().max(3000).optional().default(''),
}).strict();

const aiDescribeSchema = z.object({
  mode: z.enum(['title', 'description']).optional(),
  title: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
  condition: z.string().trim().max(80).optional(),
  brand: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  color: z.string().trim().max(80).optional(),
  size: z.string().trim().max(80).optional(),
  accessories: z.string().trim().max(300).optional(),
  defects: z.string().trim().max(300).optional(),
  reasonForSelling: z.string().trim().max(200).optional(),
  price: z.coerce.number().nonnegative().optional(),
  location: z.string().trim().max(255).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
  extraNotes: z.string().trim().max(1000).optional(),
  tone: z.string().trim().max(80).optional(),
  language: z.string().trim().max(40).optional(),
  titleLanguage: z.string().trim().max(40).optional(),
  targetWords: z.coerce.number().int().min(60).max(140).optional(),
}).strict();

const paymentWebhookSchema = z.object({
  paymentCode: z.string().trim().min(1).max(120),
  amount: z.coerce.number().positive(),
  status: z.string().trim().min(1).max(40),
}).strict();

const reportCreateSchema = z.object({
  targetType: z.enum(['product', 'user']),
  targetId: objectIdSchema,
  reason: z.enum([
    'inappropriate-content',
    'offensive-language',
    'fraud-scam',
    'counterfeit-item',
    'damaged-item',
    'misleading-description',
    'fake-account',
    'suspicious-behavior',
    'other'
  ]),
  content: z.string().trim().max(2000).optional().default(''),
}).strict();

module.exports = {
  emptyBodySchema,
  authUpdateProfileSchema,
  chatInitSchema,
  chatSendMessageSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  openDisputeSchema,
  resolveDisputeSchema,
  ratingSubmitSchema,
  ratingDeleteSchema,
  payoutRequestSchema,
  adminToggleBanSchema,
  adminUpdateReportSchema,
  adminPayoutApproveSchema,
  adminPayoutMarkPaidSchema,
  adminPayoutRejectSchema,
  adminSettingsSchema,
  aiDescribeSchema,
  paymentWebhookSchema,
  reportCreateSchema,
};

