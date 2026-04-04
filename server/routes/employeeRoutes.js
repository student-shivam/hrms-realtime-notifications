const express = require('express');
const {
  addEmployee,
  getEmployees,
  updateEmployee,
  deleteEmployee,
  uploadDocument,
  getMyDocuments,
  getMyProfile,
  getMySalarySlip
} = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/authMiddleware');
const uploadDoc = require('../middleware/uploadDoc');

const router = express.Router();

// Apply protect middleware to all employee routes
router.use(protect);

// Employee specific route
router.get('/my/profile', getMyProfile);
router.get('/my/documents', getMyDocuments);
router.get('/my/salary-slip', getMySalarySlip);

// Admin / Core Employee management routes
router.route('/')
  .get(getEmployees)
  .post(authorize('admin'), addEmployee);

router.route('/:id')
  .put(authorize('admin'), updateEmployee)
  .delete(authorize('admin'), deleteEmployee);

// Admin route to attach documents to employees
router.post('/:id/documents', authorize('admin'), uploadDoc.single('document'), uploadDocument);

module.exports = router;
