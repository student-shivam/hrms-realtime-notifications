const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');
const { fetchDashboardStats } = require('../utils/dashboardStats');

// @desc    Get admin dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private (Admin only)
exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await fetchDashboardStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminDashboard = exports.getDashboardStats;

// @desc    Get employee dashboard stats
// @route   GET /api/dashboard/employee
// @access  Private
exports.getEmployeeDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Attendance summary
    const daysPresent = await Attendance.countDocuments({ userId, status: 'Present' });
    const daysAbsent = await Attendance.countDocuments({ userId, status: 'Absent' });

    // Validate today's presence
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingAttendance = await Attendance.findOne({ userId, date: today });
    const isAttendanceMarkedToday = !!existingAttendance;

    // Task summary
    const pendingTasks = await Task.countDocuments({ assignedTo: userId, status: 'Pending' });
    const completedTasks = await Task.countDocuments({ assignedTo: userId, status: 'Completed' });

    // Leave summary
    const approvedLeaves = await Leave.countDocuments({ userId, status: 'Approved' });
    const pendingLeaves = await Leave.countDocuments({ userId, status: 'Pending' });

    // Fetch Employee record for salary and leave balance
    const employee = await Employee.findOne({ email: req.user.email });
    
    const recentNotifications = await Notification.find({ recipient: userId })
      .sort('-createdAt')
      .limit(5);

    // Calculate today's working hours if checked in
    let todayWorkingHours = 0;
    if (existingAttendance && existingAttendance.checkIn) {
      if (existingAttendance.checkOut) {
        todayWorkingHours = existingAttendance.workingHours;
      } else {
        const diff = new Date() - new Date(existingAttendance.checkIn);
        todayWorkingHours = parseFloat((diff / (1000 * 60 * 60)).toFixed(2));
      }
    }

    res.status(200).json({
      success: true,
      data: {
        attendance: { 
          daysPresent, 
          daysAbsent, 
          isAttendanceMarkedToday, 
          todayWorkingHours,
          todayStatus: existingAttendance ? existingAttendance.status : 'Absent'
        },
        tasks: { pendingTasks, completedTasks },
        leaves: { 
          approvedLeaves, 
          pendingLeaves,
          balance: employee ? employee.leaveBalance : { sick: 0, casual: 0, paid: 0 }
        },
        salary: employee ? {
          base: employee.salary,
          details: employee.salaryDetails
        } : null,
        notifications: recentNotifications
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
