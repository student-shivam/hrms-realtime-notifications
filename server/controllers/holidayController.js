const Holiday = require('../models/Holiday');

// @desc    Get holidays
// @route   GET /api/holidays
// @access  Private
exports.getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort('date');

    res.status(200).json({
      success: true,
      count: holidays.length,
      data: holidays
    });
  } catch (error) {
    console.error('getHolidays error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
