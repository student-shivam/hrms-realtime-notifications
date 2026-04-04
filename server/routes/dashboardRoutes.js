const express = require('express');
const {
  getDashboardStats,
  getAdminDashboard,
  getEmployeeDashboard
} = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/stats', authorize('admin'), getDashboardStats);
router.get('/admin', authorize('admin'), getAdminDashboard);
router.get('/employee', getEmployeeDashboard);

module.exports = router;
