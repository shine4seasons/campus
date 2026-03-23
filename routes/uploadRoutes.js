const router                         = require('express').Router();
const { protect }                    = require('../middleware/auth');
const { upload, uploadToCloudinary } = require('../middleware/upload');

// POST /api/upload/image — upload ảnh sản phẩm
router.post('/image', protect, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided' });
  }
  try {
    const result = await uploadToCloudinary(req.file.buffer, 'campus-marketplace/products');
    res.json({ success: true, url: result.secure_url });
  } catch (err) {
    console.error('Cloudinary error:', err.message);
    res.status(500).json({ success: false, message: 'Upload failed: ' + err.message });
  }
});

// POST /api/upload/avatar — upload avatar
router.post('/avatar', protect, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided' });
  }
  try {
    const result = await uploadToCloudinary(req.file.buffer, 'campus-marketplace/avatars');
    res.json({ success: true, url: result.secure_url });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Upload failed: ' + err.message });
  }
});

module.exports = router;