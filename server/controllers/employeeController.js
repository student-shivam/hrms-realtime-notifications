const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Document = require('../models/Document');
const mongoose = require('mongoose');
const path = require('path');
const { encryptText, decryptText } = require('../utils/documentCrypto');
const { emitDashboardUpdate } = require('../utils/dashboardStats');

const serializeDocument = (document, req) => {
  const record = typeof document.toObject === 'function' ? document.toObject() : document;

  return {
    _id: record._id,
    employeeId: record.employeeId,
    documentType: record.documentType,
    displayName: record.displayName,
    originalName: decryptText(record.originalNameEncrypted),
    uploadedBy: record.uploadedBy,
    uploadedByRole: record.uploadedByRole,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    status: record.status,
    createdAt: record.createdAt,
    previewUrl: `/api/documents/preview/${record._id}`,
    downloadUrl: `/api/documents/download/${record._id}`,
    canDelete: req.user.role === 'admin' || String(req.user._id) === String(record.employeeId)
  };
};

// @desc    Add new employee
// @route   POST /api/employees
// @access  Private
exports.addEmployee = async (req, res) => {
  try {
    const employee = await Employee.create(req.body);
    await emitDashboardUpdate(req, 'employee:created');

    res.status(201).json({
      success: true,
      data: employee
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private
exports.getEmployees = async (req, res) => {
  try {
    const { keyword, department, page = 1, limit = 10 } = req.query;

    let query = {};

    // Search
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } }
      ];
    }

    // Filter
    if (department) {
      query.department = department;
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;
    
    const total = await Employee.countDocuments(query);
    const employees = await Employee.find(query).skip(startIndex).limit(limitNum);
    const users = await User.find({
      email: { $in: employees.map((employee) => employee.email).filter(Boolean) }
    }).select('_id email').lean();
    const userMap = new Map(users.map((item) => [item.email, String(item._id)]));
    const enrichedEmployees = employees.map((employee) => ({
      ...employee.toObject(),
      linkedUserId: userMap.get(employee.email) || null
    }));

    res.status(200).json({
      success: true,
      count: employees.length,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      },
      data: enrichedEmployees
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private
exports.updateEmployee = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee id' });
    }

    let employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ success: false, message: `No employee found with the id of ${req.params.id}` });
    }

    employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    await emitDashboardUpdate(req, 'employee:updated');

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Private
exports.deleteEmployee = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee id' });
    }

    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ success: false, message: `No employee found with the id of ${req.params.id}` });
    }

    await employee.deleteOne();
    await emitDashboardUpdate(req, 'employee:deleted');
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Upload document for employee
// @route   POST /api/employees/:id/documents
// @access  Private (Admin)
exports.uploadDocument = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee id' });
    }

    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a valid document format (PDF/JPG/PNG)' });
    }

    const linkedUser = await User.findOne({ email: employee.email });
    if (!linkedUser) {
      return res.status(404).json({ success: false, message: 'No user account is linked to this employee email' });
    }

    const documentType = req.body.documentType || req.body.type || 'Other';
    if (!['Aadhaar', 'Resume', 'Certificate', 'Other', 'Offer Letter'].includes(documentType)) {
      return res.status(400).json({ success: false, message: 'Invalid document type' });
    }

    const displayName = String(req.body.displayName || req.body.name || path.parse(req.file.originalname).name).trim() || 'Document';

    const document = await Document.create({
      employeeId: linkedUser._id,
      documentType,
      displayName,
      originalNameEncrypted: encryptText(req.file.originalname),
      fileUrlEncrypted: encryptText(`/uploads/documents/${req.file.filename}`),
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      uploadedByRole: 'admin',
      status: 'Verified'
    });

    // Create Notification for the specific User matching the Employee's email
    if (linkedUser) {
      const notification = await Notification.create({
        recipient: linkedUser._id,
        message: `A new document (${displayName}) was uploaded to your profile by HR.`,
        type: 'document',
        link: '/employee/documents'
      });
      
      const io = req.app.get('io');
      const userSockets = req.app.get('userSockets');
      const userSocketId = userSockets.get(linkedUser._id.toString());
      if (userSocketId) {
        io.to(userSocketId).emit('newNotification', notification);
      }
    }

    res.status(200).json({
      success: true,
      data: serializeDocument(document, req)
    });
  } catch (error) {
    console.error('employee uploadDocument error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get logged in employee's documents
// @route   GET /api/employees/my/documents
// @access  Private
exports.getMyDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ employeeId: req.user._id }).sort('-createdAt');

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents.map((document) => serializeDocument(document, req))
    });
  } catch (error) {
    console.error('employee getMyDocuments error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get logged in employee's salary slip for current month
// @route   GET /api/employees/my/salary-slip
// @access  Private
exports.getMySalarySlip = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found' });
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Fetch Attendance for current month
    const attendanceRecords = await Attendance.find({
      userId: req.user.id,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const workingDays = attendanceRecords.filter(r => r.checkOut).length;
    const totalWorkingHours = attendanceRecords.reduce((sum, r) => sum + (r.workingHours || 0), 0);
    
    // Calculate overtime (assuming 8 hours/day is standard)
    const standardHours = workingDays * 8;
    const overtimeHours = Math.max(0, totalWorkingHours - standardHours);

    // Fetch Leaves for current month
    const leaves = await Leave.find({
      userId: req.user.id,
      status: 'Approved',
      fromDate: { $gte: startOfMonth },
      toDate: { $lte: endOfMonth }
    });

    const totalLeaves = leaves.length;

    // Financial calculations
    const monthlyBase = employee.salary || 0;
    const perDaySalary = monthlyBase / 22; // Standard 22 working days
    const overtimeRate = (perDaySalary / 8) * 1.5; // 1.5x for overtime
    
    const baseEarned = perDaySalary * workingDays;
    const overtimePay = overtimeHours * overtimeRate;
    const deductions = totalLeaves * perDaySalary; // User said: deductions = leaves

    const finalSalary = baseEarned + overtimePay - deductions;

    res.status(200).json({
      success: true,
      data: {
        employeeName: employee.name,
        month: startOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
        baseSalary: monthlyBase,
        workingDays,
        totalHours: totalWorkingHours.toFixed(2),
        overtimeHours: overtimeHours.toFixed(2),
        overtimePay: Math.round(overtimePay),
        deductions: Math.round(deductions),
        finalSalary: Math.round(finalSalary),
        perDaySalary: Math.round(perDaySalary)
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get logged in employee's profile
// @route   GET /api/employees/my/profile
// @access  Private
exports.getMyProfile = async (req, res) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found for this account' });
    }

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
