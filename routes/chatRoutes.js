const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { limitChatSend } = require('../middleware/security');
const { chatInitSchema, chatSendMessageSchema } = require('../validation/mutateSchemas');
const chatController = require('../controllers/chat');

// All chat APIs require user to be authenticated
router.use(protect);

router.post('/init', validate(chatInitSchema), chatController.initChat);
router.get('/', chatController.getConversations);
router.get('/:id/messages', chatController.getMessages);
router.post('/:id/messages', limitChatSend, validate(chatSendMessageSchema), chatController.sendMessage);

module.exports = router;
