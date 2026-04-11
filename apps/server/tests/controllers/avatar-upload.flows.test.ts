import assert from 'node:assert';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { TokenPayload } from '../../src/lib/jwt.js';
import { createMockApiUser } from '../setup.js';

const mockAuthService = {
	registerUser: mock.fn(),
	startEmailRegistration: mock.fn(),
	completeEmailRegistration: mock.fn(),
	loginUser: mock.fn(),
	logoutUser: mock.fn(),
	refreshTokens: mock.fn(),
	handleGoogleCallback: mock.fn(),
	completeGoogleSetup: mock.fn()
};
const mockUsersService = {
	findById: mock.fn(),
	updateUser: mock.fn(),
	updateUserAvatar: mock.fn(),
	deleteUser: mock.fn(),
	searchUsers: mock.fn()
};
const mockGoogleOAuth = {
	buildAuthorizationUrl: mock.fn(() => 'https://accounts.google.com/oauth')
};
const mockEnv = {
	env: {
		GOOGLE_SUCCESS_REDIRECT_URL: 'http://localhost:3001/auth/success',
		GOOGLE_SETUP_REDIRECT_URL: 'http://localhost:3001/register/google'
	}
};
const authenticatedUser: TokenPayload = {
	sub: 'user-123',
	email: 'test@example.com',
	type: 'access',
	iat: Math.floor(Date.now() / 1000),
	exp: Math.floor(Date.now() / 1000) + 3600
};

mock.module('../../src/services/auth.service.js', { namedExports: mockAuthService });
mock.module('../../src/services/users.service.js', { namedExports: mockUsersService });
mock.module('../../src/lib/google-oauth.js', { namedExports: mockGoogleOAuth });
mock.module('../../src/lib/env.js', { namedExports: mockEnv });
mock.module('../../src/middleware/auth.js', {
	namedExports: {
		authenticate: (req: Request, _res: Response, next: NextFunction) => {
			req.user = authenticatedUser;
			next();
		}
	}
});

const authRoutes = (await import('../../src/routes/auth.routes.js')).default;
const usersRoutes = (await import('../../src/routes/users.routes.js')).default;
const { errorHandler, notFoundHandler } = await import('../../src/middleware/error-handler.js');

const getAvatarPathArg = (value: unknown): string | null => {
	if (typeof value !== 'string' || !value.startsWith('/uploads/')) {
		return null;
	}
	return value;
};

const cleanupUploadedFile = async (avatarPathArg: unknown): Promise<void> => {
	const avatarPath = getAvatarPathArg(avatarPathArg);

	if (!avatarPath) {
		return;
	}

	await unlink(path.resolve(process.cwd(), avatarPath.slice(1))).catch(() => {});
};

describe('Avatar upload flows', () => {
	let server: Server;
	let baseUrl = '';

	before(async () => {
		await mkdir(path.resolve(process.cwd(), 'uploads'), { recursive: true });

		const app = express();

		app.use(express.json({ limit: '10kb' }));
		app.use(express.urlencoded({ extended: false, limit: '10kb' }));
		app.use('/api/auth', authRoutes);
		app.use('/api/users', usersRoutes);
		app.use(notFoundHandler);
		app.use(errorHandler);
		server = app.listen(0);
		await new Promise<void>((resolve) => {
			server.once('listening', resolve);
		});

		const address = server.address();

		if (!address || typeof address === 'string') {
			throw new Error('Failed to start test server');
		}

		baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
	});
	after(async () => {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});
	});
	beforeEach(() => {
		mockAuthService.registerUser.mock.resetCalls();
		mockAuthService.startEmailRegistration.mock.resetCalls();
		mockAuthService.completeEmailRegistration.mock.resetCalls();
		mockAuthService.loginUser.mock.resetCalls();
		mockAuthService.logoutUser.mock.resetCalls();
		mockAuthService.refreshTokens.mock.resetCalls();
		mockAuthService.handleGoogleCallback.mock.resetCalls();
		mockAuthService.completeGoogleSetup.mock.resetCalls();
		mockUsersService.findById.mock.resetCalls();
		mockUsersService.updateUser.mock.resetCalls();
		mockUsersService.updateUserAvatar.mock.resetCalls();
		mockUsersService.deleteUser.mock.resetCalls();
		mockUsersService.searchUsers.mock.resetCalls();
		mockGoogleOAuth.buildAuthorizationUrl.mock.resetCalls();
	});
	afterEach(async () => {
		for (const call of mockAuthService.registerUser.mock.calls) {
			await cleanupUploadedFile(call.arguments[1]);
		}
		for (const call of mockAuthService.completeGoogleSetup.mock.calls) {
			await cleanupUploadedFile(call.arguments[1]);
		}
		for (const call of mockAuthService.completeEmailRegistration.mock.calls) {
			await cleanupUploadedFile(call.arguments[1]);
		}
		for (const call of mockUsersService.updateUserAvatar.mock.calls) {
			await cleanupUploadedFile(call.arguments[1]);
		}
	});
	it('email register start returns setup token and setup URL', async () => {
		mockAuthService.startEmailRegistration.mock.mockImplementationOnce(() =>
			Promise.resolve({
				setupToken: 'email.setup+token'
			})
		);

		const response = await fetch(`${baseUrl}/api/auth/register/start`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: 'register@example.com',
				password: 'password123'
			})
		});
		const data = (await response.json()) as { setupToken: string; setupUrl: string };

		assert.strictEqual(response.status, 201);
		assert.strictEqual(data.setupToken, 'email.setup+token');
		assert.strictEqual(data.setupUrl, '/register/setup?flow=email&token=email.setup%2Btoken');
		assert.deepStrictEqual(mockAuthService.startEmailRegistration.mock.calls[0]?.arguments, [
			{
				email: 'register@example.com',
				password: 'password123'
			}
		]);
	});
	it('email register completion accepts optional avatar file and passes avatar path', async () => {
		mockAuthService.completeEmailRegistration.mock.mockImplementationOnce(
			(_data: unknown, avatarUrl?: string) =>
				Promise.resolve({
					user: createMockApiUser({ avatarUrl: avatarUrl ?? null }),
					accessToken: 'complete-access-token',
					refreshToken: 'complete-refresh-token'
				})
		);

		const formData = new FormData();

		formData.set('token', 'email-setup-token');
		formData.set('username', 'email_user');
		formData.set('displayName', 'Email User');
		formData.set('avatar', new Blob(['avatar-content'], { type: 'image/png' }), 'avatar.png');

		const response = await fetch(`${baseUrl}/api/auth/register/complete`, {
			method: 'POST',
			body: formData
		});
		const data = (await response.json()) as { user: { avatarUrl?: string | null } };

		assert.strictEqual(response.status, 201);
		assert.ok(data.user.avatarUrl?.startsWith('/uploads/'));
		assert.deepStrictEqual(mockAuthService.completeEmailRegistration.mock.calls[0]?.arguments[0], {
			token: 'email-setup-token',
			username: 'email_user',
			displayName: 'Email User'
		});

		const avatarUrlArg = mockAuthService.completeEmailRegistration.mock.calls[0]?.arguments[1];

		assert.strictEqual(typeof avatarUrlArg, 'string');
		assert.ok((avatarUrlArg as string).startsWith('/uploads/'));
		assert.ok((avatarUrlArg as string).endsWith('.png'));
	});
	it('register accepts optional avatar file and passes avatar path', async () => {
		mockAuthService.registerUser.mock.mockImplementationOnce((_data: unknown, avatarUrl?: string) =>
			Promise.resolve({
				user: createMockApiUser({ avatarUrl: avatarUrl ?? null }),
				accessToken: 'register-access-token',
				refreshToken: 'register-refresh-token'
			})
		);

		const formData = new FormData();

		formData.set('email', 'register@example.com');
		formData.set('username', 'register_user');
		formData.set('displayName', 'Register User');
		formData.set('password', 'password123');
		formData.set('avatar', new Blob(['avatar-content'], { type: 'image/png' }), 'avatar.png');

		const response = await fetch(`${baseUrl}/api/auth/register`, {
			method: 'POST',
			body: formData
		});
		const data = (await response.json()) as { user: { avatarUrl?: string | null } };

		assert.strictEqual(response.status, 201);
		assert.ok(data.user.avatarUrl?.startsWith('/uploads/'));
		assert.strictEqual(mockAuthService.registerUser.mock.calls.length, 1);
		assert.deepStrictEqual(mockAuthService.registerUser.mock.calls[0]?.arguments[0], {
			email: 'register@example.com',
			username: 'register_user',
			displayName: 'Register User',
			password: 'password123'
		});

		const avatarUrlArg = mockAuthService.registerUser.mock.calls[0]?.arguments[1];

		assert.strictEqual(typeof avatarUrlArg, 'string');
		assert.ok((avatarUrlArg as string).startsWith('/uploads/'));
		assert.ok((avatarUrlArg as string).endsWith('.png'));
	});
	it('register ignores avatarUrl text input and keeps avatar optional', async () => {
		mockAuthService.registerUser.mock.mockImplementationOnce(() =>
			Promise.resolve({
				user: createMockApiUser(),
				accessToken: 'register-access-token',
				refreshToken: 'register-refresh-token'
			})
		);

		const formData = new FormData();

		formData.set('email', 'register@example.com');
		formData.set('username', 'register_user');
		formData.set('displayName', 'Register User');
		formData.set('password', 'password123');
		formData.set('avatarUrl', 'https://example.com/avatar.png');

		const response = await fetch(`${baseUrl}/api/auth/register`, {
			method: 'POST',
			body: formData
		});

		assert.strictEqual(response.status, 201);
		assert.deepStrictEqual(mockAuthService.registerUser.mock.calls[0]?.arguments, [
			{
				email: 'register@example.com',
				username: 'register_user',
				displayName: 'Register User',
				password: 'password123'
			},
			undefined
		]);
	});
	it('google completion accepts optional avatar file and passes avatar path', async () => {
		mockAuthService.completeGoogleSetup.mock.mockImplementationOnce(
			(_data: unknown, avatarUrl?: string) =>
				Promise.resolve({
					user: createMockApiUser({ avatarUrl: avatarUrl ?? null }),
					accessToken: 'complete-access-token',
					refreshToken: 'complete-refresh-token'
				})
		);

		const formData = new FormData();

		formData.set('token', 'setup-token');
		formData.set('username', 'google_user');
		formData.set('displayName', 'Google User');
		formData.set('avatar', new Blob(['avatar-content'], { type: 'image/png' }), 'avatar.png');

		const response = await fetch(`${baseUrl}/api/auth/google/complete`, {
			method: 'POST',
			body: formData
		});
		const data = (await response.json()) as { user: { avatarUrl?: string | null } };

		assert.strictEqual(response.status, 201);
		assert.ok(data.user.avatarUrl?.startsWith('/uploads/'));
		assert.deepStrictEqual(mockAuthService.completeGoogleSetup.mock.calls[0]?.arguments[0], {
			token: 'setup-token',
			username: 'google_user',
			displayName: 'Google User'
		});

		const avatarUrlArg = mockAuthService.completeGoogleSetup.mock.calls[0]?.arguments[1];

		assert.strictEqual(typeof avatarUrlArg, 'string');
		assert.ok((avatarUrlArg as string).startsWith('/uploads/'));
		assert.ok((avatarUrlArg as string).endsWith('.png'));
	});
	it('google completion ignores avatarUrl text input when no file is uploaded', async () => {
		mockAuthService.completeGoogleSetup.mock.mockImplementationOnce(() =>
			Promise.resolve({
				user: createMockApiUser(),
				accessToken: 'complete-access-token',
				refreshToken: 'complete-refresh-token'
			})
		);

		const formData = new FormData();

		formData.set('token', 'setup-token');
		formData.set('username', 'google_user');
		formData.set('displayName', 'Google User');
		formData.set('avatarUrl', 'https://example.com/avatar.png');

		const response = await fetch(`${baseUrl}/api/auth/google/complete`, {
			method: 'POST',
			body: formData
		});

		assert.strictEqual(response.status, 201);
		assert.deepStrictEqual(mockAuthService.completeGoogleSetup.mock.calls[0]?.arguments, [
			{
				token: 'setup-token',
				username: 'google_user',
				displayName: 'Google User'
			},
			undefined
		]);
	});
	it('profile avatar endpoint updates avatar when file is uploaded', async () => {
		mockUsersService.updateUserAvatar.mock.mockImplementationOnce(
			(_userId: string, avatarUrl: string) => Promise.resolve(createMockApiUser({ avatarUrl }))
		);

		const formData = new FormData();

		formData.set('avatar', new Blob(['avatar-content'], { type: 'image/png' }), 'avatar.png');

		const response = await fetch(`${baseUrl}/api/users/me/avatar`, {
			method: 'POST',
			body: formData
		});
		const data = (await response.json()) as { avatarUrl?: string | null };

		assert.strictEqual(response.status, 200);
		assert.ok(data.avatarUrl?.startsWith('/uploads/'));
		assert.strictEqual(mockUsersService.updateUserAvatar.mock.calls.length, 1);
		assert.strictEqual(mockUsersService.updateUserAvatar.mock.calls[0]?.arguments[0], 'user-123');

		const avatarUrlArg = mockUsersService.updateUserAvatar.mock.calls[0]?.arguments[1];

		assert.strictEqual(typeof avatarUrlArg, 'string');
		assert.ok((avatarUrlArg as string).startsWith('/uploads/'));
		assert.ok((avatarUrlArg as string).endsWith('.png'));
	});
	it('profile avatar endpoint returns bad request when file is missing', async () => {
		const response = await fetch(`${baseUrl}/api/users/me/avatar`, {
			method: 'POST',
			body: new FormData()
		});
		const data = (await response.json()) as { error: { code: string; message: string } };

		assert.strictEqual(response.status, 400);
		assert.strictEqual(data.error.code, 'BAD_REQUEST');
		assert.strictEqual(data.error.message, 'No avatar file provided');
	});
	it('profile avatar endpoint rejects invalid avatar mime type', async () => {
		const formData = new FormData();

		formData.set('avatar', new Blob(['not-an-image'], { type: 'text/plain' }), 'avatar.txt');

		const response = await fetch(`${baseUrl}/api/users/me/avatar`, {
			method: 'POST',
			body: formData
		});
		const data = (await response.json()) as { error: { code: string; message: string } };

		assert.strictEqual(response.status, 400);
		assert.strictEqual(data.error.code, 'BAD_REQUEST');
		assert.strictEqual(
			data.error.message,
			'Invalid avatar file type. Allowed: image/jpeg, image/png, image/gif, image/webp'
		);
	});
});
