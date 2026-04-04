const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  month: {
    type: String, // e.g., "March"
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  baseSalary: {
    type: Number,
    required: true
  },
  hra: {
    type: Number,
    default: 0
  },
  bonus: {
    type: Number,
    default: 0
  },
  allowances: {
    type: Number,
    default: 0
  },
  deductions: {
    type: Number,
    default: 0
  },
  netSalary: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Paid', 'Pending'],
    default: 'Paid'
  },
  paymentDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Salary', salarySchema);
