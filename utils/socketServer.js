let io = null;

function init(server) {
  const { Server } = require('socket.io');
  const jwt = require('jsonwebtoken');

  io = new Server(server, { cors: { origin: '*' } });

  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) return next();

      const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
          const parts = c.trim().split('=');
          return [parts[0], parts.slice(1).join('=')];
        })
      );
      
      const token = cookies.token;
      if (!token) return next();

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.sub; // Attach user ID to socket
      next();
    } catch (err) {
      // Still allow connection but socket.userId will be missing
      next();
    }
  });

  io.on('connection', (socket) => {
    socket.on('joinUser', (userId) => {
      if (!userId) return;
      
      // Security: Only allow joining own room if authenticated
      if (socket.userId && String(socket.userId) !== String(userId)) {
        console.warn(`User ${socket.userId} attempted to join user_${userId}`);
        return;
      }

      socket.join(`user_${String(userId)}`);
    });

    socket.on('joinConv', (convId) => {
      if (!convId) return;
      socket.join(`conv_${String(convId)}`);
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
