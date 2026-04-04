const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const mongoose = require('mongoose');
const { emitDashboardUpdate } = require('../utils/dashboardStats');

const getDayRange = (dateValue = new Date()) => {
  const start = new Date(dateValue);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const getAttendanceStatus = (attendance) => {
  if (!attendance) return 'Absent';
  if (attendance.checkOut) return 'Checked Out';
  return 'Present';
};

const normalizeRefId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._id ? String(value._id) : String(value);
};

const normalizeEmail = (value) => {
  if (!value || typeof value !== 'string') return null;
  return value.trim().toLowerCase();
};

const formatLiveAttendanceRow = (rosterEntry, attendance) => ({
  _id: attendance?._id || `absent-${rosterEntry.userId || rosterEntry.employeeId || rosterEntry.email}`,
  employeeId: rosterEntry.employeeId || null,
  userId: normalizeRefId(attendance?.userId) || rosterEntry.userId || null,
  employeeName: rosterEntry.name,
  email: rosterEntry.email,
  department: rosterEntry.department,
  date: attendance?.date || new Date(),
  checkIn: attendance?.checkIn || null,
  checkOut: attendance?.checkOut || null,
  status: getAttendanceStatus(attendance),
  totalHours: attendance?.totalHours ?? attendance?.workingHours ?? 0,
  workingHours: attendance?.workingHours ?? 0,
  isLate: attendance?.isLate || false,
  isEarlyLogout: attendance?.isEarlyLogout || false
});

const toPlainAttendance = (attendanceDoc) => {
  if (!attendanceDoc) return null;
  if (typeof attendanceDoc.toObject === 'function') {
    return attendanceDoc.toObject();
  }
  return attendanceDoc;
};

const getTodayAttendanceRecord = async (userId, dateValue = new Date()) => {
  const { start, end } = getDayRange(dateValue);
  return Attendance.findOne({
    userId,
    date: { $gte: start, $lte: end }
  });
};

const buildLiveAttendanceSnapshot = async (dateValue = new Date()) => {
  const safeDate = Number.isNaN(new Date(dateValue).getTime()) ? new Date() : new Date(dateValue);
  const { start, end } = getDayRange(safeDate);

  const [employees, users, attendanceLogs] = await Promise.all([
    Employee.find().sort('name').lean(),
    User.find({ role: 'employee' }).sort('name').lean(),
    Attendance.find({ date: { $gte: start, $lte: end } })
      .populate('userId', 'email')
      .populate('employeeId', 'email name department')
      .lean()
  ]);

  const rosterByEmail = new Map();

  users.forEach((user) => {
    const emailKey = normalizeEmail(user.email);
    if (!emailKey) {
      console.warn(`[ATTENDANCE] Skipping user ${user._id} in live snapshot because email is missing`);
      return;
    }

    rosterByEmail.set(emailKey, {
      userId: String(user._id),
      employeeId: null,
      name: user.name || 'Unknown User',
      email: user.email || '',
      department: 'Unassigned'
    });
  });

  employees.forEach((employee) => {
    const emailKey = normalizeEmail(employee.email);
    if (!emailKey) {
      console.warn(`[ATTENDANCE] Skipping employee ${employee._id} in live snapshot because email is missing`);
      return;
    }

    const existing = rosterByEmail.get(emailKey);
    rosterByEmail.set(emailKey, {
      userId: existing?.userId || null,
      employeeId: String(employee._id),
      name: employee.name || existing?.name || 'Unknown Employee',
      email: employee.email,
      department: employee.department || existing?.department || 'Unassigned'
    });
  });

  const attendanceByEmail = new Map(
    attendanceLogs
      .map((log) => [normalizeEmail(log.employeeId?.email || log.userId?.email || ''), log])
      .filter(([email]) => Boolean(email))
  );
  const attendanceByEmployeeId = new Map(
    attendanceLogs
      .filter((log) => log.employeeId)
      .map((log) => [normalizeRefId(log.employeeId), log])
  );
  const attendanceByUserId = new Map(
    attendanceLogs
      .filter((log) => log.userId)
      .map((log) => [normalizeRefId(log.userId), log])
  );

  const rosterRows = Array.from(rosterByEmail.values()).map((rosterEntry) => {
    const attendance = (rosterEntry.employeeId && attendanceByEmployeeId.get(rosterEntry.employeeId))
      || (rosterEntry.userId && attendanceByUserId.get(rosterEntry.userId))
      || attendanceByEmail.get(normalizeEmail(rosterEntry.email));
    return formatLiveAttendanceRow(rosterEntry, attendance || null);
  });

  const uncoveredAttendanceRows = attendanceLogs
    .filter((log) => {
      const emailKey = normalizeEmail(log.employeeId?.email || log.userId?.email || '');
      const employeeId = normalizeRefId(log.employeeId);
      const userId = normalizeRefId(log.userId);

      return !rosterRows.some((row) => (
        (employeeId && row.employeeId === employeeId)
        || (userId && row.userId === userId)
        || (emailKey && normalizeEmail(row.email) === emailKey)
      ));
    })
    .map((log) => formatLiveAttendanceRow({
      employeeId: normalizeRefId(log.employeeId),
      userId: normalizeRefId(log.userId),
      name: log.employeeId?.name || log.userId?.name || 'Unknown Employee',
      email: log.employeeId?.email || log.userId?.email || '',
      department: log.employeeId?.department || 'Unassigned'
    }, log));

  return [...rosterRows, ...uncoveredAttendanceRows];
};

const resolveEmployeeRecord = async (user) => {
  let employee = await Employee.findOne({ email: user.email });

  if (!employee && user.role === 'employee') {
    employee = await Employee.create({
      name: user.name,
      email: user.email,
      department: 'Unassigned',
      salary: 0
    });
  }

  return employee;
};

const emitAttendanceUpdate = async (req, attendance, action) => {
  const io = req.app.get('io');
  const userSockets = req.app.get('userSockets');
  if (!io) {
    console.warn('[ATTENDANCE] Socket server unavailable, skipping attendance broadcast');
    return;
  }

  const snapshot = await buildLiveAttendanceSnapshot(attendance.date);
  const liveRecord = snapshot.find((item) => String(item.userId) === String(attendance.userId))
    || snapshot.find((item) => String(item.employeeId) === String(attendance.employeeId));

  const payload = {
    action,
    date: attendance.date,
    record: liveRecord,
    snapshot
  };

  io.to('admins').emit('attendance:update', payload);
  io.emit('attendanceUpdate', payload);

  const employeeSocketId = userSockets.get(String(attendance.userId));
  if (employeeSocketId) {
    io.to(employeeSocketId).emit('attendance:self:update', {
      action,
      attendance: liveRecord || attendance
    });
  }

  await emitDashboardUpdate(req, `attendance:${action}`);
};

// @desc    Check In
// @route   POST /api/attendance/checkin
// @access  Private
exports.checkIn = async (req, res, next) => {
  try {
    const { start } = getDayRange();
    const employee = await resolveEmployeeRecord(req.user);
    if (!employee?._id) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile could not be resolved for attendance'
      });
    }

    const existingAttendance = await getTodayAttendanceRecord(req.user.id, start);

    if (existingAttendance && !existingAttendance.checkOut) {
      return res.status(400).json({ 
        success: false, 
        message: 'You are already checked in for today' 
      });
    }

    if (existingAttendance && existingAttendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already completed for today'
      });
    }

    const { location } = req.body || {};
    const safeLocation = location && typeof location === 'object'
      ? {
          lat: typeof location.lat === 'number' ? location.lat : undefined,
          lng: typeof location.lng === 'number' ? location.lng : undefined,
          address: typeof location.address === 'string' ? location.address : undefined
        }
      : undefined;
    
    const attendance = new Attendance({
      userId: req.user.id,
      employeeId: employee._id,
      date: start,
      checkIn: new Date(),
      status: 'Present',
      location: safeLocation
    });

    // Detect Late Login (Threshold 9:05 AM)
    const checkInTime = attendance.checkIn;
    const threshLate = new Date(start);
    threshLate.setHours(9, 5, 0, 0);
    if (checkInTime > threshLate) {
      attendance.isLate = true;
    }

    await attendance.save();
    const attendanceData = toPlainAttendance(attendance);
    await emitAttendanceUpdate(req, attendanceData, 'check-in');

    res.status(201).json({
      success: true,
      data: attendanceData
    });
  } catch (error) {
    console.error('checkIn error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'You are already checked in for today' });
    }
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Check Out
// @route   POST /api/attendance/checkout
// @access  Private
exports.checkOut = async (req, res, next) => {
  try {
    const { start } = getDayRange();
    const attendance = await getTodayAttendanceRecord(req.user.id, start);

    if (!attendance) {
      return res.status(400).json({ 
        success: false, 
        message: 'No check-in record found for today' 
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already checked out for today' 
      });
    }

    attendance.checkOut = new Date();
    
    // Detect Early Logout (Threshold 5:00 PM)
    const threshEarly = new Date(start);
    threshEarly.setHours(17, 0, 0, 0);
    if (attendance.checkOut < threshEarly) {
      attendance.isEarlyLogout = true;
    }

    // Calculate working hours
    const diff = attendance.checkOut - attendance.checkIn;
    attendance.workingHours = parseFloat((diff / (1000 * 60 * 60)).toFixed(2));
    attendance.totalHours = attendance.workingHours;
    attendance.status = 'Checked Out';

    await attendance.save();
    const attendanceData = toPlainAttendance(attendance);
    await emitAttendanceUpdate(req, attendanceData, 'check-out');

    res.status(200).json({
      success: true,
      data: attendanceData
    });
  } catch (error) {
    console.error('checkOut error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get today's attendance status
// @route   GET /api/attendance/today
// @access  Private
exports.getTodayAttendance = async (req, res, next) => {
  try {
    const attendance = await getTodayAttendanceRecord(req.user.id);

    res.status(200).json({
      success: true,
      data: attendance ? toPlainAttendance(attendance) : null
    });
  } catch (error) {
    console.error('getTodayAttendance error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get monthly attendance report
// @route   GET /api/attendance/report
// @access  Private
exports.getMonthlyReport = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const attendance = await Attendance.find({
      userId: req.user.id,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    }).sort('date');

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    console.error('getMonthlyReport error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// Original markAttendance kept for compatibility if needed, but updated to use new logic
exports.markAttendance = exports.checkIn;

// @desc    Get attendance history
// @route   GET /api/attendance
// @access  Private
exports.getAttendanceHistory = async (req, res, next) => {
  try {
    const { date } = req.query;
    let query;

    // Allow admins to view everyone's or a specific user's history
    if (req.user.role === 'admin') {
      if (req.query.userId) {
         if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
           return res.status(400).json({ success: false, message: 'Invalid employee user id' });
         }
         query = { userId: req.query.userId };
      } else {
         query = {};
      }
    } else {
      // Normal employees can only view their own history
      query = { userId: req.user.id };
    }

    if (date) {
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date filter' });
      }
      const { start, end } = getDayRange(parsedDate);
      query.date = { $gte: start, $lte: end };
    }

    const attendance = await Attendance.find(query)
      .populate('userId', 'name email')
      .populate('employeeId', 'name email department')
      .sort('-date');

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    console.error('getAttendanceHistory error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get live attendance snapshot for admin
// @route   GET /api/attendance/live
// @access  Private (Admin only)
exports.getLiveAttendanceSnapshot = async (req, res, next) => {
  try {
    console.log(`[ATTENDANCE] Live snapshot requested by user=${req.user?._id} date=${req.query.date || 'today'}`);
    const date = req.query.date ? new Date(req.query.date) : new Date();
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date filter' });
    }
    const snapshot = await buildLiveAttendanceSnapshot(date);

    res.status(200).json({
      success: true,
      count: snapshot.length,
      data: snapshot
    });
  } catch (error) {
    console.error('getLiveAttendanceSnapshot error:', error);
    res.status(500).json({ success: false, message: 'Failed to load live attendance snapshot' });
  }
};
