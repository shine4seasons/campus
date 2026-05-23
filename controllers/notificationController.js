const notificationRepository = require('../repositories/notificationRepository');

exports.getNotifications = async (req, res, next) => {
  try {
    const page   = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit  = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = req.query.filter || 'all';   // 'all' | 'unread' | 'order' | 'message' | 'rating' | 'system'
    const result = await notificationRepository.findNotificationsForRecipient({
      recipientId: req.user._id,
      filter,
      page,
      limit
    });

    res.json({
      success: true,
      notifications: result.notifications,
      unreadCount: result.unreadCount,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasMore: result.hasMore
      }
    });
  } catch (error) {
    return next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const updated = await notificationRepository.markNotificationAsRead({
      notificationId: req.params.id,
      recipientId: req.user._id
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await notificationRepository.markAllNotificationsAsRead(req.user._id);
    res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    await notificationRepository.deleteNotificationForRecipient({
      notificationId: req.params.id,
      recipientId: req.user._id
    });
    res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

