const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Employee = require('../models/Employee');
const ChatGroup = require('../models/ChatGroup');

const DELETE_FOR_EVERYONE_WINDOW_MS = 10 * 60 * 1000;

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);
const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

const getDirectConversationId = (userId, otherUserId) => (
  `direct:${[String(userId), String(otherUserId)].sort().join(':')}`
);

const getGroupConversationId = (groupId) => `group:${groupId}`;

const canAccessDirectChat = async (currentUser, otherUserId) => {
  const otherUser = await User.findById(otherUserId).select('_id role name email');
  if (!otherUser) {
    throw new Error('Chat user not found');
  }

  const allowed = currentUser.role === 'admin'
    ? otherUser.role === 'employee' || otherUser.role === 'admin'
    : otherUser.role === 'admin' || otherUser.role === 'employee';

  if (!allowed) {
    throw new Error('Not authorized to access this chat');
  }

  return otherUser;
};

const getDepartmentMemberIds = async (departmentName) => {
  if (!departmentName) return [];

  const employees = await Employee.find({ department: departmentName }).select('email').lean();
  const emails = employees.map((item) => item.email).filter(Boolean);
  if (!emails.length) return [];

  const users = await User.find({ email: { $in: emails } }).select('_id').lean();
  return users.map((item) => item._id);
};

const ensureDepartmentGroups = async () => {
  const departments = await Employee.distinct('department', { department: { $exists: true, $ne: '' } });
  if (!departments.length) return;

  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  const adminIds = admins.map((item) => item._id);

  await Promise.all(departments.map(async (department) => {
    const memberIds = await getDepartmentMemberIds(department);
    const uniqueMembers = Array.from(new Set([...adminIds, ...memberIds].map(String))).map(toObjectId);
    if (!uniqueMembers.length) return;

    await ChatGroup.findOneAndUpdate(
      { department },
      {
        $set: {
          name: `${department} Team`,
          department,
          members: uniqueMembers,
          createdBy: adminIds[0] || uniqueMembers[0]
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
  }));
};

const normalizeMessage = (messageDoc, currentUserId = null) => {
  const message = typeof messageDoc.toObject === 'function' ? messageDoc.toObject() : messageDoc;
  const senderId = String(message.senderId?._id || message.senderId);
  const receiverId = message.receiverId ? String(message.receiverId?._id || message.receiverId) : null;
  const groupId = message.groupId ? String(message.groupId?._id || message.groupId) : null;
  const seenBy = (message.seenBy || []).map((item) => String(item._id || item));
  const delivered = Boolean(message.delivered);
  const status = seenBy.some((item) => item !== senderId) ? 'seen' : delivered ? 'delivered' : 'sent';

  return {
    _id: String(message._id),
    conversationId: groupId ? getGroupConversationId(groupId) : getDirectConversationId(senderId, receiverId),
    senderId,
    receiverId,
    groupId,
    messageText: message.deletedForEveryone ? 'This message was deleted' : (message.messageText || ''),
    fileUrl: message.deletedForEveryone ? '' : (message.fileUrl || ''),
    originalFileName: message.originalFileName || '',
    fileMimeType: message.fileMimeType || '',
    messageType: message.deletedForEveryone ? 'text' : (message.messageType || 'text'),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    timestamp: message.createdAt,
    seenBy,
    delivered,
    edited: Boolean(message.edited),
    editedAt: message.editedAt,
    deletedForEveryone: Boolean(message.deletedForEveryone),
    isOwnMessage: currentUserId ? String(currentUserId) === senderId : false,
    status,
  };
};

const buildDirectChats = async (currentUser) => {
  const users = await User.find({ _id: { $ne: currentUser._id } })
    .select('name email role')
    .sort('name')
    .lean();

  const conversationMessages = await Message.find({
    groupId: null,
    $or: [
      { senderId: currentUser._id },
      { receiverId: currentUser._id }
    ]
  }).sort('-createdAt').lean();

  const lastMessageMap = new Map();
  const unreadMap = new Map();

  conversationMessages.forEach((message) => {
    const otherId = String(message.senderId) === String(currentUser._id)
      ? String(message.receiverId)
      : String(message.senderId);

    if (!lastMessageMap.has(otherId) && !(message.deletedFor || []).map(String).includes(String(currentUser._id))) {
      lastMessageMap.set(otherId, message);
    }

    if (
      String(message.senderId) !== String(currentUser._id)
      && !message.deletedForEveryone
      && !(message.seenBy || []).map(String).includes(String(currentUser._id))
      && !(message.deletedFor || []).map(String).includes(String(currentUser._id))
    ) {
      unreadMap.set(otherId, (unreadMap.get(otherId) || 0) + 1);
    }
  });

  return users
    .filter((chatUser) => currentUser.role === 'admin' || chatUser.role === 'admin' || chatUser.role === 'employee')
    .map((chatUser) => {
      const lastMessage = lastMessageMap.get(String(chatUser._id));
      return {
        _id: String(chatUser._id),
        type: 'direct',
        conversationId: getDirectConversationId(currentUser._id, chatUser._id),
        name: chatUser.name,
        subtitle: chatUser.role,
        role: chatUser.role,
        participants: [String(currentUser._id), String(chatUser._id)],
        unreadCount: unreadMap.get(String(chatUser._id)) || 0,
        lastMessage: lastMessage ? normalizeMessage(lastMessage, currentUser._id) : null
      };
    });
};

const buildGroupChats = async (currentUser) => {
  await ensureDepartmentGroups();

  const groups = await ChatGroup.find({ members: currentUser._id })
    .populate('members', 'name email role')
    .sort('name')
    .lean();

  const groupIds = groups.map((item) => item._id);
  const groupMessages = groupIds.length
    ? await Message.find({ groupId: { $in: groupIds } }).sort('-createdAt').lean()
    : [];

  const lastMessageMap = new Map();
  const unreadMap = new Map();

  groupMessages.forEach((message) => {
    const groupId = String(message.groupId);

    if (!lastMessageMap.has(groupId) && !(message.deletedFor || []).map(String).includes(String(currentUser._id))) {
      lastMessageMap.set(groupId, message);
    }

    if (
      String(message.senderId) !== String(currentUser._id)
      && !(message.seenBy || []).map(String).includes(String(currentUser._id))
      && !(message.deletedFor || []).map(String).includes(String(currentUser._id))
      && !message.deletedForEveryone
    ) {
      unreadMap.set(groupId, (unreadMap.get(groupId) || 0) + 1);
    }
  });

  return groups.map((group) => ({
    _id: String(group._id),
    type: 'group',
    conversationId: getGroupConversationId(group._id),
    name: group.name,
    subtitle: group.department || `${group.members.length} members`,
    department: group.department,
    participants: (group.members || []).map((item) => ({
      _id: String(item._id),
      name: item.name,
      role: item.role,
      email: item.email
    })),
    unreadCount: unreadMap.get(String(group._id)) || 0,
    lastMessage: lastMessageMap.get(String(group._id)) ? normalizeMessage(lastMessageMap.get(String(group._id)), currentUser._id) : null
  }));
};

const filterVisibleMessages = (messages, currentUserId) => messages.filter((message) => {
  const deletedFor = (message.deletedFor || []).map((item) => String(item));
  return !deletedFor.includes(String(currentUserId));
});

const emitConversationRefresh = async (req, userIds) => {
  const io = req.app.get('io');
  if (!io) return;

  await Promise.all(userIds.map(async (userId) => {
    const user = await User.findById(userId).select('_id role name email');
    if (!user) return;

    const payload = {
      directChats: await buildDirectChats(user),
      groups: await buildGroupChats(user),
    };

    io.to(`user:${userId}`).emit('chatSidebarUpdated', payload);
  }));
};

exports.getChatBootstrap = async (req, res) => {
  try {
    const [directChats, groups] = await Promise.all([
      buildDirectChats(req.user),
      buildGroupChats(req.user)
    ]);

    const onlineUsers = Array.from(req.app.get('onlineUsers') || []);

    res.status(200).json({
      success: true,
      data: {
        directChats,
        groups,
        onlineUsers
      }
    });
  } catch (error) {
    console.error('getChatBootstrap error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDirectMessages = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    await canAccessDirectChat(req.user, userId);

    const messages = await Message.find({
      groupId: null,
      $or: [
        { senderId: req.user._id, receiverId: userId },
        { senderId: userId, receiverId: req.user._id }
      ]
    }).sort('createdAt');

    const pendingSeen = messages.filter((message) => (
      String(message.senderId) !== String(req.user._id)
      && !(message.seenBy || []).map(String).includes(String(req.user._id))
      && !(message.deletedFor || []).map(String).includes(String(req.user._id))
    ));

    if (pendingSeen.length) {
      await Message.updateMany(
        { _id: { $in: pendingSeen.map((item) => item._id) } },
        { $addToSet: { seenBy: req.user._id }, $set: { delivered: true } }
      );

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${userId}`).emit('messageSeen', {
          byUserId: String(req.user._id),
          conversationId: getDirectConversationId(req.user._id, userId),
          messageIds: pendingSeen.map((item) => String(item._id))
        });
      }
    }

    await emitConversationRefresh(req, [req.user._id, userId]);

    res.status(200).json({
      success: true,
      data: filterVisibleMessages(messages, req.user._id).map((item) => normalizeMessage(item, req.user._id))
    });
  } catch (error) {
    console.error('getDirectMessages error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!isValidId(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid group id' });
    }

    const group = await ChatGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (!(group.members || []).map(String).includes(String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this group' });
    }

    const messages = await Message.find({ groupId }).sort('createdAt');
    const pendingSeen = messages.filter((message) => (
      String(message.senderId) !== String(req.user._id)
      && !(message.seenBy || []).map(String).includes(String(req.user._id))
      && !(message.deletedFor || []).map(String).includes(String(req.user._id))
    ));

    if (pendingSeen.length) {
      await Message.updateMany(
        { _id: { $in: pendingSeen.map((item) => item._id) } },
        { $addToSet: { seenBy: req.user._id }, $set: { delivered: true } }
      );
    }

    const io = req.app.get('io');
    if (io && pendingSeen.length) {
      io.to(`group:${groupId}`).emit('messageSeen', {
        byUserId: String(req.user._id),
        conversationId: getGroupConversationId(groupId),
        messageIds: pendingSeen.map((item) => String(item._id))
      });
    }

    await emitConversationRefresh(req, (group.members || []).map(String));

    res.status(200).json({
      success: true,
      data: filterVisibleMessages(messages, req.user._id).map((item) => normalizeMessage(item, req.user._id))
    });
  } catch (error) {
    console.error('getGroupMessages error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, groupId } = req.body;
    const messageText = String(req.body.messageText || req.body.message || '').trim();
    const hasFile = Boolean(req.file);

    if (!receiverId && !groupId) {
      return res.status(400).json({ success: false, message: 'receiverId or groupId is required' });
    }

    if (!messageText && !hasFile) {
      return res.status(400).json({ success: false, message: 'Message text or file is required' });
    }

    let targetGroup = null;
    let targetUser = null;
    let participants = [String(req.user._id)];

    if (groupId) {
      if (!isValidId(groupId)) {
        return res.status(400).json({ success: false, message: 'Invalid group id' });
      }

      targetGroup = await ChatGroup.findById(groupId);
      if (!targetGroup) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }

      participants = Array.from(new Set((targetGroup.members || []).map(String)));
      if (!participants.includes(String(req.user._id))) {
        return res.status(403).json({ success: false, message: 'Not authorized to send to this group' });
      }
    } else {
      if (!isValidId(receiverId)) {
        return res.status(400).json({ success: false, message: 'Invalid receiver id' });
      }

      targetUser = await canAccessDirectChat(req.user, receiverId);
      participants.push(String(targetUser._id));
    }

    const fileUrl = req.file ? `/uploads/chat/${req.file.filename}` : '';
    const fileMimeType = req.file?.mimetype || '';
    const messageType = req.file
      ? (String(req.file.mimetype || '').startsWith('image/') ? 'image' : 'file')
      : 'text';

    const message = await Message.create({
      senderId: req.user._id,
      receiverId: targetUser?._id || null,
      groupId: targetGroup?._id || null,
      messageText,
      fileUrl,
      originalFileName: req.file?.originalname || '',
      fileMimeType,
      messageType,
      delivered: targetGroup ? true : Boolean((req.app.get('onlineUsers') || new Set()).has(String(targetUser?._id))),
      seenBy: [req.user._id]
    });

    const normalized = normalizeMessage(message, req.user._id);
    const io = req.app.get('io');
    const conversationId = targetGroup ? getGroupConversationId(targetGroup._id) : getDirectConversationId(req.user._id, targetUser._id);

    if (io) {
      if (targetGroup) {
        io.to(`group:${targetGroup._id}`).emit('receiveMessage', normalized);
      } else {
        io.to(`user:${targetUser._id}`).emit('receiveMessage', normalized);
        io.to(`user:${req.user._id}`).emit('messageStatusUpdated', {
          messageId: normalized._id,
          status: normalized.status,
          conversationId
        });
      }
    }

    await emitConversationRefresh(req, participants);

    res.status(201).json({ success: true, data: normalized });
  } catch (error) {
    console.error('sendMessage error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markConversationSeen = async (req, res) => {
  try {
    const { type, targetId } = req.params;
    if (!isValidId(targetId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation target id' });
    }

    let query = {};
    let participantIds = [String(req.user._id)];
    let conversationId = '';

    if (type === 'direct') {
      await canAccessDirectChat(req.user, targetId);
      query = {
        groupId: null,
        senderId: targetId,
        receiverId: req.user._id,
      };
      participantIds.push(String(targetId));
      conversationId = getDirectConversationId(req.user._id, targetId);
    } else if (type === 'group') {
      const group = await ChatGroup.findById(targetId);
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      if (!(group.members || []).map(String).includes(String(req.user._id))) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      query = {
        groupId: targetId,
        senderId: { $ne: req.user._id }
      };
      participantIds = (group.members || []).map(String);
      conversationId = getGroupConversationId(targetId);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid conversation type' });
    }

    const messages = await Message.find(query).select('_id senderId seenBy');
    const unseenIds = messages
      .filter((message) => !(message.seenBy || []).map(String).includes(String(req.user._id)))
      .map((message) => message._id);

    if (unseenIds.length) {
      await Message.updateMany(
        { _id: { $in: unseenIds } },
        { $addToSet: { seenBy: req.user._id }, $set: { delivered: true } }
      );
    }

    const io = req.app.get('io');
    if (io && unseenIds.length) {
      if (type === 'group') {
        io.to(`group:${targetId}`).emit('messageSeen', {
          byUserId: String(req.user._id),
          conversationId,
          messageIds: unseenIds.map(String)
        });
      } else {
        io.to(`user:${targetId}`).emit('messageSeen', {
          byUserId: String(req.user._id),
          conversationId,
          messageIds: unseenIds.map(String)
        });
      }
    }

    await emitConversationRefresh(req, participantIds);

    res.status(200).json({
      success: true,
      messageIds: unseenIds.map(String)
    });
  } catch (error) {
    console.error('markConversationSeen error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const nextText = String(req.body.messageText || '').trim();

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message id' });
    }

    if (!nextText) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (String(message.senderId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only sender can edit this message' });
    }

    message.messageText = nextText;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    const normalized = normalizeMessage(message, req.user._id);
    const io = req.app.get('io');

    if (io) {
      if (message.groupId) {
        io.to(`group:${message.groupId}`).emit('messageUpdated', normalized);
      } else {
        io.to(`user:${message.receiverId}`).emit('messageUpdated', normalized);
        io.to(`user:${message.senderId}`).emit('messageUpdated', normalized);
      }
    }

    const participants = message.groupId
      ? (await ChatGroup.findById(message.groupId).select('members').lean())?.members?.map(String) || []
      : [String(message.senderId), String(message.receiverId)];
    await emitConversationRefresh(req, participants);

    res.status(200).json({ success: true, data: normalized });
  } catch (error) {
    console.error('editMessage error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = req.query.scope || 'me';

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message id' });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (scope === 'everyone') {
      if (String(message.senderId) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Only sender can delete for everyone' });
      }

      if (Date.now() - new Date(message.createdAt).getTime() > DELETE_FOR_EVERYONE_WINDOW_MS) {
        return res.status(400).json({ success: false, message: 'Delete for everyone time limit expired' });
      }

      message.deletedForEveryone = true;
      message.messageText = '';
      if (message.fileUrl) {
        const absolutePath = path.join(__dirname, '..', message.fileUrl.replace(/^\/+/, ''));
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      }
      message.fileUrl = '';
      message.originalFileName = '';
      message.fileMimeType = '';
      message.messageType = 'text';
      await message.save();
    } else {
      await Message.findByIdAndUpdate(id, {
        $addToSet: { deletedFor: req.user._id }
      });
      message.deletedFor.push(req.user._id);
    }

    const io = req.app.get('io');
    const payload = {
      messageId: String(message._id),
      scope,
      userId: String(req.user._id),
      deletedForEveryone: scope === 'everyone'
    };

    if (io) {
      if (message.groupId) {
        io.to(`group:${message.groupId}`).emit('messageDeleted', payload);
      } else {
        io.to(`user:${message.senderId}`).emit('messageDeleted', payload);
        io.to(`user:${message.receiverId}`).emit('messageDeleted', payload);
      }
    }

    const participants = message.groupId
      ? (await ChatGroup.findById(message.groupId).select('members').lean())?.members?.map(String) || []
      : [String(message.senderId), String(message.receiverId)];
    await emitConversationRefresh(req, participants);

    res.status(200).json({ success: true, data: payload });
  } catch (error) {
    console.error('deleteMessage error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const { name, department, memberIds = [] } = req.body;
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can create groups' });
    }

    const cleanedMembers = memberIds.filter(isValidId).map(String);
    const uniqueMembers = Array.from(new Set([String(req.user._id), ...cleanedMembers])).map(toObjectId);

    const group = await ChatGroup.create({
      name: String(name || department || 'New Group').trim(),
      department: String(department || '').trim(),
      createdBy: req.user._id,
      members: uniqueMembers
    });

    const fullGroup = await ChatGroup.findById(group._id).populate('members', 'name email role').lean();
    const participants = fullGroup.members.map((item) => String(item._id));

    const io = req.app.get('io');
    if (io) {
      participants.forEach((memberId) => {
        io.sockets.sockets.forEach((socket) => {
          if (socket.data?.userId === memberId) {
            socket.join(`group:${group._id}`);
          }
        });
      });
    }

    await emitConversationRefresh(req, participants);

    res.status(201).json({
      success: true,
      data: {
        _id: String(fullGroup._id),
        type: 'group',
        conversationId: getGroupConversationId(fullGroup._id),
        name: fullGroup.name,
        department: fullGroup.department,
        participants: fullGroup.members.map((item) => ({
          _id: String(item._id),
          name: item.name,
          role: item.role,
          email: item.email
        }))
      }
    });
  } catch (error) {
    console.error('createGroup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateGroupMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { memberIds = [] } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can update groups' });
    }

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid group id' });
    }

    const uniqueMembers = Array.from(new Set([String(req.user._id), ...memberIds.filter(isValidId).map(String)])).map(toObjectId);
    const group = await ChatGroup.findByIdAndUpdate(
      id,
      { $set: { members: uniqueMembers } },
      { new: true, runValidators: true }
    ).populate('members', 'name email role');

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const participants = group.members.map((item) => String(item._id));
    await emitConversationRefresh(req, participants);

    res.status(200).json({
      success: true,
      data: {
        _id: String(group._id),
        name: group.name,
        department: group.department,
        participants: group.members.map((item) => ({
          _id: String(item._id),
          name: item.name,
          role: item.role,
          email: item.email
        }))
      }
    });
  } catch (error) {
    console.error('updateGroupMembers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
