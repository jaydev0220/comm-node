import { prisma } from '../lib/db.js';
import { errors } from '../middleware/error-handler.js';

type ParticipantRole = 'OWNER' | 'ADMIN' | 'MEMBER';
type ConversationType = 'DIRECT' | 'GROUP';
type MutationType = 'edit' | 'delete';

export interface MessageMutationTarget {
	id: string;
	conversationId: string;
	conversationType: ConversationType;
	senderId: string;
	deletedAt: Date | null;
}

const getDeletedMessageError = (type: MutationType): string =>
	type === 'edit' ? 'Cannot edit a deleted message' : 'Message is already deleted';

export const getConversationParticipantRole = async (
	userId: string,
	conversationId: string
): Promise<ParticipantRole | null> => {
	const participant = await prisma.conversationParticipant.findUnique({
		where: {
			conversationId_userId: { conversationId, userId }
		},
		select: { role: true }
	});
	return participant?.role ?? null;
};

export const assertConversationParticipant = async (
	userId: string,
	conversationId: string
): Promise<ParticipantRole> => {
	const role = await getConversationParticipantRole(userId, conversationId);

	if (!role) {
		throw errors.forbidden('You are not a participant of this conversation');
	}
	return role;
};

export const loadMessageForMutation = async (
	messageId: string,
	type: MutationType,
	expectedConversationId?: string
): Promise<MessageMutationTarget> => {
	const message = await prisma.message.findUnique({
		where: { id: messageId },
		select: {
			id: true,
			conversationId: true,
			senderId: true,
			deletedAt: true,
			conversation: {
				select: { type: true }
			}
		}
	});

	if (!message) {
		throw errors.notFound('Message not found');
	}
	if (expectedConversationId && message.conversationId !== expectedConversationId) {
		throw errors.notFound('Message not found');
	}
	if (message.deletedAt) {
		throw errors.forbidden(getDeletedMessageError(type));
	}
	return {
		id: message.id,
		conversationId: message.conversationId,
		conversationType: message.conversation.type,
		senderId: message.senderId,
		deletedAt: message.deletedAt
	};
};

export const editMessage = async (
	userId: string,
	messageId: string,
	content: string,
	expectedConversationId?: string
): Promise<{ conversationId: string; messageId: string; content: string; editedAt: Date }> => {
	const message = await loadMessageForMutation(messageId, 'edit', expectedConversationId);

	if (message.senderId !== userId) {
		throw errors.forbidden('Only the sender can edit this message');
	}

	await assertConversationParticipant(userId, message.conversationId);

	const editedAt = new Date();

	await prisma.message.update({
		where: { id: messageId },
		data: { content, editedAt }
	});
	return {
		conversationId: message.conversationId,
		messageId,
		content,
		editedAt
	};
};

export const deleteMessage = async (
	userId: string,
	messageId: string,
	expectedConversationId?: string
): Promise<{ conversationId: string; messageId: string }> => {
	const message = await loadMessageForMutation(messageId, 'delete', expectedConversationId);
	const role = await assertConversationParticipant(userId, message.conversationId);
	const isGroupOwner = message.conversationType === 'GROUP' && role === 'OWNER';
	const canDelete = message.senderId === userId || isGroupOwner;

	if (!canDelete) {
		throw errors.forbidden('You do not have permission to delete this message');
	}

	await prisma.message.update({
		where: { id: messageId },
		data: { deletedAt: new Date() }
	});
	return {
		conversationId: message.conversationId,
		messageId
	};
};
