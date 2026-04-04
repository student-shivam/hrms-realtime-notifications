const Task = require('../models/Task');
const Notification = require('../models/Notification');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Assign a new task
// @route   POST /api/tasks
// @access  Private (Admin only)
exports.assignTask = async (req, res) => {
  try {
    const { title, description, assignedTo, deadline, fileUrl } = req.body;

    const task = await Task.create({
      title,
      description,
      assignedTo,
      deadline,
      fileUrl,
      status: 'Pending'
    });

    // Notify the assigned user
    const notification = await Notification.create({
      recipient: assignedTo,
      message: `New Task Assigned: ${title}`,
      type: 'task',
      link: '/employee/tasks'
    });

    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    const userSocketId = userSockets.get(assignedTo.toString());
    
    if (userSocketId) {
      io.to(userSocketId).emit('newNotification', notification);
    }

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get tasks
// @route   GET /api/tasks
// @access  Private
exports.getTasks = async (req, res) => {
  try {
    let query;

    if (req.user.role === 'admin') {
      if (req.query.assignedTo) {
         query = { assignedTo: req.query.assignedTo };
      } else {
         query = {};
      }
    } else {
      query = { assignedTo: req.user.id };
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update task status / Upload file
// @route   PUT /api/tasks/:id/status
// @access  Private
exports.updateTaskStatus = async (req, res) => {
  try {
    const { status, fileUrl } = req.body;

    if (status && !['Pending', 'In Progress', 'Completed'].includes(status)) {
       return res.status(400).json({ success: false, message: 'Invalid status update' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid task id' });
    }

    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.assignedTo.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (status) task.status = status;
    if (fileUrl) task.fileUrl = fileUrl;
    
    await task.save();

    // If completed, notify admin
    if (status === 'Completed') {
      const admins = await User.find({ role: 'admin' });
      const io = req.app.get('io');
      const userSockets = req.app.get('userSockets');

      for (const admin of admins) {
        const notification = await Notification.create({
          recipient: admin._id,
          message: `${req.user.name} completed the task: ${task.title}`,
          type: 'task',
          link: '/admin/tasks'
        });
        
        const adminSocketId = userSockets.get(admin._id.toString());
        if (adminSocketId) io.to(adminSocketId).emit('newNotification', notification);
      }
    }

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
