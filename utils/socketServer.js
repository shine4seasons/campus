let io = null;

function init(server) {
  const { Server } = require('socket.io');
  io = new Server(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on('joinConv', (convId) => {
      if (!convId) return;
      socket.join(`conv_${convId}`);
    });

    socket.on('leaveConv', (convId) => {
      if (!convId) return;
      socket.leave(`conv_${convId}`);
    });

    socket.on('disconnect', () => {});
  });
}

function getIO() { return io; }

module.exports = { init, getIO };
