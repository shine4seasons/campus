const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    type:      { 
      type: String, 
      enum: ['order', 'message', 'rating', 'system', 'info'], 
      default: 'info' 
    },
    title:     { type: String, required: true },
    message:   { type: String, required: true },
    link:      { type: String, default: '#' },
    isRead:    { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', NotificationSchema);
