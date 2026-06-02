function makeValidator(source) {
  return (schema) => (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }
    req[source] = parsed.data;
    return next();
  };
}

const validate = makeValidator('body');
const validateBody = validate;
const validateParams = makeValidator('params');
const validateQuery = makeValidator('query');

module.exports = {
  validate,
  validateBody,
  validateParams,
  validateQuery,
};
