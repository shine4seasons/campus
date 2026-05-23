const router = require('express').Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const { upload, uploadToCloudinary } = require('../middleware/upload');
const { validateUploadRequest } = require('../middleware/validateUpload');
const { UPLOAD_FOLDERS, UPLOAD_ERROR_MESSAGES } = require('../config/uploadConstants');
const { ValidationError, serviceUnavailable } = require('../utils/errors');

/**
 * Shared upload handler for images
 */
const handleImageUpload = async (req, res, next, folder) => {
  if (!req.file) {
    return next(new ValidationError(UPLOAD_ERROR_MESSAGES.NO_FILE));
  }

  try {
    const result = await uploadToCloudinary(req.file.buffer, folder);
    res.json({
      success: true,
      url: result.secure_url
    });
  } catch (error) {
    console.error('Upload error:', folder, error.message);
    return next(serviceUnavailable(UPLOAD_ERROR_MESSAGES.UPLOAD_FAILED));
  }
};

function uploadImageRoute(folder) {
  return [
    protect,
    (req, res, next) => {
      upload.single('image')(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return next(new ValidationError('Image exceeds max size (5MB)'));
        }
        return next(new ValidationError(err.message || 'Invalid upload payload'));
      });
    },
    validateUploadRequest,
    (req, res, next) => handleImageUpload(req, res, next, folder)
  ];
}

// POST /api/upload/image - upload product image
router.post('/image', ...uploadImageRoute(UPLOAD_FOLDERS.PRODUCTS));

// POST /api/upload/avatar - upload user avatar
router.post('/avatar', ...uploadImageRoute(UPLOAD_FOLDERS.AVATARS));

// POST /api/upload/chat - upload chat image attachment
router.post('/chat', ...uploadImageRoute(UPLOAD_FOLDERS.CHAT));

module.exports = router;
