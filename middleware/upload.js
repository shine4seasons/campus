const multer     = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// Upload bằng base64 — ổn định hơn stream
const uploadToCloudinary = async (buffer, folder = 'campus-marketplace') => {
  const base64    = buffer.toString('base64');
  const mimeType  = 'image/jpeg'; // Cloudinary tự detect
  const dataUri   = `data:${mimeType};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    transformation: [
      { width: 1200, height: 1200, crop: 'limit' },
      { quality: 'auto:good' },
      { fetch_format: 'auto' },
    ],
    timeout: 60000, // 60 giây
  });

  return result;
};

module.exports = { upload, uploadToCloudinary };