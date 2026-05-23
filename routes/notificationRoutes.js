const router = require('express');
const { z } = require('zod');
const routerInst = router.Router();
const { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification 
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { emptyBodySchema } = require('../validation/mutateSchemas');

routerInst.use(protect);

routerInst.get('/', getNotifications);
routerInst.patch('/:id/read', validate(emptyBodySchema), markAsRead);
routerInst.post('/read-all', validate(emptyBodySchema), markAllAsRead);
routerInst.delete('/:id', validate(emptyBodySchema), deleteNotification);

module.exports = routerInst;
