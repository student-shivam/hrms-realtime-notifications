const mongoose = require('mongoose');

const chatGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  department: {
    type: String,
    default: '',
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
}, {
  timestamps: true,
});

chatGroupSchema.index({ name: 1 });
chatGroupSchema.index({ department: 1 });

module.exports = mongoose.model('ChatGroup', chatGroupSchema);
