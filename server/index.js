const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');

dotenv.config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const taskRoutes = require('./routes/taskRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const documentRoutes = require('./routes/documentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const salaryRoutes = require('./routes/salaryRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const profileRoutes = require('./routes/profileRoutes');
const Message = require('./models/Message');
const ChatGroup = require('./models/ChatGroup');
const APP_NAME = process.env.APP_NAME || 'RavindraNexus';

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 5001;
const allowedOrigins = (process.env.CLIENT_URL || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isOriginAllowed = (origin) => {
  if (!origin || !allowedOrigins.length) {
    return true;
  }

  return allowedOrigins.includes(origin);
};
const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
};

const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const CLIENT_DIST_PATH = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST_PATH)) {
  app.use(express.static(CLIENT_DIST_PATH));
}

app.use((req, res, next) => {
  const startedAt = Date.now();
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  res.on('finish', () => {
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`);
  });
  next();
});

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000
})
  .then(() => {
    console.log('MongoDB connection established successfully');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
  });

app.get('/api/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: `Welcome to ${APP_NAME} API`
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    port: PORT,
    mongoState: mongoose.connection.readyState
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/messages', chatRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/holidays', holidayRoutes);

const userSockets = new Map();
const onlineUsers = new Set();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('register', async (payload) => {
    try {
      const userId = typeof payload === 'string' ? payload : payload?.userId;
      const role = typeof payload === 'string' ? null : payload?.role;

      if (!userId) {
        return;
      }

      userSockets.set(String(userId), socket.id);
      onlineUsers.add(String(userId));
      socket.data.userId = String(userId);
      socket.join(`user:${userId}`);

      if (role === 'admin') {
        socket.join('admins');
      }

      const groups = await ChatGroup.find({ members: userId }).select('_id').lean();
      groups.forEach((group) => {
        socket.join(`group:${group._id}`);
      });

      console.log(`User ${userId} registered with socket ${socket.id}`);
      io.emit('userOnline', { userId: String(userId), onlineUsers: Array.from(onlineUsers) });
    } catch (error) {
      console.error('Socket register error:', error.message);
    }
  });

  socket.on('sendMessage', async (payload) => {
    try {
      const senderId = String(payload?.senderId || '');
      const receiverId = payload?.receiverId ? String(payload.receiverId) : '';
      const groupId = payload?.groupId ? String(payload.groupId) : '';
      const messageText = String(payload?.messageText || payload?.message || '').trim();

      if (!senderId || (!receiverId && !groupId) || !messageText) {
        return;
      }

      const delivered = groupId || onlineUsers.has(receiverId);
      const message = await Message.create({
        senderId,
        receiverId: receiverId || null,
        groupId: groupId || null,
        messageText,
        messageType: 'text',
        delivered: Boolean(delivered),
        seenBy: [senderId]
      });

      const normalized = {
        _id: String(message._id),
        senderId,
        receiverId: receiverId || null,
        groupId: groupId || null,
        messageText,
        messageType: 'text',
        delivered: Boolean(delivered),
        seenBy: [senderId],
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        timestamp: message.createdAt,
        edited: false,
        deletedForEveryone: false,
        status: delivered ? 'delivered' : 'sent'
      };

      if (groupId) {
        io.to(`group:${groupId}`).emit('receiveMessage', normalized);
      } else {
        io.to(`user:${receiverId}`).emit('receiveMessage', normalized);
        io.to(`user:${senderId}`).emit('messageStatusUpdated', {
          messageId: normalized._id,
          status: normalized.status,
          conversationId: `direct:${[senderId, receiverId].sort().join(':')}`
        });
      }
    } catch (error) {
      console.error('Socket sendMessage error:', error.message);
    }
  });

  socket.on('typing', (payload) => {
    try {
      const targetType = String(payload?.targetType || 'direct');
      const targetId = String(payload?.targetId || '');
      if (!targetId) {
        return;
      }

      const typingPayload = {
        fromUserId: String(payload?.fromUserId || ''),
        targetType,
        targetId,
        isTyping: Boolean(payload?.isTyping)
      };

      if (targetType === 'group') {
        socket.to(`group:${targetId}`).emit('typing', typingPayload);
      } else {
        io.to(`user:${targetId}`).emit('typing', typingPayload);
      }
    } catch (error) {
      console.error('Socket typing error:', error.message);
    }
  });

  socket.on('stopTyping', (payload) => {
    try {
      const targetType = String(payload?.targetType || 'direct');
      const targetId = String(payload?.targetId || '');
      if (!targetId) {
        return;
      }

      const typingPayload = {
        fromUserId: String(payload?.fromUserId || ''),
        targetType,
        targetId,
        isTyping: false
      };

      if (targetType === 'group') {
        socket.to(`group:${targetId}`).emit('typing', typingPayload);
      } else {
        io.to(`user:${targetId}`).emit('typing', typingPayload);
      }
    } catch (error) {
      console.error('Socket stopTyping error:', error.message);
    }
  });

  socket.on('messageSeen', async (payload) => {
    try {
      const byUserId = String(payload?.byUserId || '');
      const targetType = String(payload?.targetType || 'direct');
      const targetId = String(payload?.targetId || '');
      if (!byUserId || !targetId) {
        return;
      }

      let query = {};
      let room = '';

      if (targetType === 'group') {
        query = {
          groupId: targetId,
          senderId: { $ne: byUserId },
          seenBy: { $ne: byUserId }
        };
        room = `group:${targetId}`;
      } else {
        query = {
          groupId: null,
          senderId: targetId,
          receiverId: byUserId,
          seenBy: { $ne: byUserId }
        };
        room = `user:${targetId}`;
      }

      const messages = await Message.find(query).select('_id');
      if (!messages.length) return;

      await Message.updateMany(
        { _id: { $in: messages.map((item) => item._id) } },
        { $addToSet: { seenBy: byUserId }, $set: { delivered: true } }
      );

      io.to(room).emit('messageSeen', {
        byUserId,
        targetType,
        targetId,
        messageIds: messages.map((item) => String(item._id))
      });
    } catch (error) {
      console.error('Socket messageSeen error:', error.message);
    }
  });

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error.message);
  });

  socket.on('disconnect', (reason) => {
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        onlineUsers.delete(userId);
        io.emit('userOffline', { userId, onlineUsers: Array.from(onlineUsers) });
        console.log(`User ${userId} disconnected (${reason})`);
        break;
      }
    }
  });
});

app.set('io', io);
app.set('userSockets', userSockets);
app.set('onlineUsers', onlineUsers);

app.get('/', (req, res) => {
  if (fs.existsSync(CLIENT_DIST_PATH)) {
    return res.sendFile(path.join(CLIENT_DIST_PATH, 'index.html'));
  }

  res.status(200).json({
    success: true,
    message: `${APP_NAME} API is running`
  });
});

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/uploads/') || req.originalUrl.startsWith('/socket.io/')) {
    return next();
  }

  if (fs.existsSync(CLIENT_DIST_PATH)) {
    return res.sendFile(path.join(CLIENT_DIST_PATH, 'index.html'));
  }

  next();
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
});

app.use((error, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, error);
  if (res.headersSent) {
    return next(error);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

server.on('error', (error) => {
  console.error('HTTP server error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

server.listen(PORT, () => {
  console.log(`${APP_NAME} server running with Socket.io on port ${PORT}`);
});
