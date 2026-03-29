import type { RequestHandler } from 'express';
import type { UpdateUserRequest, UserSearchParams } from '@packages/schemas';
import * as usersService from '../services/users.service.js';
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

export const deleteMe: RequestHandler = async (req, res) => {
	await usersService.deleteUser(req.user!.sub);
	res.status(204).send();
};

export const searchUsers: RequestHandler = async (req, res) => {
	const result = await usersService.searchUsers(req.query as unknown as UserSearchParams);
	res.json(result);
};
