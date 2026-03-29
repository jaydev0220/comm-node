import { prisma } from '../lib/db.js';
import { errors } from '../middleware/error-handler.js';
import type { User, Friendship } from '@packages/schemas';

export const listFriends = async (userId: string): Promise<User[]> => {
	const friendships = await prisma.friendship.findMany({
		where: {
			status: 'ACCEPTED',
			OR: [{ requesterId: userId }, { addresseeId: userId }]
		},
		include: {
			requester: true,
			addressee: true
		}
	});

	return friendships.map((f) => {
		const friend = f.requesterId === userId ? f.addressee : f.requester;
		return formatUser(friend);
	});
};

export const listPendingRequests = async (userId: string): Promise<Friendship[]> => {
	const requests = await prisma.friendship.findMany({
		where: {
			addresseeId: userId,
			status: 'PENDING'
		},
		include: {
			requester: true,
			addressee: true
		}
	});
	return requests.map(formatFriendship);
};

export const sendFriendRequest = async (
	requesterId: string,
	addresseeId: string
): Promise<Friendship> => {
	if (requesterId === addresseeId) {
		throw errors.badRequest('Cannot send friend request to yourself');
	}

	// Check existing relationship
	const existing = await prisma.friendship.findFirst({
		where: {
			OR: [
				{ requesterId, addresseeId },
				{ requesterId: addresseeId, addresseeId: requesterId }
			]
		}
	});

	if (existing) {
		if (existing.status === 'BLOCKED') {
			throw errors.conflict('Cannot send request - blocked');
		}
		throw errors.conflict('Friend request already exists');
	}

	const friendship = await prisma.friendship.create({
		data: { requesterId, addresseeId, status: 'PENDING' },
		include: { requester: true, addressee: true }
	});
	return formatFriendship(friendship);
};

export const respondToRequest = async (
	userId: string,
	requestId: string,
	action: 'accept' | 'reject'
): Promise<Friendship | null> => {
	const friendship = await prisma.friendship.findUnique({
		where: { id: requestId },
		include: { requester: true, addressee: true }
	});

	if (!friendship || friendship.addresseeId !== userId) {
		throw errors.notFound('Friend request not found');
	}

	if (friendship.status !== 'PENDING') {
		throw errors.conflict('Request already processed');
	}

	if (action === 'reject') {
		await prisma.friendship.delete({ where: { id: requestId } });
		return null;
	}

	const updated = await prisma.friendship.update({
		where: { id: requestId },
		data: { status: 'ACCEPTED' },
		include: { requester: true, addressee: true }
	});
	return formatFriendship(updated);
};

export const removeFriend = async (userId: string, friendId: string): Promise<void> => {
	const friendship = await prisma.friendship.findFirst({
		where: {
			status: 'ACCEPTED',
			OR: [
				{ requesterId: userId, addresseeId: friendId },
				{ requesterId: friendId, addresseeId: userId }
			]
		}
	});

	if (!friendship) {
		throw errors.notFound('Friendship not found');
	}

	await prisma.friendship.delete({ where: { id: friendship.id } });
};

export const blockUser = async (blockerId: string, targetId: string): Promise<Friendship> => {
	if (blockerId === targetId) {
		throw errors.badRequest('Cannot block yourself');
	}

	// Delete existing friendship/request
	await prisma.friendship.deleteMany({
		where: {
			OR: [
				{ requesterId: blockerId, addresseeId: targetId },
				{ requesterId: targetId, addresseeId: blockerId }
			]
		}
	});

	const block = await prisma.friendship.create({
		data: { requesterId: blockerId, addresseeId: targetId, status: 'BLOCKED' },
		include: { requester: true, addressee: true }
	});
	return formatFriendship(block);
};

export const unblockUser = async (blockerId: string, targetId: string): Promise<void> => {
	const result = await prisma.friendship.deleteMany({
		where: {
			requesterId: blockerId,
			addresseeId: targetId,
			status: 'BLOCKED'
		}
	});

	if (result.count === 0) {
		throw errors.notFound('Block not found');
	}
};

// Helpers
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

const formatFriendship = (f: {
	id: string;
	status: string;
	requester: {
		id: string;
		email: string;
		username: string;
		displayName: string;
		avatarUrl: string | null;
		createdAt: Date;
		updatedAt: Date;
	};
	addressee: {
		id: string;
		email: string;
		username: string;
		displayName: string;
		avatarUrl: string | null;
		createdAt: Date;
		updatedAt: Date;
	};
	createdAt: Date;
	updatedAt: Date;
}): Friendship => ({
	id: f.id,
	status: f.status as Friendship['status'],
	requester: formatUser(f.requester),
	addressee: formatUser(f.addressee),
	createdAt: f.createdAt.toISOString(),
	updatedAt: f.updatedAt.toISOString()
});
