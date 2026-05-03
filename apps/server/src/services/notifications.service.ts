import {
	conversationTypeSchema,
	listNotificationsParamsSchema,
	markNotificationsReadRequestSchema,
	notificationTypeSchema,
	uuidSchema,
	type ConversationType,
	type ErrorDetail,
	type ListNotificationsParams,
	type MarkNotificationsReadRequest,
	type Notification,
	type NotificationType,
	type NotificationsListResponse,
	type UnreadCountResponse
} from '@packages/schemas';
import type { ZodIssue } from 'zod';
import { prisma } from '../lib/db.js';
import { errors } from '../middleware/error-handler.js';
import { broadcastNotificationCleared, broadcastNotificationNew } from '../ws/broadcast.js';

type MarkAsReadInput = MarkNotificationsReadRequest | MarkNotificationsReadRequest['ids'] | string;
type CreateNotificationOptions = {
	actorId?: string | null;
	conversationId?: string | null;
	conversationType?: ConversationType | null;
};

const formatValidationDetails = (issues: ZodIssue[]): ErrorDetail[] =>
	issues.map((issue) => ({
		field: issue.path.length > 0 ? issue.path.map(String).join('.') : undefined,
		code: issue.code,
		message: issue.message
	}));

const parseListParams = (params: ListNotificationsParams): ListNotificationsParams => {
	const result = listNotificationsParamsSchema.safeParse(params);

	if (!result.success) {
		throw errors.validationFailed(formatValidationDetails(result.error.issues));
	}
	return result.data;
};

const parseNotificationType = (type: NotificationType): NotificationType => {
	const result = notificationTypeSchema.safeParse(type);

	if (!result.success) {
		throw errors.validationFailed(formatValidationDetails(result.error.issues));
	}
	return result.data;
};

const parseReferenceId = (referenceId: string): string => {
	const result = uuidSchema.safeParse(referenceId);

	if (!result.success) {
		throw errors.validationFailed(formatValidationDetails(result.error.issues));
	}
	return result.data;
};

const parseOptionalReferenceId = (referenceId: string | null | undefined): string | null => {
	if (referenceId === undefined || referenceId === null) {
		return null;
	}
	return parseReferenceId(referenceId);
};

const parseOptionalConversationType = (
	conversationType: ConversationType | null | undefined
): ConversationType | null => {
	if (conversationType === undefined || conversationType === null) {
		return null;
	}

	const result = conversationTypeSchema.safeParse(conversationType);

	if (!result.success) {
		throw errors.validationFailed(formatValidationDetails(result.error.issues));
	}
	return result.data;
};

const normalizeMarkAsReadIds = (input: MarkAsReadInput): string[] => {
	if (typeof input === 'string') {
		const parsedId = parseReferenceId(input);
		return [parsedId];
	}

	const payload = Array.isArray(input) ? { ids: input } : input;
	const result = markNotificationsReadRequestSchema.safeParse(payload);

	if (!result.success) {
		throw errors.validationFailed(formatValidationDetails(result.error.issues));
	}
	return [...new Set(result.data.ids)];
};

const formatNotification = (notification: {
	id: string;
	type: NotificationType;
	referenceId: string;
	actorId: string | null;
	conversationId: string | null;
	conversationType: ConversationType | null;
	read: boolean;
	createdAt: Date;
}): Notification => ({
	id: notification.id,
	type: notification.type,
	referenceId: notification.referenceId,
	actorId: notification.actorId,
	conversationId: notification.conversationId,
	conversationType: notification.conversationType,
	read: notification.read,
	createdAt: notification.createdAt.toISOString()
});

export const getNotifications = async (
	userId: string,
	params: ListNotificationsParams
): Promise<NotificationsListResponse> => {
	const { page, limit } = parseListParams(params);
	const skip = (page - 1) * limit;
	const where = { userId, read: false };
	const [notifications, total] = await Promise.all([
		prisma.notification.findMany({
			where,
			skip,
			take: limit,
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
		}),
		prisma.notification.count({ where })
	]);
	return {
		data: notifications.map(formatNotification),
		pagination: {
			total,
			page,
			limit,
			hasMore: skip + notifications.length < total
		}
	};
};

export const getUnreadCount = async (userId: string): Promise<UnreadCountResponse> => {
	const groupedCounts = await prisma.notification.groupBy({
		by: ['type'],
		where: { userId, read: false },
		_count: { _all: true }
	});
	let messages = 0;
	let friendRequests = 0;

	for (const row of groupedCounts) {
		if (row.type === 'NEW_MESSAGE') {
			messages = row._count._all;
			continue;
		}
		if (row.type === 'FRIEND_REQUEST') {
			friendRequests = row._count._all;
		}
	}
	return { messages, friendRequests };
};

export const markAsRead = async (userId: string, input: MarkAsReadInput): Promise<string[]> => {
	const ids = normalizeMarkAsReadIds(input);
	const updatedIds = await prisma.$transaction(async (tx) => {
		const unreadRows = await tx.notification.findMany({
			where: {
				userId,
				read: false,
				id: { in: ids }
			},
			select: { id: true }
		});

		if (unreadRows.length === 0) {
			return [];
		}

		const unreadIdSet = new Set(unreadRows.map((row) => row.id));
		const updatedIds = ids.filter((id) => unreadIdSet.has(id));

		await tx.notification.updateMany({
			where: {
				userId,
				read: false,
				id: { in: updatedIds }
			},
			data: { read: true }
		});
		return updatedIds;
	});

	if (updatedIds.length > 0) {
		broadcastNotificationCleared(userId, updatedIds);
	}
	return updatedIds;
};

export const markUnreadByReference = async (
	userId: string,
	type: NotificationType,
	referenceId: string
): Promise<string[]> => {
	const parsedType = parseNotificationType(type);
	const parsedReferenceId = parseReferenceId(referenceId);
	const updatedIds = await prisma.$transaction(async (tx) => {
		const unreadRows = await tx.notification.findMany({
			where: {
				userId,
				type: parsedType,
				referenceId: parsedReferenceId,
				read: false
			},
			select: { id: true }
		});

		if (unreadRows.length === 0) {
			return [];
		}

		const ids = unreadRows.map((row) => row.id);

		await tx.notification.updateMany({
			where: {
				userId,
				id: { in: ids },
				read: false
			},
			data: { read: true }
		});
		return ids;
	});

	if (updatedIds.length > 0) {
		broadcastNotificationCleared(userId, updatedIds);
	}
	return updatedIds;
};

export const markAllAsRead = async (userId: string): Promise<void> => {
	await prisma.notification.updateMany({
		where: {
			userId,
			read: false
		},
		data: { read: true }
	});
	broadcastNotificationCleared(userId, []);
};

export const createNotification = async (
	userId: string,
	type: NotificationType,
	referenceId: string,
	options: CreateNotificationOptions = {}
): Promise<Notification> => {
	const parsedType = parseNotificationType(type);
	const parsedReferenceId = parseReferenceId(referenceId);
	const actorId = parseOptionalReferenceId(options.actorId);
	const conversationId = parseOptionalReferenceId(options.conversationId);
	const conversationType = parseOptionalConversationType(options.conversationType);

	if (parsedType === 'NEW_MESSAGE' && (!actorId || !conversationId || !conversationType)) {
		throw errors.validationFailed([
			{
				field: 'notification',
				code: 'custom',
				message: 'Message notifications require actor and conversation context'
			}
		]);
	}

	const notification = await prisma.notification.create({
		data: {
			userId,
			type: parsedType,
			referenceId: parsedReferenceId,
			actorId,
			conversationId,
			conversationType
		}
	});
	const formattedNotification = formatNotification(notification);

	broadcastNotificationNew(userId, formattedNotification);
	return formattedNotification;
};
