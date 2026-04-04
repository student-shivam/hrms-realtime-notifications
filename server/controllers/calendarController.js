const Holiday = require('../models/Holiday');
const Leave = require('../models/Leave');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const mongoose = require('mongoose');

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const setTimeOnDate = (baseDate, sourceDate) => {
  if (!sourceDate) return null;
  const nextDate = new Date(baseDate);
  const source = new Date(sourceDate);
  nextDate.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  return nextDate;
};

// @desc    Get unified calendar data
// @route   GET /api/calendar
// @access  Private
exports.getCalendarData = async (req, res) => {
  try {
    const holidays = await Holiday.find();
    
    const query = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const leaves = await Leave.find({ ...query, status: 'Approved' });
    
    const taskQuery = req.user.role === 'admin' ? {} : { assignedTo: req.user.id };
    const tasks = await Task.find({ ...taskQuery, deadline: { $exists: true } });

    res.status(200).json({
      success: true,
      data: {
        holidays: holidays.map(h => ({ title: h.name, date: h.date, type: 'holiday' })),
        leaves: leaves.map(l => ({ title: `Leave: ${l.reason}`, start: l.fromDate, end: l.toDate, type: 'leave' })),
        tasks: tasks.map(t => ({ title: `Task: ${t.title}`, date: t.deadline, type: 'task' }))
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Move calendar event
// @route   PATCH /api/calendar/events/:type/:id/move
// @access  Private
exports.moveCalendarEvent = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { date } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    const nextDate = new Date(date);
    if (Number.isNaN(nextDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Valid target date is required' });
    }

    const normalizedDate = startOfDay(nextDate);
    let updatedEvent = null;

    if (type === 'attendance') {
      const attendance = await Attendance.findById(id);
      if (!attendance) {
        return res.status(404).json({ success: false, message: 'Attendance record not found' });
      }

      if (req.user.role !== 'admin' && String(attendance.userId) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this attendance event' });
      }

      attendance.date = normalizedDate;
      attendance.checkIn = setTimeOnDate(normalizedDate, attendance.checkIn);
      attendance.checkOut = setTimeOnDate(normalizedDate, attendance.checkOut);
      await attendance.save();
      updatedEvent = attendance;
    } else if (type === 'leave') {
      const leave = await Leave.findById(id);
      if (!leave) {
        return res.status(404).json({ success: false, message: 'Leave event not found' });
      }

      if (req.user.role !== 'admin' && String(leave.userId) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to move this leave event' });
      }

      const originalStart = startOfDay(leave.fromDate);
      const durationMs = startOfDay(leave.toDate).getTime() - originalStart.getTime();

      leave.fromDate = normalizedDate;
      leave.toDate = new Date(normalizedDate.getTime() + durationMs);
      await leave.save();
      updatedEvent = leave;
    } else if (type === 'holiday') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admins can move holiday events' });
      }

      const holiday = await Holiday.findById(id);
      if (!holiday) {
        return res.status(404).json({ success: false, message: 'Holiday event not found' });
      }

      holiday.date = normalizedDate;
      await holiday.save();
      updatedEvent = holiday;
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported event type' });
    }

    res.status(200).json({
      success: true,
      data: updatedEvent
    });
  } catch (error) {
    console.error('moveCalendarEvent error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
