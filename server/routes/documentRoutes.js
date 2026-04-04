const express = require('express');
const {
  generateOfferLetter,
  uploadDocument,
  getMyDocuments,
  getEmployeeDocuments,
  deleteDocument,
  previewDocument,
  downloadDocument
} = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const uploadDoc = require('../middleware/uploadDoc');

const router = express.Router();

router.use(protect);

router.post('/generate-offer', authorize('admin'), generateOfferLetter);
router.post('/upload', uploadDoc.single('file'), uploadDocument);
router.get('/my', getMyDocuments);
router.get('/preview/:id', previewDocument);
router.get('/download/:id', downloadDocument);
router.delete('/:id', deleteDocument);
router.get('/:employeeId', getEmployeeDocuments);

module.exports = router;
