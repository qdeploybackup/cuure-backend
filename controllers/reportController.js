const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { summarizeReport } = require('../services/geminiService');

const ALLOWED_MIMETYPES = [
  'application/pdf',
  'image/png',
  'image/jpg',
  'image/jpeg',
  'image/webp'
];

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${sanitized}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, PNG, JPG, JPEG, and WEBP are allowed.'), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

const uploadReport = [
  upload.single('report'),
  async (req, res) => {
    const filePath = req.file ? req.file.path : null;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const { path: fp, mimetype, originalname } = req.file;

      const summary = await summarizeReport(fp, mimetype, originalname);

      // Delete the local file after processing
      try { fs.unlinkSync(fp); } catch (e) { /* ignore */ }

      if (!summary) {
        return res.status(422).json({
          error: "We couldn't read enough information from this file. Please upload a clearer report or image."
        });
      }

      res.json({ summary, filename: originalname, mimetype });
    } catch (error) {
      console.error('Report upload error:', error);
      // Cleanup on error too
      if (filePath) try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }

      if (error.message?.includes('Invalid file type')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 20MB.' });
      }
      if (error.status === 429 || (error.message && error.message.includes('429'))) {
        return res.status(429).json({ error: 'Our system is currently receiving too many requests or the API quota is exceeded. Please try again later.' });
      }

      res.status(500).json({ error: "We couldn't summarize the report right now. Please try again." });
    }
  }
];

module.exports = { uploadReport };
