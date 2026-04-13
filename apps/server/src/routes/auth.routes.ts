import { Router } from 'express';
import {
	googleCompleteRequestSchema,
	loginRequestSchema,
	registerCompleteRequestSchema,
	registerRequestSchema,
	registerStartRequestSchema
} from '@packages/schemas';
import * as authController from '../controllers/auth.controller.js';
import { uploadAvatar } from '../controllers/uploads.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.post(
	'/register',
	uploadAvatar,
	validateBody(registerRequestSchema),
	authController.register
);
router.post(
	'/register/start',
	validateBody(registerStartRequestSchema),
	authController.registerStart
);
router.post(
	'/register/complete',
	uploadAvatar,
	validateBody(registerCompleteRequestSchema),
	authController.registerComplete
);
router.post('/login', validateBody(loginRequestSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);
router.post(
	'/google/complete',
	uploadAvatar,
	validateBody(googleCompleteRequestSchema),
	authController.googleComplete
);

export default router;
