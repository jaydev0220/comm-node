import type { RequestHandler } from 'express';
import { prisma } from '../lib/db.js';
import { errors } from '../middleware/error-handler.js';
import { getParticipantRole } from '../services/chats.service.js';
import type {
	User,
	Participant,
	AddParticipantRequest,
	UpdateParticipantRoleRequest
} from '@packages/schemas';

// --- Helpers ---

const formatUser = (user: {
	id: string;
	email: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	createdAt: Date;
	updatedAt: Date;
}): User => ({
	id: user.id,
	email: user.email,
	username: user.username,
	displayName: user.displayName,
	avatarUrl: user.avatarUrl ?? undefined,
	createdAt: user.createdAt.toISOString(),
	updatedAt: user.updatedAt.toISOString()
});
const formatParticipant = (p: {
	user: {
		id: string;
		email: string;
		username: string;
		displayName: string;
		avatarUrl: string | null;
		createdAt: Date;
		updatedAt: Date;
	};
	role: 'OWNER' | 'ADMIN' | 'MEMBER';
	joinedAt: Date;
}): Participant => ({
	user: formatUser(p.user),
	role: p.role,
	joinedAt: p.joinedAt.toISOString()
});

// --- Controllers ---

export const listParticipants: RequestHandler = async (req, res) => {
	const chatId = req.params['id'] as string;
	const userId = req.user!.sub;
	const role = await getParticipantRole(userId, chatId);

	if (!role) {
		throw errors.notFound('Chat not found or not a member');
	}

	const participants = await prisma.conversationParticipant.findMany({
		where: { conversationId: chatId },
		include: {
			user: true
		},
		orderBy: { joinedAt: 'asc' }
	});

	res.json(participants.map((p) => formatParticipant(p)));
};

export const addParticipant: RequestHandler = async (req, res) => {
	const chatId = req.params['id'] as string;
	const currentUserId = req.user!.sub;
	const { userId: targetUserId } = req.body as AddParticipantRequest;
	const currentRole = await getParticipantRole(currentUserId, chatId);

	if (!currentRole) {
		throw errors.notFound('Chat not found or not a member');
	}
	if (currentRole === 'MEMBER') {
		throw errors.forbidden('Only admins and owners can add participants');
	}

	const existingParticipant = await prisma.conversationParticipant.findUnique({
		where: { conversationId_userId: { conversationId: chatId, userId: targetUserId } }
	});

	if (existingParticipant) {
		throw errors.conflict('User is already a participant');
	}

	const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });

	if (!targetUser) {
		throw errors.notFound('User not found');
	}

	const participant = await prisma.conversationParticipant.create({
		data: {
			conversationId: chatId,
			userId: targetUserId,
			role: 'MEMBER'
		},
		include: { user: true }
	});

	res.status(201).json(formatParticipant(participant));
};

export const updateRole: RequestHandler = async (req, res) => {
	const chatId = req.params['id'] as string;
	const targetUserId = req.params['uid'] as string;
	const currentUserId = req.user!.sub;
	const { role: newRole } = req.body as UpdateParticipantRoleRequest;
	const currentRole = await getParticipantRole(currentUserId, chatId);

	if (!currentRole) {
		throw errors.notFound('Chat not found or not a member');
	}
	if (currentRole !== 'OWNER') {
		throw errors.forbidden('Only owners can update participant roles');
	}
	if (targetUserId === currentUserId) {
		throw errors.badRequest('Cannot change your own role');
	}

	const targetParticipant = await prisma.conversationParticipant.findUnique({
		where: { conversationId_userId: { conversationId: chatId, userId: targetUserId } }
	});

	if (!targetParticipant) {
		throw errors.notFound('Participant not found');
	}
	if (targetParticipant.role === 'OWNER') {
		throw errors.forbidden('Cannot change the role of an owner');
	}

	const updated = await prisma.conversationParticipant.update({
		where: { conversationId_userId: { conversationId: chatId, userId: targetUserId } },
		data: { role: newRole },
		include: { user: true }
	});

	res.json(formatParticipant(updated));
};

export const removeParticipant: RequestHandler = async (req, res) => {
	const chatId = req.params['id'] as string;
	const targetUserId = req.params['uid'] as string;
	const currentUserId = req.user!.sub;
	const currentRole = await getParticipantRole(currentUserId, chatId);

	if (!currentRole) {
		throw errors.notFound('Chat not found or not a member');
	}

	const isSelf = targetUserId === currentUserId;

	if (isSelf) {
		// Leaving the chat
		if (currentRole === 'OWNER') {
			throw errors.badRequest('Owner cannot leave the chat. Transfer ownership first.');
		}
	} else {
		// Removing someone else
		if (currentRole === 'MEMBER') {
			throw errors.forbidden('Only admins and owners can remove participants');
		}

		const targetParticipant = await prisma.conversationParticipant.findUnique({
			where: { conversationId_userId: { conversationId: chatId, userId: targetUserId } }
		});

		if (!targetParticipant) {
			throw errors.notFound('Participant not found');
		}
		// ADMIN can only remove MEMBER, not OWNER or other ADMIN
		if (currentRole === 'ADMIN' && targetParticipant.role !== 'MEMBER') {
			throw errors.forbidden('Admins can only remove members');
		}
		// OWNER cannot remove themselves via this path (handled above)
		if (targetParticipant.role === 'OWNER') {
			throw errors.forbidden('Cannot remove the owner');
		}
	}

	await prisma.conversationParticipant.delete({
		where: { conversationId_userId: { conversationId: chatId, userId: targetUserId } }
	});
	res.status(204).send();
};
