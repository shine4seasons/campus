const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    });
  }
  req.body = parsed.data;
  return next();
};

module.exports = { validate };
