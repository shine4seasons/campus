const router = require('express').Router();
const { protect } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

// All chat APIs require user to be authenticated
router.use(protect);

router.post('/init', chatController.initChat);
router.get('/', chatController.getConversations);
router.get('/:id/messages', chatController.getMessages);
router.post('/:id/messages', chatController.sendMessage);

module.exports = router;
