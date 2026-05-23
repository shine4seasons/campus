const { sendNotification } = require('../utils/notifService');
const { NOTIFICATION_TYPES } = require('../config/appConstants');
const adminRepository = require('../repositories/adminRepository');

const BATCH_SIZE = 100;

async function broadcastSystemAnnouncement({ senderId, message }) {
  const announcement = String(message || '').trim();
  if (!announcement) return { recipients: 0 };

  const users = await adminRepository.findActiveUserIds();
  if (users.length === 0) return { recipients: 0 };

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((user) =>
        sendNotification({
          recipient: user._id,
          sender: senderId,
          type: NOTIFICATION_TYPES.SYSTEM,
          title: 'System Announcement',
          message: announcement,
          link: '#'
        })
      )
    );
  }

  return { recipients: users.length };
}

module.exports = {
  broadcastSystemAnnouncement
};
