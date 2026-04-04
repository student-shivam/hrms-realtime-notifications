const express = require('express');
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMonthlyReport,
  getAttendanceHistory,
  getLiveAttendanceSnapshot
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/checkin', checkIn);
router.post('/checkout', checkOut);
router.get('/today', getTodayAttendance);
router.get('/report', getMonthlyReport);
router.get('/live', authorize('admin'), getLiveAttendanceSnapshot);

router.get('/', getAttendanceHistory);

module.exports = router;
