import type {
	Friendship,
	NotificationClearedPayload,
	NotificationNewPayload,
	WsServerMessage,
	WsMessage
} from '@packages/schemas';
import { prisma } from '../lib/db.js';
import { getSocketsForUser, type AuthenticatedSocket } from './connection.js';

// ============================================================================
// Helper: Format Message from Prisma to WS Message
// ============================================================================

type PrismaMessage = {
	id: string;
	conversationId: string;
	sender: {
		id: string;
		username: string;
		displayName: string;
		avatarUrl: string | null;
	};
	content: string | null;
	type: 'TEXT' | 'FILE' | 'SYSTEM';
	attachments: Array<{
		id: string;
		url: string;
		mimeType: string;
		size: number;
		name: string;
	}>;
	ogEmbed: unknown;
	editedAt: Date | null;
	deletedAt: Date | null;
	createdAt: Date;
};

export const formatMessageForWs = (m: PrismaMessage): WsMessage => ({
	id: m.id,
	conversationId: m.conversationId,
	sender: {
		id: m.sender.id,
		username: m.sender.username,
		displayName: m.sender.displayName,
		avatarUrl: m.sender.avatarUrl
	},
	content: m.content,
	type: m.type,
	attachments: m.attachments.map((a) => ({
		id: a.id,
		url: a.url,
		mimeType: a.mimeType,
		size: a.size,
		name: a.name
	})),
	ogEmbed: m.ogEmbed as WsMessage['ogEmbed'],
	editedAt: m.editedAt?.toISOString() ?? null,
	deletedAt: m.deletedAt?.toISOString() ?? null,
	createdAt: m.createdAt.toISOString()
});

type NotificationBroadcastInput = {
	id: string;
	type: NotificationNewPayload['type'];
	referenceId: string;
	createdAt: string | Date;
};

export const formatNotificationForWs = (
	notification: NotificationBroadcastInput
): NotificationNewPayload => ({
	id: notification.id,
	type: notification.type,
	referenceId: notification.referenceId,
	createdAt:
		typeof notification.createdAt === 'string'
			? notification.createdAt
			: notification.createdAt.toISOString()
});

// ============================================================================
// Send to Single Socket
// ============================================================================

/**
 * Send a message to a single WebSocket connection.
 */
export const sendToSocket = (socket: AuthenticatedSocket, message: WsServerMessage): void => {
	if (socket.readyState === socket.OPEN) {
		socket.send(JSON.stringify(message));
	}
};

/**
 * Send an acknowledgement to the requesting client.
 */
export const sendAck = (socket: AuthenticatedSocket, requestId: string): void => {
	sendToSocket(socket, {
		event: 'ack',
		payload: { requestId }
	});
};

/**
 * Send an error to a specific client.
 */
export const sendError = (
	socket: AuthenticatedSocket,
	code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_FAILED' | 'INTERNAL_ERROR',
	message: string,
	requestId?: string
): void => {
	const payload: { code: typeof code; message: string; requestId?: string } = {
		code,
		message
	};

	if (requestId) {
		payload.requestId = requestId;
	}

	sendToSocket(socket, {
		event: 'error',
		payload
	});
};

/**
 * Broadcast a server message to all connected sockets for a user.
 */
export const broadcastToUser = (
	userId: string,
	message: WsServerMessage,
	excludeSocket?: AuthenticatedSocket
): void => {
	const sockets = getSocketsForUser(userId);

	for (const socket of sockets) {
		if (socket !== excludeSocket) {
			sendToSocket(socket, message);
		}
	}
};

// ============================================================================
// Broadcast to Conversation
// ============================================================================

/**
 * Get participant user IDs for a conversation (fresh from DB).
 */
export const getConversationParticipantIds = async (conversationId: string): Promise<string[]> => {
	const participants = await prisma.conversationParticipant.findMany({
		where: { conversationId },
		select: { userId: true }
	});
	return participants.map((p: { userId: string }) => p.userId);
};

/**
 * Broadcast a message to all connected participants of a conversation.
 * Excludes the sender socket (they receive ack instead).
 */
export const broadcastToConversation = async (
	conversationId: string,
	message: WsServerMessage,
	excludeSocket?: AuthenticatedSocket
): Promise<void> => {
	const participantIds = await getConversationParticipantIds(conversationId);

	for (const userId of participantIds) {
		broadcastToUser(userId, message, excludeSocket);
	}
};

/**
 * Broadcast a new notification to all connected sockets for a user.
 */
export const broadcastNotificationNew = (
	userId: string,
	notification: NotificationBroadcastInput
): void => {
	broadcastToUser(userId, {
		event: 'notification:new',
		payload: formatNotificationForWs(notification)
	});
};

/**
 * Broadcast notification clear sync to all connected sockets for a user.
 */
export const broadcastNotificationCleared = (
	userId: string,
	ids: NotificationClearedPayload['ids']
): void => {
	broadcastToUser(userId, {
		event: 'notification:cleared',
		payload: { ids: [...ids] }
	});
};

/**
 * Broadcast friend acceptance sync to requester and addressee.
 */
export const broadcastFriendAccepted = (friendship: Friendship): void => {
	const message: WsServerMessage = {
		event: 'friend:accepted',
		payload: friendship
	};

	broadcastToUser(friendship.requester.id, message);

	if (friendship.requester.id !== friendship.addressee.id) {
		broadcastToUser(friendship.addressee.id, message);
	}
};

/**
 * Broadcast a new message to all participants (including sender for consistency).
 * Sender receives both the broadcast AND an ack.
 */
export const broadcastNewMessage = async (
	message: WsMessage,
	senderSocket: AuthenticatedSocket,
	requestId: string
): Promise<void> => {
	const conversationId = message.conversationId;

	// Broadcast to all participants (including sender's other devices)
	await broadcastToConversation(
		conversationId,
		{ event: 'message:new', payload: message },
		undefined // Don't exclude anyone - all devices should see it
	);
	// Send ack to the originating socket
	sendAck(senderSocket, requestId);
};

/**
 * Broadcast a message edit to all participants.
 */
export const broadcastMessageEdited = async (
	conversationId: string,
	messageId: string,
	content: string,
	editedAt: Date,
	senderSocket: AuthenticatedSocket,
	requestId: string
): Promise<void> => {
	await broadcastToConversation(
		conversationId,
		{
			event: 'message:edited',
			payload: {
				messageId,
				content,
				editedAt: editedAt.toISOString()
			}
		},
		undefined
	);
	sendAck(senderSocket, requestId);
};

/**
 * Broadcast a message deletion to all participants.
 */
export const broadcastMessageDeleted = async (
	conversationId: string,
	messageId: string,
	senderSocket: AuthenticatedSocket,
	requestId: string
): Promise<void> => {
	await broadcastToConversation(
		conversationId,
		{
			event: 'message:deleted',
			payload: { messageId }
		},
		undefined
	);
	sendAck(senderSocket, requestId);
};
