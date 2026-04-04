const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  documentType: {
    type: String,
    enum: ['Aadhaar', 'Resume', 'Certificate', 'Other', 'Offer Letter'],
    required: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
  },
  originalNameEncrypted: {
    type: String,
    required: true,
  },
  fileUrlEncrypted: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadedByRole: {
    type: String,
    enum: ['employee', 'admin'],
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected'],
    default: 'Pending',
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('Document', documentSchema);
