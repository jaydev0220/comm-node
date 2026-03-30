import { createHash, randomBytes } from 'crypto';
import type { GoogleCompleteRequest, LoginRequest, RegisterRequest, User } from '@packages/schemas';
import { signAccessToken } from '../lib/jwt.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { prisma } from '../lib/db.js';
import { errors } from '../middleware/error-handler.js';
import { getGoogleUserInfo, type GoogleUserInfo } from '../lib/google-oauth.js';
import { signSetupToken, verifySetupToken } from '../lib/setup-token.js';

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

// ─── Google OAuth ────────────────────────────────────────

export type GoogleCallbackResult =
	| { type: 'login'; user: User; accessToken: string; refreshToken: string }
	| { type: 'setup'; setupToken: string; email: string };

/**
 * Check if user has a complete profile (has username set).
 * OAuth users without username are considered incomplete.
 */
const hasCompleteProfile = (user: { username: string }): boolean => {
	// Username is required and validated, so if it exists the profile is complete
	return user.username.length > 0;
};

/**
 * Issue tokens for an existing user (login flow).
 */
const issueTokensForUser = async (
	user: { id: string; email: string; username: string; displayName: string; avatarUrl: string | null; createdAt: Date; updatedAt: Date }
): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
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

/**
 * Handle Google OAuth callback.
 * Returns login result for existing users with complete profiles,
 * or setup token for new/incomplete users.
 */
export const handleGoogleCallback = async (code: string): Promise<GoogleCallbackResult> => {
	// Exchange code for Google user info
	let googleUser: GoogleUserInfo;

	try {
		googleUser = await getGoogleUserInfo(code);
	} catch (error) {
		throw errors.badRequest(
			error instanceof Error ? error.message : 'Failed to authenticate with Google'
		);
	}

	// Check if OAuth account exists
	const existingOAuth = await prisma.oAuthAccount.findUnique({
		where: {
			provider_providerAccountId: {
				provider: 'GOOGLE',
				providerAccountId: googleUser.googleId
			}
		},
		include: { user: true }
	});

	if (existingOAuth) {
		// Existing OAuth account found
		if (hasCompleteProfile(existingOAuth.user)) {
			// Complete profile → login
			const tokens = await issueTokensForUser(existingOAuth.user);
			return { type: 'login', ...tokens };
		}

		// Incomplete profile → setup flow
		const setupToken = await signSetupToken(existingOAuth.user.email, googleUser.googleId);
		return { type: 'setup', setupToken, email: existingOAuth.user.email };
	}

	// Check if email matches existing password-based user
	const existingUser = await prisma.user.findUnique({
		where: { email: googleUser.email }
	});

	if (existingUser) {
		// Link Google account to existing user
		await prisma.oAuthAccount.create({
			data: {
				userId: existingUser.id,
				provider: 'GOOGLE',
				providerAccountId: googleUser.googleId
			}
		});

		if (hasCompleteProfile(existingUser)) {
			// Existing user with complete profile → login
			const tokens = await issueTokensForUser(existingUser);
			return { type: 'login', ...tokens };
		}

		// Incomplete profile → setup flow (unlikely for password users, but handle it)
		const setupToken = await signSetupToken(existingUser.email, googleUser.googleId);
		return { type: 'setup', setupToken, email: existingUser.email };
	}

	// New user → create partial record and return setup token
	// Use a placeholder username that will be replaced during setup
	const placeholderUsername = `pending_${randomBytes(8).toString('hex')}`;
	const newUser = await prisma.user.create({
		data: {
			email: googleUser.email,
			username: placeholderUsername,
			displayName: googleUser.name ?? googleUser.email.split('@')[0] ?? 'User',
			avatarUrl: googleUser.picture ?? null,
			oauthAccounts: {
				create: {
					provider: 'GOOGLE',
					providerAccountId: googleUser.googleId
				}
			}
		}
	});
	const setupToken = await signSetupToken(newUser.email, googleUser.googleId);
	return { type: 'setup', setupToken, email: newUser.email };
};

/**
 * Complete Google OAuth registration with profile data.
 */
export const completeGoogleSetup = async (
	data: GoogleCompleteRequest
): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
	// Verify setup token
	const payload = await verifySetupToken(data.token);

	if (!payload) {
		throw errors.unauthorized('Invalid or expired setup token');
	}

	// Find the OAuth account
	const oauthAccount = await prisma.oAuthAccount.findUnique({
		where: {
			provider_providerAccountId: {
				provider: 'GOOGLE',
				providerAccountId: payload.googleId
			}
		},
		include: { user: true }
	});

	if (!oauthAccount) {
		throw errors.notFound('OAuth account not found');
	}
	// Verify email matches
	if (oauthAccount.user.email !== payload.email) {
		throw errors.forbidden('Email mismatch');
	}

	// Check username uniqueness (excluding current user)
	const existingUsername = await prisma.user.findFirst({
		where: {
			username: data.username,
			NOT: { id: oauthAccount.user.id }
		}
	});

	if (existingUsername) {
		throw errors.conflict('Username already taken');
	}

	// Update user profile
	const updatedUser = await prisma.user.update({
		where: { id: oauthAccount.user.id },
		data: {
			username: data.username,
			displayName: data.displayName,
			avatarUrl: data.avatarUrl ?? oauthAccount.user.avatarUrl
		}
	});
	return issueTokensForUser(updatedUser);
};
