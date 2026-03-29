import { Router } from 'express';
import { z } from 'zod';
import * as participantsController from '../controllers/participants.controller.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
	addParticipantRequestSchema,
	updateParticipantRoleRequestSchema,
	uuidSchema
} from '@packages/schemas';

const router = Router({ mergeParams: true });

router.use(authenticate);

const uidParamSchema = z.object({ uid: uuidSchema });

router.get('/', participantsController.listParticipants);
router.post('/', validateBody(addParticipantRequestSchema), participantsController.addParticipant);
router.patch(
	'/:uid',
	validateParams(uidParamSchema),
	validateBody(updateParticipantRoleRequestSchema),
	participantsController.updateRole
);
router.delete('/:uid', validateParams(uidParamSchema), participantsController.removeParticipant);

export default router;
