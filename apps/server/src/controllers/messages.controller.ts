import type { RequestHandler } from 'express';
import { prisma } from '../lib/db.js';
import { errors } from '../middleware/error-handler.js';
import type { Message, CursorPage, User, Attachment } from '@packages/schemas';

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
const formatAttachment = (a: {
	id: string;
	url: string;
	mimeType: string;
	size: number;
	name: string;
}): Attachment => ({
	id: a.id,
	url: a.url,
	mimeType: a.mimeType,
	size: a.size,
	name: a.name
});
const formatMessage = (m: {
	id: string;
	conversationId: string;
	sender: {
		id: string;
		email: string;
		username: string;
		displayName: string;
		avatarUrl: string | null;
		createdAt: Date;
		updatedAt: Date;
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
}): Message => ({
	id: m.id,
	chatId: m.conversationId,
	sender: formatUser(m.sender),
	content: m.content ?? undefined,
	type: m.type,
	attachments: m.attachments.map(formatAttachment),
	ogEmbed: m.ogEmbed as Message['ogEmbed'],
	editedAt: m.editedAt?.toISOString(),
	deletedAt: m.deletedAt?.toISOString(),
	createdAt: m.createdAt.toISOString()
});

export const listMessages: RequestHandler = async (req, res) => {
	const chatId = req.params['id'] as string;
	const userId = req.user!.sub;
	const { cursor, limit = '50' } = req.query as { cursor?: string; limit?: string };
	const limitNum = Number(limit);
	// Check if user is participant
	const participant = await prisma.conversationParticipant.findUnique({
		where: { conversationId_userId: { conversationId: chatId, userId } }
	});

	if (!participant) {
		throw errors.forbidden('Not a participant');
	}

	const messages = await prisma.message.findMany({
		where: { conversationId: chatId },
		include: {
			sender: true,
			attachments: true
		},
		orderBy: { createdAt: 'desc' },
		take: limitNum + 1,
		...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
	});
	const hasMore = messages.length > limitNum;
	const data = hasMore ? messages.slice(0, -1) : messages;
	const pagination: CursorPage = {
		hasMore,
		...(hasMore && data.length > 0 && { nextCursor: data[data.length - 1]?.id })
	};

	res.json({
		data: data.map((m) => formatMessage(m)),
		pagination
	});
};
