const Notification = require('../models/Notification');
const { getIO } = require('./socketServer');
const logger = require('./logger');

/**
 * Send a notification to a specific user
 * @param {Object} data - { recipient, sender, type, title, message, link }
 */
exports.sendNotification = async (data) => {
  try {
    // 1. Save to Database
    const notif = await Notification.create(data);

    // 2. Emit via Socket.io
    const io = getIO();
    if (io) {
      // Send to the room specific to the recipient user
      io.to(`user_${data.recipient}`).emit('newNotification', notif);
    }

    return notif;
  } catch (err) {
    logger.error('notification.send_failed', {
      err: err.message,
      stack: err.stack,
      recipient: data?.recipient ? String(data.recipient) : null
    });
  }
};
