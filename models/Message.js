const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      default: '',
      trim: true
    },
    imageUrl: {
      type: String,
      default: null
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// At least one of text or imageUrl must be present
MessageSchema.pre('validate', function(next) {
  if (!this.text && !this.imageUrl) {
    return next(new Error('Message must contain text or an image'));
  }
  next();
});

// Standard index to sort messages in a conversation
MessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', MessageSchema);
