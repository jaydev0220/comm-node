import type { RequestHandler } from 'express';
import * as chatsService from '../services/chats.service.js';
import type { ListChatsParams, CreateChatRequest, UpdateChatRequest } from '@packages/schemas';

export const listChats: RequestHandler = async (req, res) => {
	const result = await chatsService.listChats(
		req.user!.sub,
		req.query as unknown as ListChatsParams
	);

	res.json(result);
};

export const createChat: RequestHandler = async (req, res) => {
	const chat = await chatsService.createChat(req.user!.sub, req.body as CreateChatRequest);

	res.status(201).json(chat);
};

export const getChat: RequestHandler = async (req, res) => {
	const chatId = req.params['id'] as string;
	const chat = await chatsService.getChat(req.user!.sub, chatId);

	res.json(chat);
};

export const updateChat: RequestHandler = async (req, res) => {
	const chatId = req.params['id'] as string;
	const chat = await chatsService.updateChat(req.user!.sub, chatId, req.body as UpdateChatRequest);

	res.json(chat);
};

export const deleteChat: RequestHandler = async (req, res) => {
	const chatId = req.params['id'] as string;

	await chatsService.deleteChat(req.user!.sub, chatId);
	res.status(204).send();
};
