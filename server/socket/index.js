const { verifySocketToken } = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Track online users: userId -> Set of socketIds (supports multiple tabs)
const onlineUsers = new Map();

module.exports = function initSocket(io) {
  // Auth middleware — verify JWT before allowing connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const decoded = verifySocketToken(token);
    if (!decoded) return next(new Error('Authentication failed'));
    socket.userId = decoded.id;
    next();
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`[Socket.io] User ${userId} connected — socket ${socket.id}`);

    // Track socket for multi-tab support
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Update DB presence
    await User.findByIdAndUpdate(userId, { isOnline: true, socketId: socket.id, lastSeen: new Date() });

    // Join personal room for targeted events
    socket.join(`user:${userId}`);

    // Join all conversation rooms
    const conversations = await Conversation.find({ participants: userId }).select('_id');
    conversations.forEach((c) => socket.join(`conv:${c._id}`));

    // Broadcast online to everyone
    io.emit('user:online', { userId, isOnline: true });

    // ── Send Message ──────────────────────────────────────────────────────────
    socket.on('message:send', async (data, callback) => {
      try {
        const { conversationId, content, type = 'text' } = data;

        if (!conversationId || !content?.trim()) {
          return callback?.({ success: false, error: 'Missing conversationId or content' });
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });
        if (!conversation) {
          return callback?.({ success: false, error: 'Conversation not found' });
        }

        const message = await Message.create({
          conversationId,
          sender: userId,
          content: content.trim(),
          type,
          readBy: [{ user: userId, readAt: new Date() }],
        });

        const populated = await Message.findById(message._id)
          .populate('sender', 'username avatar')
          .lean();

        // Update denormalized lastMessage on conversation
        await Conversation.findByIdAndUpdate(conversationId, {
          $set: {
            lastMessage: {
              content: content.trim(),
              sender: userId,
              createdAt: new Date(),
              type,
            },
            updatedAt: new Date(),
          },
        });

        // Broadcast to all room members
        io.to(`conv:${conversationId}`).emit('message:new', populated);

        callback?.({ success: true, message: populated });
      } catch (err) {
        console.error('[Socket] message:send error:', err.message);
        callback?.({ success: false, error: 'Failed to send message' });
      }
    });

    // ── Typing Indicators ─────────────────────────────────────────────────────
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', { userId, conversationId });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', { userId, conversationId });
    });

    // ── Read Receipts ─────────────────────────────────────────────────────────
    socket.on('message:read', async ({ conversationId }) => {
      try {
        await Message.updateMany(
          { conversationId, 'readBy.user': { $ne: userId } },
          { $addToSet: { readBy: { user: userId, readAt: new Date() } } }
        );
        socket.to(`conv:${conversationId}`).emit('message:read', { conversationId, userId });
      } catch (err) {
        console.error('[Socket] message:read error:', err.message);
      }
    });

    // ── Join New Conversation Room ─────────────────────────────────────────────
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        // Only go offline when all tabs are closed
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date(), socketId: null });
          io.emit('user:online', { userId, isOnline: false, lastSeen: new Date() });
          console.log(`[Socket.io] User ${userId} went offline`);
        }
      }
    });
  });
};
