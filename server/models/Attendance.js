const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null,
  },
  date: {
    type: Date,
    required: true,
  },
  checkIn: {
    type: Date,
    default: null
  },
  checkOut: {
    type: Date,
    default: null
  },
  workingHours: {
    type: Number,
    default: 0
  },
  totalHours: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Present', 'Checked Out', 'Absent', 'Half-Day'],
    default: 'Present',
  },
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  isLate: {
    type: Boolean,
    default: false
  },
  isEarlyLogout: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Ensure a user can only have one attendance record per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

attendanceSchema.pre('save', function() {
  if (this.isModified('workingHours') || this.isNew) {
    this.totalHours = this.workingHours || 0;
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
