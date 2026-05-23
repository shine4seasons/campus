const { z } = require('zod');
const { PRODUCT_CATEGORIES, PRODUCT_CONDITIONS, PRODUCT_STATUS } = require('../config/appConstants');

const locationSchema = z.object({
  address: z.string().trim().max(255).optional(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
}).strict().optional();

const createProductSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  price: z.coerce.number().positive(),
  quantity: z.coerce.number().int().min(1).default(1),
  category: z.enum(PRODUCT_CATEGORIES),
  condition: z.enum(PRODUCT_CONDITIONS),
  images: z.array(z.string().url()).max(5).optional().default([]),
  location: locationSchema,
});

const updateProductSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  price: z.coerce.number().positive().optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  condition: z.enum(PRODUCT_CONDITIONS).optional(),
  images: z.array(z.string().url()).max(5).optional(),
  location: locationSchema,
}).strict();

const updateProductStatusSchema = z.object({
  status: z.enum([PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.HIDDEN]),
}).strict();

module.exports = {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
};
