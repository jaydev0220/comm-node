import { Router } from 'express';
import { z } from 'zod';
import * as chatsController from '../controllers/chats.controller.js';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
	createChatRequestSchema,
	updateChatRequestSchema,
	listChatsParamsSchema,
	uuidSchema
} from '@packages/schemas';

const router = Router();

router.use(authenticate);

const idParamSchema = z.object({ id: uuidSchema });

router.get('/', validateQuery(listChatsParamsSchema), chatsController.listChats);
router.post('/', validateBody(createChatRequestSchema), chatsController.createChat);
router.get('/:id', validateParams(idParamSchema), chatsController.getChat);
router.patch(
	'/:id',
	validateParams(idParamSchema),
	validateBody(updateChatRequestSchema),
	chatsController.updateChat
);
router.delete('/:id', validateParams(idParamSchema), chatsController.deleteChat);

export default router;
