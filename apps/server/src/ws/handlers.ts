import type { WsClientMessage, MessageSend, MessageEdit, MessageDelete } from '@packages/schemas';
import { prisma } from '../lib/db.js';
import { registerHandler, type WsMessageHandler } from './index.js';
import type { AuthenticatedSocket } from './connection.js';
import { sendError, sendAck, formatMessageForWs, broadcastToConversation } from './broadcast.js';
import { createNotification } from '../services/notifications.service.js';
import {
	getConversationParticipantRole,
	editMessage,
	deleteMessage
} from '../services/messages.service.js';
import { isAppError } from '../middleware/error-handler.js';

const handleAppError = (
	socket: AuthenticatedSocket,
	error: unknown,
	requestId: string
): boolean => {
	if (!isAppError(error)) return false;

	switch (error.code) {
		case 'FORBIDDEN':
			sendError(socket, 'FORBIDDEN', error.message, requestId);
			return true;
		case 'NOT_FOUND':
			sendError(socket, 'NOT_FOUND', error.message, requestId);
			return true;
		default:
			return false;
	}
};

// ============================================================================
// message:send Handler
// ============================================================================

const handleMessageSend: WsMessageHandler = async (
	socket: AuthenticatedSocket,
	message: WsClientMessage
) => {
	const { requestId, payload } = message as MessageSend;
	const { conversationId, content, attachmentIds } = payload;
	// Check if user is a participant
	const role = await getConversationParticipantRole(socket.userId, conversationId);

	if (!role) {
		sendError(socket, 'FORBIDDEN', 'You are not a participant of this conversation', requestId);
		return;
	}

	// Determine message type
	const hasContent = Boolean(content?.trim());
	const hasAttachments = attachmentIds && attachmentIds.length > 0;
	const messageType = hasAttachments ? 'FILE' : 'TEXT';

	try {
		// Build create data (filter out undefined for exactOptionalPropertyTypes)
		const createData: {
			conversationId: string;
			senderId: string;
			content: string | null;
			type: 'TEXT' | 'FILE';
			attachments?: { connect: { id: string }[] };
		} = {
			conversationId,
			senderId: socket.userId,
			content: hasContent ? content! : null,
			type: messageType
		};

		if (hasAttachments) {
			createData.attachments = {
				connect: attachmentIds!.map((id: string) => ({ id }))
			};
		}

		// Create the message
		const newMessage = await prisma.message.create({
			data: createData,
			include: {
				sender: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true
					}
				},
				attachments: true,
				conversation: {
					select: { type: true }
				}
			}
		});

		// Update conversation's updatedAt
		await prisma.conversation.update({
			where: { id: conversationId },
			data: { updatedAt: new Date() }
		});

		const participants = await prisma.conversationParticipant.findMany({
			where: { conversationId },
			select: { userId: true }
		});
		const recipientIds = [...new Set(participants.map((participant) => participant.userId))].filter(
			(userId) => userId !== socket.userId
		);

		await Promise.all(
			recipientIds.map((recipientId) =>
				createNotification(recipientId, 'NEW_MESSAGE', newMessage.id, {
					actorId: socket.userId,
					conversationId,
					conversationType: newMessage.conversation.type
				})
			)
		);

		// Format and broadcast
		const wsMessage = formatMessageForWs(newMessage);

		// Broadcast to all participants
		await broadcastToConversation(conversationId, {
			event: 'message:new',
			payload: wsMessage
		});
		// Send ack to sender
		sendAck(socket, requestId);
	} catch (err) {
		console.error('[WS] message:send error:', err);
		sendError(socket, 'INTERNAL_ERROR', 'Failed to send message', requestId);
	}
};

// ============================================================================
// message:edit Handler
// ============================================================================

const handleMessageEdit: WsMessageHandler = async (
	socket: AuthenticatedSocket,
	message: WsClientMessage
) => {
	const { requestId, payload } = message as MessageEdit;
	const { messageId, content } = payload;

	try {
		const result = await editMessage(socket.userId, messageId, content);

		// Broadcast to all participants
		await broadcastToConversation(result.conversationId, {
			event: 'message:edited',
			payload: {
				messageId: result.messageId,
				content: result.content,
				editedAt: result.editedAt.toISOString()
			}
		});
		// Send ack to sender
		sendAck(socket, requestId);
	} catch (err) {
		if (handleAppError(socket, err, requestId)) {
			return;
		}

		console.error('[WS] message:edit error:', err);
		sendError(socket, 'INTERNAL_ERROR', 'Failed to edit message', requestId);
	}
};

// ============================================================================
// message:delete Handler
// ============================================================================

const handleMessageDelete: WsMessageHandler = async (
	socket: AuthenticatedSocket,
	message: WsClientMessage
) => {
	const { requestId, payload } = message as MessageDelete;
	const { messageId } = payload;

	try {
		const result = await deleteMessage(socket.userId, messageId);

		// Broadcast to all participants
		await broadcastToConversation(result.conversationId, {
			event: 'message:deleted',
			payload: { messageId: result.messageId }
		});
		// Send ack to sender
		sendAck(socket, requestId);
	} catch (err) {
		if (handleAppError(socket, err, requestId)) {
			return;
		}

		console.error('[WS] message:delete error:', err);
		sendError(socket, 'INTERNAL_ERROR', 'Failed to delete message', requestId);
	}
};

// ============================================================================
// Register Handlers
// ============================================================================

registerHandler('message:send', handleMessageSend);
registerHandler('message:edit', handleMessageEdit);
registerHandler('message:delete', handleMessageDelete);
