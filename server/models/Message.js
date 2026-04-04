const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatGroup',
    default: null,
    index: true,
  },
  messageText: {
    type: String,
    default: '',
    trim: true,
  },
  fileUrl: {
    type: String,
    default: '',
  },
  originalFileName: {
    type: String,
    default: '',
  },
  fileMimeType: {
    type: String,
    default: '',
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text',
  },
  seenBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  delivered: {
    type: Boolean,
    default: false,
  },
  edited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  deletedForEveryone: {
    type: Boolean,
    default: false,
  },
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
messageSchema.index({ groupId: 1, createdAt: 1 });

messageSchema.virtual('message').get(function getMessage() {
  return this.messageText;
});

messageSchema.virtual('status').get(function getStatus() {
  if ((this.seenBy || []).length > 1 || ((this.seenBy || []).length === 1 && String(this.seenBy[0]) !== String(this.senderId))) {
    return 'seen';
  }

  if (this.delivered) {
    return 'delivered';
  }

  return 'sent';
});

messageSchema.virtual('timestamp').get(function getTimestamp() {
  return this.createdAt;
});

messageSchema.virtual('isRead').get(function getIsRead() {
  return this.status === 'seen';
});

messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Message', messageSchema);
