import { Router } from 'express';
import * as notificationsController from '../controllers/notifications.controller.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { listNotificationsParamsSchema, markNotificationsReadRequestSchema } from '@packages/schemas';

const router = Router();

router.use(authenticate);
router.get('/', validateQuery(listNotificationsParamsSchema), notificationsController.listNotifications);
router.get('/unread-count', notificationsController.getUnreadCount);
router.post(
	'/read',
	validateBody(markNotificationsReadRequestSchema),
	notificationsController.markNotificationsRead
);
router.post('/read-all', notificationsController.markAllNotificationsRead);

export default router;
