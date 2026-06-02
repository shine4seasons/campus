const router = require('express');
const routerInst = router.Router();
const { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification 
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { validate, validateParams, validateQuery } = require('../middleware/validate');
const { emptyBodySchema } = require('../validation/mutateSchemas');
const { idParamSchema, notificationsQuerySchema } = require('../validation/requestSchemas');

routerInst.use(protect);

routerInst.get('/', validateQuery(notificationsQuerySchema), getNotifications);
routerInst.patch('/:id/read', validateParams(idParamSchema), validate(emptyBodySchema), markAsRead);
routerInst.post('/read-all', validate(emptyBodySchema), markAllAsRead);
routerInst.delete('/:id', validateParams(idParamSchema), validate(emptyBodySchema), deleteNotification);

module.exports = routerInst;
