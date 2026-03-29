import { Router } from 'express';
import { updateUserRequestSchema, userSearchParamsSchema } from '@packages/schemas';
import * as usersController from '../controllers/users.controller.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/me', usersController.getMe);
router.patch('/me', validateBody(updateUserRequestSchema), usersController.updateMe);
router.delete('/me', usersController.deleteMe);
router.get('/search', validateQuery(userSearchParamsSchema), usersController.searchUsers);

export default router;
