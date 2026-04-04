const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a holiday name'],
  },
  date: {
    type: Date,
    required: [true, 'Please add a holiday date'],
  },
  type: {
    type: String,
    enum: ['Public', 'Company', 'Optional'],
    default: 'Public'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Holiday', holidaySchema);
