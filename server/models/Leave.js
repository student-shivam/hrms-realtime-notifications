const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fromDate: {
    type: Date,
    required: [true, 'Please add a from date'],
  },
  toDate: {
    type: Date,
    required: [true, 'Please add a to date'],
  },
  reason: {
    type: String,
    required: [true, 'Please add a reason for leave'],
  },
  leaveType: {
    type: String,
    enum: ['Sick', 'Casual', 'Paid'],
    default: 'Casual'
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  managerComments: {
    type: String,
    default: ''
  },
  documentUrl: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Leave', leaveSchema);
