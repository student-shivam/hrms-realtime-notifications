const express = require('express');
const { getMySalaryHistory, addSalaryRecord } = require('../controllers/salaryController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/my', getMySalaryHistory);
router.post('/', authorize('admin'), addSalaryRecord);

module.exports = router;
