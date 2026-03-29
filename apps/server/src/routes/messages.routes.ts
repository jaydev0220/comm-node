import { Router } from 'express';
import * as messagesController from '../controllers/messages.controller.js';
import { validateQuery } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { listMessagesParamsSchema } from '@packages/schemas';

const router = Router({ mergeParams: true }); // Access :id from parent

router.use(authenticate);

router.get('/', validateQuery(listMessagesParamsSchema), messagesController.listMessages);

export default router;
