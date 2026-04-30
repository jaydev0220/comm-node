import { prisma } from '../lib/db.js';
import { errors } from '../middleware/error-handler.js';
import type { User, UpdateUserRequest, UserSearchParams, OffsetPage } from '@packages/schemas';

export const findById = async (id: string): Promise<User | null> => {
	const user = await prisma.user.findUnique({
		where: { id },
		select: {
			id: true,
			email: true,
			username: true,
			displayName: true,
			avatarUrl: true,
			passwordHash: true,
			oauthAccounts: { select: { id: true } },
			createdAt: true,
			updatedAt: true
		}
	});
	return user ? formatUser(user) : null;
};

export const updateUser = async (id: string, data: UpdateUserRequest): Promise<User> => {
	if (data.username) {
		const existing = await prisma.user.findFirst({
			where: { username: data.username, NOT: { id } }
		});

		if (existing) {
			throw errors.conflict('Username already taken');
		}
	}

	// Filter out undefined values for Prisma compatibility
	const updateData: Record<string, string> = {};

	if (data.username !== undefined) updateData['username'] = data.username;
	if (data.displayName !== undefined) updateData['displayName'] = data.displayName;

	const user = await prisma.user.update({
		where: { id },
		data: updateData,
		include: { oauthAccounts: { select: { id: true } } }
	});
	return formatUser(user);
};

export const updateUserAvatar = async (id: string, avatarUrl: string): Promise<User> => {
	const user = await prisma.user.update({
		where: { id },
		data: { avatarUrl },
		include: { oauthAccounts: { select: { id: true } } }
	});
	return formatUser(user);
};

export const deleteUser = async (id: string): Promise<void> => {
	await prisma.user.delete({ where: { id } });
};

export const updateUserPassword = async (id: string, hash: string): Promise<void> => {
	await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
};

export const searchUsers = async (
	params: UserSearchParams
): Promise<{ data: User[]; pagination: OffsetPage }> => {
	const { q, page, limit } = params;
	const skip = (page - 1) * limit;
	const whereClause = {
		OR: [
			{ username: { contains: q, mode: 'insensitive' as const } },
			{ displayName: { contains: q, mode: 'insensitive' as const } }
		]
	};
	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where: whereClause,
			skip,
			take: limit,
			orderBy: { username: 'asc' }
		}),
		prisma.user.count({ where: whereClause })
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

const formatUser = (user: {
	id: string;
	email: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	passwordHash: string | null;
	createdAt: Date;
	updatedAt: Date;
}): User => ({
	id: user.id,
	email: user.email,
	username: user.username,
	displayName: user.displayName,
	avatarUrl: user.avatarUrl ?? undefined,
	authMethods: user.passwordHash ? ['password'] : [],
	createdAt: user.createdAt.toISOString(),
	updatedAt: user.updatedAt.toISOString()
});
