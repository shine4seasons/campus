const { z } = require('zod');

function normalizeCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRE: z.string().min(1).default('7d'),

  SERVER_URL: z.string().url('SERVER_URL must be a valid URL'),
  CLIENT_URL: z.string().url('CLIENT_URL must be a valid URL'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  AI_PROVIDER: z.enum(['groq', 'gemini']).default('groq'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  GROQ_VISION_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),

  SEPAY_API_KEY: z.string().optional(),
  SEPAY_API_URL: z.string().url().optional(),
  SEPAY_WEBHOOK_SECRET: z.string().optional(),
  SEPAY_BANK_CODE: z.string().optional(),
  SEPAY_ACCOUNT_NUMBER: z.string().optional(),
  SEPAY_ACCOUNT_NAME: z.string().optional(),
  SEPAY_QR_BANK: z.string().optional(),
  SEPAY_QR_ACC: z.string().optional(),

  SOCKET_ALLOWED_ORIGINS: z.string().optional(),
});

function validateEnv(env = process.env) {
  const parsed = baseSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`).join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  const cfg = parsed.data;
  const isProd = cfg.NODE_ENV === 'production';

  if (isProd) {
    const requiredInProd = [
      ['GOOGLE_CLIENT_ID', cfg.GOOGLE_CLIENT_ID],
      ['GOOGLE_CLIENT_SECRET', cfg.GOOGLE_CLIENT_SECRET],
      ['CLOUDINARY_CLOUD_NAME', cfg.CLOUDINARY_CLOUD_NAME],
      ['CLOUDINARY_API_KEY', cfg.CLOUDINARY_API_KEY],
      ['CLOUDINARY_API_SECRET', cfg.CLOUDINARY_API_SECRET],
      ['SEPAY_API_KEY', cfg.SEPAY_API_KEY],
      ['SEPAY_WEBHOOK_SECRET', cfg.SEPAY_WEBHOOK_SECRET],
    ];
    const missing = requiredInProd.filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      throw new Error(`Environment validation failed: missing required production variables: ${missing.join(', ')}`);
    }

    const origins = normalizeCsv(cfg.SOCKET_ALLOWED_ORIGINS || cfg.CLIENT_URL);
    if (!origins.length) {
      throw new Error('Environment validation failed: SOCKET_ALLOWED_ORIGINS (or CLIENT_URL) is required in production');
    }
  }

  if (cfg.AI_PROVIDER === 'groq' && !cfg.GROQ_API_KEY && cfg.NODE_ENV !== 'test') {
    throw new Error('Environment validation failed: GROQ_API_KEY is required when AI_PROVIDER=groq');
  }
  if (cfg.AI_PROVIDER === 'gemini' && !cfg.GEMINI_API_KEY && cfg.NODE_ENV !== 'test') {
    throw new Error('Environment validation failed: GEMINI_API_KEY is required when AI_PROVIDER=gemini');
  }

  return cfg;
}

module.exports = {
  validateEnv,
};
