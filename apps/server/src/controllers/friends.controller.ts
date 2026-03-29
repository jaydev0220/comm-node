import type { RequestHandler } from 'express';
import * as friendsService from '../services/friends.service.js';

export const listFriends: RequestHandler = async (req, res) => {
	const friends = await friendsService.listFriends(req.user!.sub);
	res.json({ data: friends });
};

export const listRequests: RequestHandler = async (req, res) => {
	const requests = await friendsService.listPendingRequests(req.user!.sub);
	res.json({ data: requests });
};

export const sendRequest: RequestHandler = async (req, res) => {
	const friendship = await friendsService.sendFriendRequest(req.user!.sub, req.body.addresseeId);
	res.status(201).json(friendship);
};

export const respondToRequest: RequestHandler = async (req, res) => {
	const requestId = req.params['id'] as string;
	const result = await friendsService.respondToRequest(req.user!.sub, requestId, req.body.action);
	if (result) {
		res.json(result);
	} else {
		res.status(200).json({ message: 'Request rejected' });
	}
};

export const removeFriend: RequestHandler = async (req, res) => {
	const userId = req.params['userId'] as string;
	await friendsService.removeFriend(req.user!.sub, userId);
	res.status(204).send();
};

export const blockUser: RequestHandler = async (req, res) => {
	const block = await friendsService.blockUser(req.user!.sub, req.body.targetId);
	res.status(201).json(block);
};

export const unblockUser: RequestHandler = async (req, res) => {
	const userId = req.params['userId'] as string;
	await friendsService.unblockUser(req.user!.sub, userId);
	res.status(204).send();
};
