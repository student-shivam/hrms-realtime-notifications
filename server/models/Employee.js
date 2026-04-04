const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const employeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email',
    ],
  },
  department: {
    type: String,
    required: [true, 'Please add a department'],
  },
  salary: {
    type: Number,
    required: [true, 'Please add a salary'],
  },
  salaryDetails: {
    base: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 }
  },
  documents: [documentSchema],
  leaveBalance: {
    sick: { type: Number, default: 12 },
    casual: { type: Number, default: 12 },
    paid: { type: Number, default: 15 }
  },
  totalLeaves: { type: Number, default: 39 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Employee', employeeSchema);
