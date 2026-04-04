const express = require('express');
const { getCalendarData, moveCalendarEvent } = require('../controllers/calendarController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getCalendarData);
router.patch('/events/:type/:id/move', moveCalendarEvent);

module.exports = router;
