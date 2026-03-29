import { createHash, randomBytes } from 'crypto';
import type { LoginRequest, RegisterRequest, User } from '@packages/schemas';
import { signAccessToken } from '../lib/jwt.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { prisma } from '../lib/db.js';
import { errors } from '../middleware/error-handler.js';

// Hash refresh token for storage
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
// Helper to format user for API response
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

export const registerUser = async (
	data: RegisterRequest
): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
	const existing = await prisma.user.findFirst({
		where: { OR: [{ email: data.email }, { username: data.username }] }
	});

	if (existing) {
		throw errors.conflict(
			existing.email === data.email ? 'Email already taken' : 'Username already taken'
		);
	}

	const passwordHash = await hashPassword(data.password);
	const user = await prisma.user.create({
		data: {
			email: data.email,
			username: data.username,
			displayName: data.displayName,
			passwordHash
		}
	});
	const accessToken = await signAccessToken(user.id, user.email);
	const refreshToken = randomBytes(32).toString('hex');

	await prisma.refreshToken.create({
		data: {
			userId: user.id,
			tokenHash: hashToken(refreshToken),
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
		}
	});
	return { user: formatUser(user), accessToken, refreshToken };
};

export const loginUser = async (
	data: LoginRequest
): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
	const user = await prisma.user.findUnique({ where: { email: data.email } });

	if (!user || !user.passwordHash) {
		throw errors.unauthorized('Invalid email or password');
	}

	const valid = await verifyPassword(data.password, user.passwordHash);

	if (!valid) {
		throw errors.unauthorized('Invalid email or password');
	}

	const accessToken = await signAccessToken(user.id, user.email);
	const refreshToken = randomBytes(32).toString('hex');

	await prisma.refreshToken.create({
		data: {
			userId: user.id,
			tokenHash: hashToken(refreshToken),
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		}
	});
	return { user: formatUser(user), accessToken, refreshToken };
};

export const refreshTokens = async (
	token: string
): Promise<{ accessToken: string; refreshToken: string }> => {
	const tokenHash = hashToken(token);
	const stored = await prisma.refreshToken.findUnique({
		where: { tokenHash },
		include: { user: true }
	});

	if (!stored || stored.expiresAt < new Date()) {
		throw errors.unauthorized('Invalid or expired refresh token');
	}

	// Delete old token (rotation)
	await prisma.refreshToken.delete({ where: { id: stored.id } });

	const accessToken = await signAccessToken(stored.user.id, stored.user.email);
	const newRefreshToken = randomBytes(32).toString('hex');

	await prisma.refreshToken.create({
		data: {
			userId: stored.user.id,
			tokenHash: hashToken(newRefreshToken),
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		}
	});
	return { accessToken, refreshToken: newRefreshToken };
};

export const logoutUser = async (refreshToken: string): Promise<void> => {
	const tokenHash = hashToken(refreshToken);

	await prisma.refreshToken.deleteMany({ where: { tokenHash } });
};
