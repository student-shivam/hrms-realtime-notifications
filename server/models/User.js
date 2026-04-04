const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const experienceSchema = new mongoose.Schema({
  company: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    required: true,
    trim: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    default: null,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
}, { _id: true });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false, // Don't return password by default
  },
  role: {
    type: String,
    enum: ['employee', 'admin'],
    default: 'employee',
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  avatar: {
    type: String,
    default: 'default-avatar.png'
  },
  profileImage: {
    type: String,
    default: '',
  },
  designation: {
    type: String,
    default: '',
    trim: true,
  },
  department: {
    type: String,
    default: '',
    trim: true,
  },
  phone: {
    type: String,
    default: '',
    trim: true,
  },
  bio: {
    type: String,
    default: '',
    trim: true,
    maxlength: 1000,
  },
  skills: [{
    type: String,
    trim: true,
  }],
  experience: [experienceSchema],
  performance: {
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    attendancePercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    taskCompletion: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    }
  }
}, {
  timestamps: true
});

// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
