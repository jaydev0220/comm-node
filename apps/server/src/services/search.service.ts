import { prisma } from '../lib/db.js';
import type { SearchParams, User, Message, OffsetPage, Attachment } from '@packages/schemas';

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

export const searchUsers = async (
	userId: string,
	params: SearchParams
): Promise<{ data: User[]; pagination: OffsetPage }> => {
	const { q, page = 1, limit = 20 } = params;
	const skip = (page - 1) * limit;

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where: {
				AND: [
					{ id: { not: userId } },
					{
						OR: [
							{ username: { contains: q, mode: 'insensitive' } },
							{ displayName: { contains: q, mode: 'insensitive' } }
						]
					}
				]
			},
			skip,
			take: limit,
			orderBy: { username: 'asc' }
		}),
		prisma.user.count({
			where: {
				AND: [
					{ id: { not: userId } },
					{
						OR: [
							{ username: { contains: q, mode: 'insensitive' } },
							{ displayName: { contains: q, mode: 'insensitive' } }
						]
					}
				]
			}
		})
	]);

	return {
		data: users.map(formatUser),
		pagination: {
			total,
			page,
			limit,
			hasMore: skip + users.length < total
		}
	};
};

export const searchMessages = async (
	userId: string,
	params: SearchParams
): Promise<{ data: Message[]; pagination: OffsetPage }> => {
	const { q, chatId, page = 1, limit = 20 } = params;
	const skip = (page - 1) * limit;

	const userChats = await prisma.conversationParticipant.findMany({
		where: { userId },
		select: { conversationId: true }
	});
	const chatIds = userChats.map((c) => c.conversationId);

	const targetChatIds = chatId ? [chatId].filter((id) => chatIds.includes(id)) : chatIds;

	if (targetChatIds.length === 0) {
		return {
			data: [],
			pagination: { total: 0, page, limit, hasMore: false }
		};
	}

	const [messages, total] = await Promise.all([
		prisma.message.findMany({
			where: {
				conversationId: { in: targetChatIds },
				content: { contains: q, mode: 'insensitive' },
				deletedAt: null
			},
			include: {
				sender: true,
				attachments: true
			},
			skip,
			take: limit,
			orderBy: { createdAt: 'desc' }
		}),
		prisma.message.count({
			where: {
				conversationId: { in: targetChatIds },
				content: { contains: q, mode: 'insensitive' },
				deletedAt: null
			}
		})
	]);

	return {
		data: messages.map(formatMessage),
		pagination: {
			total,
			page,
			limit,
			hasMore: skip + messages.length < total
		}
	};
};
