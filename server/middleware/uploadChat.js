const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../uploads/chat');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    cb(null, `chat-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const allowedExt = /jpg|jpeg|png|pdf|doc|docx/;
const allowedMime = /image\/jpeg|image\/jpg|image\/png|application\/pdf|application\/msword|application\/vnd.openxmlformats-officedocument.wordprocessingml.document/;

const fileFilter = (req, file, cb) => {
  const hasExt = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const hasMime = allowedMime.test(file.mimetype.toLowerCase());

  if (hasExt && hasMime) {
    return cb(null, true);
  }

  return cb(new Error('Only JPG, PNG, PDF, DOC, and DOCX files are allowed'));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});
