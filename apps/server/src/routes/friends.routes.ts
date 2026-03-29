import { Router } from 'express';
import { z } from 'zod';
import * as friendsController from '../controllers/friends.controller.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
	sendFriendRequestSchema,
	respondFriendRequestSchema,
	blockUserRequestSchema,
	uuidSchema
} from '@packages/schemas';

const router = Router();

router.use(authenticate);

const idParamSchema = z.object({ id: uuidSchema });
const userIdParamSchema = z.object({ userId: uuidSchema });

router.get('/', friendsController.listFriends);
router.get('/requests', friendsController.listRequests);
router.post('/requests', validateBody(sendFriendRequestSchema), friendsController.sendRequest);
router.patch(
	'/requests/:id',
	validateParams(idParamSchema),
	validateBody(respondFriendRequestSchema),
	friendsController.respondToRequest
);
router.delete('/:userId', validateParams(userIdParamSchema), friendsController.removeFriend);
router.post('/blocks', validateBody(blockUserRequestSchema), friendsController.blockUser);
router.delete('/blocks/:userId', validateParams(userIdParamSchema), friendsController.unblockUser);

export default router;
