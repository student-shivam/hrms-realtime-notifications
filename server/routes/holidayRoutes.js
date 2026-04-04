const express = require('express');
const { getHolidays } = require('../controllers/holidayController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.get('/', getHolidays);

module.exports = router;
