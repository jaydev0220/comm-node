import type { RequestHandler } from 'express';
import type {
	ListNotificationsParams,
	MarkNotificationsReadRequest,
	NotificationsListResponse,
	UnreadCountResponse
} from '@packages/schemas';
import * as notificationsService from '../services/notifications.service.js';

export const listNotifications: RequestHandler = async (req, res) => {
	const notifications = await notificationsService.getNotifications(
		req.user!.sub,
		req.query as unknown as ListNotificationsParams
	);
	const response: NotificationsListResponse = notifications;

	res.json(response);
};

export const getUnreadCount: RequestHandler = async (req, res) => {
	const unreadCount = await notificationsService.getUnreadCount(req.user!.sub);
	const response: UnreadCountResponse = unreadCount;

	res.json(response);
};

export const markNotificationsRead: RequestHandler = async (req, res) => {
	await notificationsService.markAsRead(req.user!.sub, req.body as MarkNotificationsReadRequest);
	res.status(204).send();
};

export const markAllNotificationsRead: RequestHandler = async (req, res) => {
	await notificationsService.markAllAsRead(req.user!.sub);
	res.status(204).send();
};
