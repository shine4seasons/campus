const Notification = require('../models/Notification');

function buildNotificationFilter({ recipientId, filter = 'all' }) {
  const query = { recipient: recipientId };
  if (filter === 'unread') query.isRead = false;
  else if (['order', 'message', 'rating', 'system', 'info'].includes(filter)) query.type = filter;
  return query;
}

async function findNotificationsForRecipient({ recipientId, filter = 'all', page = 1, limit = 20 }) {
  const query = buildNotificationFilter({ recipientId, filter });
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: recipientId, isRead: false })
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total
  };
}

function markNotificationAsRead({ notificationId, recipientId }) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipient: recipientId },
    { isRead: true },
    { new: true }
  );
}

function markAllNotificationsAsRead(recipientId) {
  return Notification.updateMany(
    { recipient: recipientId, isRead: false },
    { isRead: true }
  );
}

function deleteNotificationForRecipient({ notificationId, recipientId }) {
  return Notification.deleteOne({ _id: notificationId, recipient: recipientId });
}

module.exports = {
  buildNotificationFilter,
  findNotificationsForRecipient,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationForRecipient
};
