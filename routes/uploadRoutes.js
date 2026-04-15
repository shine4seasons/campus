const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { upload, uploadToCloudinary } = require('../middleware/upload');
const { UPLOAD_FOLDERS, UPLOAD_ERROR_MESSAGES } = require('../config/uploadConstants');

/**
 * Shared upload handler for images
 */
const handleImageUpload = async (req, res, folder) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: UPLOAD_ERROR_MESSAGES.NO_FILE
    });
  }

  try {
    const result = await uploadToCloudinary(req.file.buffer, folder);
    res.json({
      success: true,
      url: result.secure_url
    });
  } catch (error) {
    console.error('Upload error:', folder, error.message);
    res.status(500).json({
      success: false,
      message: UPLOAD_ERROR_MESSAGES.UPLOAD_FAILED
    });
  }
};

// POST /api/upload/image — upload product image
router.post('/image', protect, upload.single('image'), (req, res) =>
  handleImageUpload(req, res, UPLOAD_FOLDERS.PRODUCTS)
);

// POST /api/upload/avatar — upload user avatar
router.post('/avatar', protect, upload.single('image'), (req, res) =>
  handleImageUpload(req, res, UPLOAD_FOLDERS.AVATARS)
);

module.exports = router;

module.exports = router;