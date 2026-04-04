const Leave = require('../models/Leave');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Employee = require('../models/Employee');
const mongoose = require('mongoose');
const { emitDashboardUpdate } = require('../utils/dashboardStats');

// @desc    Apply for leave
// @route   POST /api/leaves
// @access  Private
exports.applyLeave = async (req, res) => {
  try {
    const { fromDate, toDate, reason, leaveType, documentUrl } = req.body;
    
    // 1. Restrict Past Date Selection
    const start = new Date(fromDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (start < today) {
      return res.status(400).json({ success: false, message: 'Cannot apply leave for past dates' });
    }

    // 2. Check Leave Balance
    const employee = await Employee.findOne({ email: req.user.email });
    if (employee && leaveType) {
      const typeKey = leaveType.toLowerCase();
      if (employee.leaveBalance[typeKey] <= 0) {
         return res.status(400).json({ success: false, message: `Insufficient ${leaveType} leave balance` });
      }
    }

    const leave = await Leave.create({
      userId: req.user.id,
      fromDate,
      toDate,
      reason,
      leaveType: leaveType || 'Casual',
      documentUrl,
      status: 'Pending'
    });

    // Notify Admins
    const admins = await User.find({ role: 'admin' });
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');

    for (const admin of admins) {
      const notification = await Notification.create({
        recipient: admin._id,
        message: `${req.user.name} applied for ${leaveType || 'Casual'} leave.`,
        type: 'leave',
        link: '/admin/leaves'
      });

      const adminSocketId = userSockets.get(admin._id.toString());
      if (adminSocketId) {
        io.to(adminSocketId).emit('newNotification', notification);
      }
    }

    await emitDashboardUpdate(req, 'leave:applied');

    res.status(201).json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get my leave status
// @route   GET /api/leaves/my
// @access  Private
exports.getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ userId: req.user.id }).sort('-createdAt');

    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get leaves
// @route   GET /api/leaves
// @access  Private
exports.getAllLeaves = async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const leaves = await Leave.find(query).populate('userId', 'name email').sort('-createdAt');

    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update leave status (Approve/Reject)
// @route   PUT /api/leaves/:id/status
// @access  Private (Admin only)
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { status, managerComments } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
       return res.status(400).json({ success: false, message: 'Invalid status update' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid leave id' });
    }

    let leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    leave.status = status;
    if (managerComments) leave.managerComments = managerComments;
    await leave.save();

    // Deduct leave balance if approved
    if (status === 'Approved') {
       const user = await User.findById(leave.userId);
       const employee = await Employee.findOne({ email: user.email });
       if (employee && leave.leaveType) {
          const typeKey = leave.leaveType.toLowerCase();
          // Calculate multi-days
          const diff = (new Date(leave.toDate) - new Date(leave.fromDate));
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
          
          employee.leaveBalance[typeKey] = Math.max(0, employee.leaveBalance[typeKey] - days);
          await employee.save();
       }
    }

    // Notify the user
    const notification = await Notification.create({
      recipient: leave.userId,
      message: `Your leave request was ${status.toLowerCase()}.`,
      type: 'leave',
      link: '/employee/leaves'
    });

    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    const userSocketId = userSockets.get(leave.userId.toString());
    
    if (userSocketId) {
      io.to(userSocketId).emit('newNotification', notification);
    }

    await emitDashboardUpdate(req, `leave:${status.toLowerCase()}`);

    res.status(200).json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
