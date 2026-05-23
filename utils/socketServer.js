let io = null;
const Conversation = require('../models/Conversation');
const logger = require('./logger');

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((pair) => {
        const idx = pair.indexOf('=');
        if (idx < 0) return [pair, ''];
        const key = pair.slice(0, idx);
        const value = pair.slice(idx + 1);
        return [key, decodeURIComponent(value)];
      })
  );
}

function init(server) {
  const { Server } = require('socket.io');
  const jwt = require('jsonwebtoken');
  const isProd = process.env.NODE_ENV === 'production';
  const isDev = !isProd;
  const allowedOrigins = (process.env.SOCKET_ALLOWED_ORIGINS || process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProd && allowedOrigins.length === 0) {
    throw new Error('SOCKET_ALLOWED_ORIGINS (or CLIENT_URL) is required in production');
  }

  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin) {
          if (!isProd) return callback(null, true);
          return callback(new Error('origin_required'));
        }
        if (isDev) {
          const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
          if (isLocalhost) return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('origin_not_allowed'));
      },
      credentials: true,
    }
  });

  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || '';
      const cookies = parseCookies(cookieHeader);
      const token = cookies.token;
      if (!token) return next(new Error('unauthorized'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.sub; // Attach user ID to socket
      return next();
    } catch (err) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('joinUser', (userId) => {
      if (!userId) return;
      
      // Security: Only allow joining own room if authenticated
      if (socket.userId && String(socket.userId) !== String(userId)) {
        logger.warn('socket.join_user_forbidden', {
          socketUserId: String(socket.userId),
          requestedUserId: String(userId)
        });
        return;
      }

      socket.join(`user_${String(userId)}`);
    });

    socket.on('joinConv', async (convId, ack) => {
      if (!convId) {
        if (typeof ack === 'function') ack({ ok: false, error: 'missing_conversation_id' });
        return;
      }
      try {
        const member = await Conversation.exists({
          _id: convId,
          participants: socket.userId
        });
        if (!member) {
          logger.warn('socket.join_conv_forbidden', {
            socketUserId: String(socket.userId),
            conversationId: String(convId)
          });
          if (typeof ack === 'function') ack({ ok: false, error: 'forbidden' });
          return;
        }
        socket.join(`conv_${String(convId)}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: 'join_failed' });
      }
    });

    socket.on('leaveConv', (convId) => {
      if (!convId) return;
      socket.leave(`conv_${String(convId)}`);
    });

    socket.on('disconnect', () => {});
  });
}

function getIO() { return io; }

module.exports = { init, getIO };
