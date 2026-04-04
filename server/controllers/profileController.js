const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Task = require('../models/Task');
const Document = require('../models/Document');
const { decryptText } = require('../utils/documentCrypto');

const serializeDocument = (document) => {
  const record = typeof document.toObject === 'function' ? document.toObject() : document;
  return {
    _id: String(record._id),
    documentType: record.documentType,
    displayName: record.displayName,
    originalName: decryptText(record.originalNameEncrypted),
    mimeType: record.mimeType,
    createdAt: record.createdAt,
    previewUrl: `/api/documents/preview/${record._id}`,
    downloadUrl: `/api/documents/download/${record._id}`
  };
};

const getTargetUserId = (req) => {
  const targetId = req.params?.id || req.body?.userId || req.query?.userId || req.user?._id;
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    return null;
  }
  return String(targetId);
};

const ensureAccess = (req, targetUserId) => {
  if (req.user.role === 'admin') return true;
  return String(req.user._id) === String(targetUserId);
};

const calculateAttendancePercentage = async (userId) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [attendanceCount, presentCount] = await Promise.all([
    Attendance.countDocuments({ userId, date: { $gte: startOfMonth } }),
    Attendance.countDocuments({
      userId,
      date: { $gte: startOfMonth },
      status: { $in: ['Present', 'Checked Out'] }
    })
  ]);

  if (!attendanceCount) return 0;
  return Number(((presentCount / attendanceCount) * 100).toFixed(1));
};

const calculateTaskCompletionRate = async (userId) => {
  const [totalTasks, completedTasks] = await Promise.all([
    Task.countDocuments({ assignedTo: userId }),
    Task.countDocuments({ assignedTo: userId, status: 'Completed' })
  ]);

  if (!totalTasks) return 0;
  return Number(((completedTasks / totalTasks) * 100).toFixed(1));
};

const buildProfilePayload = async (userDoc) => {
  const user = typeof userDoc.toObject === 'function' ? userDoc.toObject() : userDoc;
  const employee = await Employee.findOne({ email: user.email }).lean();
  const documents = await Document.find({ employeeId: user._id }).sort('-createdAt');

  const [attendancePercentage, taskCompletion] = await Promise.all([
    calculateAttendancePercentage(user._id),
    calculateTaskCompletionRate(user._id)
  ]);

  const profileImage = user.profileImage || user.avatar || '';
  const skills = Array.isArray(user.skills) ? user.skills.filter(Boolean) : [];
  const experience = Array.isArray(user.experience) ? user.experience : [];

  const completionChecks = [
    Boolean(profileImage),
    Boolean(user.bio),
    Boolean(user.designation || employee?.department),
    Boolean(user.department || employee?.department),
    Boolean(user.phone),
    skills.length > 0,
    experience.length > 0,
    documents.length > 0,
  ];
  const profileCompletion = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);

  return {
    _id: String(user._id),
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    isApproved: user.isApproved,
    profileImage,
    avatar: profileImage,
    designation: user.designation || '',
    department: user.department || employee?.department || '',
    phone: user.phone || '',
    bio: user.bio || '',
    skills,
    experience,
    performance: {
      rating: user.performance?.rating || 0,
      attendancePercentage: user.performance?.attendancePercentage || attendancePercentage,
      taskCompletion: user.performance?.taskCompletion || taskCompletion,
      notes: user.performance?.notes || '',
    },
    documents: documents.map(serializeDocument),
    employeeMeta: employee ? {
      salary: employee.salary,
      salaryDetails: employee.salaryDetails,
      leaveBalance: employee.leaveBalance,
      totalLeaves: employee.totalLeaves
    } : null,
    profileCompletion,
    updatedAt: user.updatedAt
  };
};

exports.getProfile = async (req, res) => {
  try {
    const targetUserId = getTargetUserId(req);
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Invalid profile id' });
    }

    if (!ensureAccess(req, targetUserId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this profile' });
    }

    const user = await User.findById(targetUserId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const profile = await buildProfilePayload(user);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const targetUserId = getTargetUserId(req) || req.user?.userId || req.user?._id;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const isAdminEditingOther = req.user.role === 'admin' && String(targetUserId) !== String(req.user._id);
    if (!ensureAccess(req, targetUserId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this profile' });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    if (!user.performance) {
      user.performance = {
        rating: 0,
        attendancePercentage: 0,
        taskCompletion: 0,
        notes: ''
      };
    }

    const editableSelfFields = ['bio', 'phone', 'designation'];
    const adminOnlyFields = ['name', 'email', 'department'];

    editableSelfFields.forEach((field) => {
      if (typeof req.body[field] !== 'undefined') {
        user[field] = req.body[field];
      }
    });

    if (req.body?.skills) {
      const skills = Array.isArray(req.body.skills)
        ? req.body.skills
        : String(req.body.skills).split(',').map((item) => item.trim()).filter(Boolean);
      user.skills = skills;
    }

    if (isAdminEditingOther || req.user.role === 'admin') {
      adminOnlyFields.forEach((field) => {
        if (typeof req.body[field] !== 'undefined') {
          user[field] = req.body[field];
        }
      });

      if (typeof req.body?.rating !== 'undefined') {
        user.performance.rating = Number(req.body.rating) || 0;
      }
      if (typeof req.body?.attendancePercentage !== 'undefined') {
        user.performance.attendancePercentage = Number(req.body.attendancePercentage) || 0;
      }
      if (typeof req.body?.taskCompletion !== 'undefined') {
        user.performance.taskCompletion = Number(req.body.taskCompletion) || 0;
      }
      if (typeof req.body?.adminNotes !== 'undefined' || typeof req.body?.notes !== 'undefined') {
        user.performance.notes = req.body.adminNotes || req.body.notes || '';
      }
    }

    if (req.file) {
      const filePath = `/uploads/${req.file.filename}`;
      user.profileImage = filePath;
      user.avatar = filePath;
    }

    await user.save();

    if (req.user.role === 'admin') {
      await Employee.findOneAndUpdate(
        { email: user.email },
        {
          $set: {
            name: user.name,
            department: user.department || undefined,
            email: user.email
          }
        },
        { new: true }
      );
    }

    const profile = await buildProfilePayload(user);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('profile update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addExperience = async (req, res) => {
  try {
    const targetUserId = getTargetUserId(req);
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Invalid profile id' });
    }

    if (!ensureAccess(req, targetUserId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update experience' });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const { company, role, startDate, endDate, description } = req.body;
    if (!company || !role || !startDate) {
      return res.status(400).json({ success: false, message: 'company, role, and startDate are required' });
    }

    user.experience.push({
      company,
      role,
      startDate,
      endDate: endDate || null,
      description: description || ''
    });

    await user.save();
    const profile = await buildProfilePayload(user);
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    console.error('addExperience error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteExperience = async (req, res) => {
  try {
    const { id } = req.params;
    const targetUserId = getTargetUserId(req);
    if (!targetUserId || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    if (!ensureAccess(req, targetUserId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete experience' });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    user.experience = (user.experience || []).filter((item) => String(item._id) !== String(id));
    await user.save();

    const profile = await buildProfilePayload(user);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('deleteExperience error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
