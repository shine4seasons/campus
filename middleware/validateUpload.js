const { UPLOAD_ERROR_MESSAGES } = require('../config/uploadConstants');

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function validateUploadRequest(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: UPLOAD_ERROR_MESSAGES.NO_FILE,
      code: 'VALIDATION_ERROR',
    });
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Unsupported image type',
      code: 'VALIDATION_ERROR',
    });
  }

  if (Number(req.file.size || 0) > MAX_IMAGE_SIZE_BYTES) {
    return res.status(400).json({
      success: false,
      message: 'Image exceeds max size (5MB)',
      code: 'VALIDATION_ERROR',
    });
  }

  if (req.body && Object.keys(req.body).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Unexpected metadata fields in upload request',
      code: 'VALIDATION_ERROR',
    });
  }

  return next();
}

module.exports = {
  validateUploadRequest,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
};

