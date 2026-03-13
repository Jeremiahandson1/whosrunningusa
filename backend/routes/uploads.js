const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'), false);
  }
};

// Configure storage: S3 if credentials exist, otherwise local disk
let upload;
const useS3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET;

if (useS3) {
  const { S3Client } = require('@aws-sdk/client-s3');
  const multerS3 = require('multer-s3');

  const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  upload = multer({
    storage: multerS3({
      s3,
      bucket: process.env.S3_BUCKET,
      key: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `uploads/${uuidv4()}${ext}`);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  });
} else {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });

  upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}

function getFileUrl(file) {
  if (useS3) {
    return file.location; // S3 URL
  }
  return `/uploads/${file.filename}`;
}

// Upload profile picture
router.post('/profile-pic', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = getFileUrl(req.file);

    // Update user profile pic
    await db.query(
      'UPDATE users SET profile_pic_url = $1, updated_at = NOW() WHERE id = $2',
      [imageUrl, req.user.id]
    );

    res.json({ url: imageUrl });
  } catch (error) {
    next(error);
  }
});

// Upload media for posts
router.post('/media', authenticate, upload.array('images', 5), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const urls = req.files.map(f => getFileUrl(f));
    res.json({ urls });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
