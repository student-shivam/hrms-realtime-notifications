const User = require('../models/User');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

const notifyAdminsForApproval = async (req, user) => {
  try {
    const admins = await User.find({
      role: 'admin',
      $or: [
        { isApproved: true },
        { isApproved: { $exists: false } }
      ]
    }).select('_id');
    if (!admins.length) return;

    const notifications = await Notification.insertMany(
      admins.map((admin) => ({
        recipient: admin._id,
        message: `${user.name} has registered and is awaiting approval.`,
        type: 'system',
        link: '/admin/pending-approvals'
      }))
    );

    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');

    notifications.forEach((notification) => {
      const adminSocketId = userSockets.get(String(notification.recipient));
      if (adminSocketId && io) {
        io.to(adminSocketId).emit('newNotification', notification);
      }
    });
  } catch (error) {
    console.error('notifyAdminsForApproval error:', error.message);
  }
};

const notifyUserApprovalDecision = async (req, user, status) => {
  try {
    const notification = await Notification.create({
      recipient: user._id,
      message: status === 'approved'
        ? 'Your HRMS account has been approved. You can now sign in.'
        : 'Your HRMS account request has been rejected. Please contact Admin/HR.',
      type: 'system',
      link: '/login'
    });

    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    const userSocketId = userSockets.get(String(user._id));
    if (userSocketId && io) {
      io.to(userSocketId).emit('newNotification', notification);
    }
  } catch (error) {
    console.error('notifyUserApprovalDecision error:', error.message);
  }
};

const serializeAuthUser = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.profileImage || user.avatar,
  profileImage: user.profileImage || user.avatar,
  designation: user.designation,
  department: user.department,
  phone: user.phone,
  bio: user.bio,
  skills: user.skills,
  experience: user.experience,
  performance: user.performance,
  status: user.status,
  isApproved: user.isApproved
});

// @desc    Register a user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      status: 'pending',
      isApproved: false
    });

    await notifyAdminsForApproval(req, user);

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Your account is pending approval from Admin/HR.',
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Login a user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide an email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been rejected. Please contact Admin/HR'
      });
    }

    if (user.status === 'pending' || user.isApproved === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval from Admin/HR'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: serializeAuthUser(user)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile & avatar
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.body.name) user.name = req.body.name;
    if (req.body.email) user.email = req.body.email;
    if (req.body.password) user.password = req.body.password;
    if (req.body.phone) user.phone = req.body.phone;
    if (req.body.bio) user.bio = req.body.bio;
    if (req.body.designation) user.designation = req.body.designation;
    if (req.body.department) user.department = req.body.department;
    if (req.body.skills) {
      user.skills = Array.isArray(req.body.skills)
        ? req.body.skills
        : String(req.body.skills).split(',').map((item) => item.trim()).filter(Boolean);
    }
    if (req.file) {
      user.avatar = `/uploads/${req.file.filename}`;
      user.profileImage = `/uploads/${req.file.filename}`;
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: serializeAuthUser(user)
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get all users (for task assignments)
// @route   GET /api/auth/users
// @access  Private
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({
      role: 'employee',
      $or: [
        { status: 'approved', isApproved: true },
        { status: { $exists: false }, isApproved: { $exists: false } }
      ]
    }).select('-password');
    res.status(200).json({
      success: true,
      data: users.map((user) => serializeAuthUser(user))
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get pending user approvals
// @route   GET /api/auth/users/pending
// @access  Private (Admin only)
exports.getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ status: 'pending', isApproved: false })
      .select('-password')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateApprovalStatus = async (req, res, status) => {
  try {
    const { id } = req.params;
    console.log(`[AUTH] ${status} user request received for id=${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user id'
      });
    }

    const existingUser = await User.findById(id).select('-password');

    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (existingUser.role === 'admin' && status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts cannot be rejected from this action'
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          isApproved: status === 'approved'
        }
      },
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    await notifyUserApprovalDecision(req, user, status);

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error(`updateApprovalStatus error (${status}):`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to update approval status'
    });
  }
};

// @desc    Approve user
// @route   PATCH /api/auth/users/approve/:id
// @access  Private (Admin only)
exports.approveUser = async (req, res) => updateApprovalStatus(req, res, 'approved');

// @desc    Reject user
// @route   PATCH /api/auth/users/reject/:id
// @access  Private (Admin only)
exports.rejectUser = async (req, res) => updateApprovalStatus(req, res, 'rejected');
