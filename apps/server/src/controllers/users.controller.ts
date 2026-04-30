import type { RequestHandler } from 'express';
import type { ChangePasswordRequest, UpdateUserRequest, UserSearchParams } from '@packages/schemas';
import * as usersService from '../services/users.service.js';
import { verifyUserPassword } from '../services/auth.service.js';
import { hashPassword } from '../lib/password.js';
import { errors } from '../middleware/error-handler.js';

export const getMe: RequestHandler = async (req, res) => {
	const user = await usersService.findById(req.user!.sub);

	if (!user) {
		throw errors.notFound('User not found');
	}

	res.json(user);
};

export const updateMe: RequestHandler = async (req, res) => {
	const user = await usersService.updateUser(req.user!.sub, req.body as UpdateUserRequest);

	res.json(user);
};

export const uploadMeAvatar: RequestHandler = async (req, res) => {
	if (!req.file) {
		throw errors.badRequest('No avatar file provided');
	}

	const avatarUrl = `/uploads/${req.file.filename}`;
	const user = await usersService.updateUserAvatar(req.user!.sub, avatarUrl);

	res.json(user);
};

export const deleteMe: RequestHandler = async (req, res) => {
	await usersService.deleteUser(req.user!.sub);
	res.status(204).send();
};

export const changePassword: RequestHandler = async (req, res) => {
	const { currentPassword, newPassword } = req.body as ChangePasswordRequest;
	const valid = await verifyUserPassword(req.user!.sub, currentPassword);

	if (!valid) {
		throw errors.unauthorized('目前密碼錯誤');
	}

	const hash = await hashPassword(newPassword);

	await usersService.updateUserPassword(req.user!.sub, hash);
	res.status(204).send();
};

export const searchUsers: RequestHandler = async (req, res) => {
	const result = await usersService.searchUsers(req.query as unknown as UserSearchParams);

	res.json(result);
};
