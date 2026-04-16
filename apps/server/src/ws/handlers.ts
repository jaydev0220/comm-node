import type { WsClientMessage, MessageSend, MessageEdit, MessageDelete } from '@packages/schemas';
import { prisma } from '../lib/db.js';
import { registerHandler, type WsMessageHandler } from './index.js';
import type { AuthenticatedSocket } from './connection.js';
import { sendError, sendAck, formatMessageForWs, broadcastToConversation } from './broadcast.js';
import { createNotification } from '../services/notifications.service.js';

// ============================================================================
// Permission Helpers
// ============================================================================

const getParticipantRole = async (
	userId: string,
	conversationId: string
): Promise<string | null> => {
	const participant = await prisma.conversationParticipant.findUnique({
		where: {
			conversationId_userId: { conversationId, userId }
		},
		select: { role: true }
	});
	return participant?.role ?? null;
};

const canDeleteMessage = (role: string, senderId: string, userId: string): boolean => {
	// Sender can always delete their own message
	if (senderId === userId) return true;
	// ADMIN and OWNER can delete any message
	return role === 'ADMIN' || role === 'OWNER';
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
	const role = await getParticipantRole(socket.userId, conversationId);

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
				attachments: true
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
				createNotification(recipientId, 'NEW_MESSAGE', newMessage.id)
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
		// Find the message
		const existingMessage = await prisma.message.findUnique({
			where: { id: messageId },
			select: {
				id: true,
				conversationId: true,
				senderId: true,
				deletedAt: true
			}
		});

		if (!existingMessage) {
			sendError(socket, 'NOT_FOUND', 'Message not found', requestId);
			return;
		}
		if (existingMessage.deletedAt) {
			sendError(socket, 'FORBIDDEN', 'Cannot edit a deleted message', requestId);
			return;
		}
		// Only sender can edit
		if (existingMessage.senderId !== socket.userId) {
			sendError(socket, 'FORBIDDEN', 'Only the sender can edit this message', requestId);
			return;
		}

		// Check if user is still a participant
		const role = await getParticipantRole(socket.userId, existingMessage.conversationId);

		if (!role) {
			sendError(socket, 'FORBIDDEN', 'You are not a participant of this conversation', requestId);
			return;
		}

		// Update the message
		const editedAt = new Date();

		await prisma.message.update({
			where: { id: messageId },
			data: { content, editedAt }
		});
		// Broadcast to all participants
		await broadcastToConversation(existingMessage.conversationId, {
			event: 'message:edited',
			payload: {
				messageId,
				content,
				editedAt: editedAt.toISOString()
			}
		});
		// Send ack to sender
		sendAck(socket, requestId);
	} catch (err) {
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
		// Find the message
		const existingMessage = await prisma.message.findUnique({
			where: { id: messageId },
			select: {
				id: true,
				conversationId: true,
				senderId: true,
				deletedAt: true
			}
		});

		if (!existingMessage) {
			sendError(socket, 'NOT_FOUND', 'Message not found', requestId);
			return;
		}
		if (existingMessage.deletedAt) {
			sendError(socket, 'FORBIDDEN', 'Message is already deleted', requestId);
			return;
		}

		// Check participant role
		const role = await getParticipantRole(socket.userId, existingMessage.conversationId);

		if (!role) {
			sendError(socket, 'FORBIDDEN', 'You are not a participant of this conversation', requestId);
			return;
		}
		// Check permission to delete
		if (!canDeleteMessage(role, existingMessage.senderId, socket.userId)) {
			sendError(
				socket,
				'FORBIDDEN',
				'You do not have permission to delete this message',
				requestId
			);
			return;
		}

		// Soft delete the message
		await prisma.message.update({
			where: { id: messageId },
			data: { deletedAt: new Date() }
		});
		// Broadcast to all participants
		await broadcastToConversation(existingMessage.conversationId, {
			event: 'message:deleted',
			payload: { messageId }
		});
		// Send ack to sender
		sendAck(socket, requestId);
	} catch (err) {
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
