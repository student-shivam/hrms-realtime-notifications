const express = require('express');
const {
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  updateLeaveStatus
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

router.route('/')
  .post(applyLeave)
  .get(getAllLeaves);

router.route('/my')
  .get(getMyLeaves);

router.route('/:id/status')
  .put(authorize('admin'), updateLeaveStatus);

module.exports = router;
