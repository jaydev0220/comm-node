import { prisma } from '../lib/db.js';
import { errors } from '../middleware/error-handler.js';
import type {
	Chat,
	CreateChatRequest,
	UpdateChatRequest,
	ListChatsParams,
	CursorPage,
	Participant,
	User,
	Message,
	Attachment
} from '@packages/schemas';

export const listChats = async (
	userId: string,
	params: ListChatsParams
): Promise<{ data: Chat[]; pagination: CursorPage }> => {
	const { cursor, limit } = params;
	const conversations = await prisma.conversation.findMany({
		where: {
			participants: { some: { userId } }
		},
		include: {
			participants: {
				include: { user: true }
			},
			messages: {
				orderBy: { createdAt: 'desc' },
				take: 1,
				include: { sender: true, attachments: true }
			}
		},
		orderBy: { updatedAt: 'desc' },
		take: limit + 1,
		...(cursor && { cursor: { id: cursor }, skip: 1 })
	});
	const hasMore = conversations.length > limit;
	const data = hasMore ? conversations.slice(0, -1) : conversations;
	return {
		data: data.map(formatChat),
		pagination: {
			hasMore,
			...(hasMore && { nextCursor: data[data.length - 1]?.id })
		}
	};
};

export const createChat = async (userId: string, data: CreateChatRequest): Promise<Chat> => {
	if (data.type === 'DIRECT') {
		// Check for existing DM
		const existing = await prisma.conversation.findFirst({
			where: {
				type: 'DIRECT',
				AND: [
					{ participants: { some: { userId } } },
					{ participants: { some: { userId: data.participantId } } }
				]
			}
		});

		if (existing) {
			throw errors.conflict('DM already exists with this user');
		}

		const conversation = await prisma.conversation.create({
			data: {
				type: 'DIRECT',
				participants: {
					create: [
						{ userId, role: 'MEMBER' },
						{ userId: data.participantId, role: 'MEMBER' }
					]
				}
			},
			include: {
				participants: { include: { user: true } },
				messages: {
					take: 0,
					include: { sender: true, attachments: true }
				}
			}
		});
		return formatChat(conversation);
	}

	// Group chat
	const conversation = await prisma.conversation.create({
		data: {
			type: 'GROUP',
			name: data.name,
			avatarUrl: data.avatarUrl ?? null,
			participants: {
				create: [
					{ userId, role: 'OWNER' },
					...data.memberIds.map((id) => ({
						userId: id,
						role: 'MEMBER' as const
					}))
				]
			}
		},
		include: {
			participants: { include: { user: true } },
			messages: {
				take: 0,
				include: { sender: true, attachments: true }
			}
		}
	});
	return formatChat(conversation);
};

export const getChat = async (userId: string, chatId: string): Promise<Chat> => {
	const conversation = await prisma.conversation.findUnique({
		where: { id: chatId },
		include: {
			participants: { include: { user: true } },
			messages: {
				orderBy: { createdAt: 'desc' },
				take: 1,
				include: { sender: true, attachments: true }
			}
		}
	});

	if (!conversation) {
		throw errors.notFound('Chat not found');
	}

	const isParticipant = conversation.participants.some((p) => p.userId === userId);

	if (!isParticipant) {
		throw errors.forbidden('You are not a participant of this chat');
	}
	return formatChat(conversation);
};

export const updateChat = async (
	userId: string,
	chatId: string,
	data: UpdateChatRequest
): Promise<Chat> => {
	const conversation = await prisma.conversation.findUnique({
		where: { id: chatId },
		include: { participants: true }
	});

	if (!conversation) {
		throw errors.notFound('Chat not found');
	}
	if (conversation.type !== 'GROUP') {
		throw errors.forbidden('Cannot update DM');
	}

	const participant = conversation.participants.find((p) => p.userId === userId);

	if (!participant || participant.role === 'MEMBER') {
		throw errors.forbidden('Only admins can update chat');
	}

	// Filter out undefined values for Prisma compatibility
	const updateData: Record<string, string | null> = {};

	if (data.name !== undefined) updateData['name'] = data.name;
	if (data.avatarUrl !== undefined) updateData['avatarUrl'] = data.avatarUrl ?? null;

	const updated = await prisma.conversation.update({
		where: { id: chatId },
		data: updateData,
		include: {
			participants: { include: { user: true } },
			messages: {
				orderBy: { createdAt: 'desc' },
				take: 1,
				include: { sender: true, attachments: true }
			}
		}
	});
	return formatChat(updated);
};

export const deleteChat = async (userId: string, chatId: string): Promise<void> => {
	const conversation = await prisma.conversation.findUnique({
		where: { id: chatId },
		include: { participants: true }
	});

	if (!conversation) {
		throw errors.notFound('Chat not found');
	}
	if (conversation.type !== 'GROUP') {
		throw errors.forbidden('Cannot delete DM');
	}

	const participant = conversation.participants.find((p) => p.userId === userId);

	if (!participant || participant.role !== 'OWNER') {
		throw errors.forbidden('Only owner can delete chat');
	}

	await prisma.conversation.delete({ where: { id: chatId } });
};

export const getParticipantRole = async (
	userId: string,
	chatId: string
): Promise<string | null> => {
	const participant = await prisma.conversationParticipant.findUnique({
		where: { conversationId_userId: { conversationId: chatId, userId } }
	});
	return participant?.role ?? null;
};

// Format helpers
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
const formatChat = (c: {
	id: string;
	type: 'DIRECT' | 'GROUP';
	name: string | null;
	avatarUrl: string | null;
	participants: Array<{
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
	}>;
	messages: Array<{
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
	}>;
	createdAt: Date;
	updatedAt: Date;
}): Chat => ({
	id: c.id,
	type: c.type,
	name: c.name ?? undefined,
	avatarUrl: c.avatarUrl ?? undefined,
	participants: c.participants.map(formatParticipant),
	lastMessage: c.messages[0] ? formatMessage(c.messages[0]) : undefined,
	createdAt: c.createdAt.toISOString(),
	updatedAt: c.updatedAt.toISOString()
});
