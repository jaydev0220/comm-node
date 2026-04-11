/**
 * Unit tests for auth.controller.ts
 * Uses Node.js built-in test runner with mocked services.
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
	createMockRequest,
	createMockResponse,
	createMockApiUser,
	type MockResponse
} from '../setup.js';

// Mock the service module before importing controller
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
const mockGoogleOAuth = {
	buildAuthorizationUrl: mock.fn(() => 'https://accounts.google.com/oauth')
};
const mockEnv = {
	env: {
		GOOGLE_SUCCESS_REDIRECT_URL: 'http://localhost:3001/auth/success',
		GOOGLE_SETUP_REDIRECT_URL: 'http://localhost:3001/register/google'
	}
};

// Mock modules
mock.module('../../src/services/auth.service.js', { namedExports: mockAuthService });
mock.module('../../src/lib/google-oauth.js', { namedExports: mockGoogleOAuth });
mock.module('../../src/lib/env.js', { namedExports: mockEnv });

// Import controller after mocking
const {
	register,
	registerStart,
	registerComplete,
	login,
	logout,
	refresh,
	googleAuth,
	googleCallback,
	googleComplete
} = await import('../../src/controllers/auth.controller.js');

describe('Auth Controller', () => {
	let res: MockResponse;

	beforeEach(() => {
		res = createMockResponse();
		mockAuthService.registerUser.mock.resetCalls();
		mockAuthService.startEmailRegistration.mock.resetCalls();
		mockAuthService.completeEmailRegistration.mock.resetCalls();
		mockAuthService.loginUser.mock.resetCalls();
		mockAuthService.logoutUser.mock.resetCalls();
		mockAuthService.refreshTokens.mock.resetCalls();
		mockAuthService.handleGoogleCallback.mock.resetCalls();
		mockAuthService.completeGoogleSetup.mock.resetCalls();
		mockGoogleOAuth.buildAuthorizationUrl.mock.resetCalls();
	});
	describe('register', () => {
		it('should register a new user and set refresh token cookie', async () => {
			const mockUser = createMockApiUser();
			const mockResult = {
				user: mockUser,
				accessToken: 'access-token-123',
				refreshToken: 'refresh-token-456'
			};

			mockAuthService.registerUser.mock.mockImplementationOnce(() => Promise.resolve(mockResult));

			const req = createMockRequest({
				body: {
					email: 'test@example.com',
					password: 'password123',
					username: 'testuser',
					displayName: 'Test User'
				}
			});

			await register(req as never, res as never, () => {});
			assert.strictEqual(res._status, 201);
			assert.deepStrictEqual(res._json, {
				accessToken: 'access-token-123',
				user: mockUser
			});
			assert.strictEqual(res._cookies.get('refreshToken')?.value, 'refresh-token-456');
		});
		it('should pass uploaded avatar URL to auth service', async () => {
			mockAuthService.registerUser.mock.mockImplementationOnce(() =>
				Promise.resolve({
					user: createMockApiUser(),
					accessToken: 'token',
					refreshToken: 'refresh'
				})
			);

			const body = {
				email: 'new@example.com',
				password: 'securepass',
				username: 'newuser',
				displayName: 'New User'
			};
			const req = createMockRequest({
				body,
				file: {
					fieldname: 'avatar',
					originalname: 'avatar.png',
					encoding: '7bit',
					mimetype: 'image/png',
					destination: 'uploads/',
					filename: 'avatar-file.png',
					path: 'uploads/avatar-file.png',
					size: 1024,
					stream: null as never,
					buffer: Buffer.from('')
				}
			});

			await register(req as never, res as never, () => {});
			assert.deepStrictEqual(mockAuthService.registerUser.mock.calls[0]?.arguments, [
				body,
				'/uploads/avatar-file.png'
			]);
		});
		it('should pass request body to auth service', async () => {
			const body = {
				email: 'new@example.com',
				password: 'securepass',
				username: 'newuser',
				displayName: 'New User'
			};

			mockAuthService.registerUser.mock.mockImplementationOnce(() =>
				Promise.resolve({
					user: createMockApiUser(),
					accessToken: 'token',
					refreshToken: 'refresh'
				})
			);

			const req = createMockRequest({ body });

			await register(req as never, res as never, () => {});
			assert.strictEqual(mockAuthService.registerUser.mock.calls.length, 1);
			assert.deepStrictEqual(mockAuthService.registerUser.mock.calls[0]?.arguments, [
				body,
				undefined
			]);
		});
	});
	describe('registerStart', () => {
		it('should create email setup token and return setup URL', async () => {
			const body = {
				email: 'setup@example.com',
				password: 'password123'
			};

			mockAuthService.startEmailRegistration.mock.mockImplementationOnce(() =>
				Promise.resolve({
					setupToken: 'setup.token+abc'
				})
			);

			const req = createMockRequest({ body });

			await registerStart(req as never, res as never, () => {});
			assert.strictEqual(res._status, 201);
			assert.deepStrictEqual(res._json, {
				setupToken: 'setup.token+abc',
				setupUrl: '/register/setup?flow=email&token=setup.token%2Babc'
			});
			assert.deepStrictEqual(mockAuthService.startEmailRegistration.mock.calls[0]?.arguments, [body]);
		});
	});
	describe('registerComplete', () => {
		it('should complete email registration and set refresh token cookie', async () => {
			const mockUser = createMockApiUser();
			const body = {
				token: 'register-setup-token',
				username: 'newuser',
				displayName: 'New User'
			};

			mockAuthService.completeEmailRegistration.mock.mockImplementationOnce(() =>
				Promise.resolve({
					user: mockUser,
					accessToken: 'access-token-123',
					refreshToken: 'refresh-token-456'
				})
			);

			const req = createMockRequest({ body });

			await registerComplete(req as never, res as never, () => {});
			assert.strictEqual(res._status, 201);
			assert.deepStrictEqual(res._json, {
				accessToken: 'access-token-123',
				user: mockUser
			});
			assert.strictEqual(res._cookies.get('refreshToken')?.value, 'refresh-token-456');
			assert.deepStrictEqual(mockAuthService.completeEmailRegistration.mock.calls[0]?.arguments, [
				body,
				undefined
			]);
		});
		it('should pass uploaded avatar URL to registration completion service', async () => {
			const body = {
				token: 'register-setup-token',
				username: 'newuser',
				displayName: 'New User'
			};

			mockAuthService.completeEmailRegistration.mock.mockImplementationOnce(() =>
				Promise.resolve({
					user: createMockApiUser(),
					accessToken: 'access-token-123',
					refreshToken: 'refresh-token-456'
				})
			);

			const req = createMockRequest({
				body,
				file: {
					fieldname: 'avatar',
					originalname: 'avatar.png',
					encoding: '7bit',
					mimetype: 'image/png',
					destination: 'uploads/',
					filename: 'avatar-file.png',
					path: 'uploads/avatar-file.png',
					size: 1024,
					stream: null as never,
					buffer: Buffer.from('')
				}
			});

			await registerComplete(req as never, res as never, () => {});
			assert.deepStrictEqual(mockAuthService.completeEmailRegistration.mock.calls[0]?.arguments, [
				body,
				'/uploads/avatar-file.png'
			]);
		});
	});
	describe('login', () => {
		it('should login user and set refresh token cookie', async () => {
			const mockUser = createMockApiUser();
			const mockResult = {
				user: mockUser,
				accessToken: 'access-token-789',
				refreshToken: 'refresh-token-012'
			};

			mockAuthService.loginUser.mock.mockImplementationOnce(() => Promise.resolve(mockResult));

			const req = createMockRequest({
				body: { email: 'test@example.com', password: 'password123' }
			});

			await login(req as never, res as never, () => {});
			assert.strictEqual(res._status, null); // json() doesn't set status (defaults to 200)
			assert.deepStrictEqual(res._json, {
				accessToken: 'access-token-789',
				user: mockUser
			});
			assert.strictEqual(res._cookies.get('refreshToken')?.value, 'refresh-token-012');
		});
		it('should set httpOnly cookie option', async () => {
			mockAuthService.loginUser.mock.mockImplementationOnce(() =>
				Promise.resolve({
					user: createMockApiUser(),
					accessToken: 'token',
					refreshToken: 'refresh'
				})
			);

			const req = createMockRequest({
				body: { email: 'test@example.com', password: 'password123' }
			});

			await login(req as never, res as never, () => {});

			const cookieOptions = res._cookies.get('refreshToken')?.options as Record<string, unknown>;

			assert.strictEqual(cookieOptions?.httpOnly, true);
		});
	});
	describe('logout', () => {
		it('should logout user and clear refresh token cookie', async () => {
			mockAuthService.logoutUser.mock.mockImplementationOnce(() => Promise.resolve());

			const req = createMockRequest({
				cookies: { refreshToken: 'refresh-token-to-invalidate' }
			});

			await logout(req as never, res as never, () => {});
			assert.strictEqual(res._status, 204);
			assert.strictEqual(mockAuthService.logoutUser.mock.calls.length, 1);
			assert.strictEqual(
				mockAuthService.logoutUser.mock.calls[0]?.arguments[0],
				'refresh-token-to-invalidate'
			);
			assert.ok(res._clearedCookies.has('refreshToken'));
		});
		it('should clear cookie even without refresh token', async () => {
			const req = createMockRequest({ cookies: {} });

			await logout(req as never, res as never, () => {});
			assert.strictEqual(res._status, 204);
			assert.strictEqual(mockAuthService.logoutUser.mock.calls.length, 0);
			assert.ok(res._clearedCookies.has('refreshToken'));
		});
	});
	describe('refresh', () => {
		it('should refresh tokens and set new cookie', async () => {
			mockAuthService.refreshTokens.mock.mockImplementationOnce(() =>
				Promise.resolve({
					accessToken: 'new-access-token',
					refreshToken: 'new-refresh-token'
				})
			);

			const req = createMockRequest({
				cookies: { refreshToken: 'old-refresh-token' }
			});

			await refresh(req as never, res as never, () => {});
			assert.deepStrictEqual(res._json, { accessToken: 'new-access-token' });
			assert.strictEqual(res._cookies.get('refreshToken')?.value, 'new-refresh-token');
		});
		it('should throw unauthorized when refresh token is missing', async () => {
			const req = createMockRequest({ cookies: {} });

			await assert.rejects(async () => {
				await refresh(req as never, res as never, () => {});
			}, /Missing refresh token/);
		});
	});
	describe('googleAuth', () => {
		it('should redirect to Google authorization URL', () => {
			const req = createMockRequest();

			googleAuth(req as never, res as never, () => {});
			assert.strictEqual(res._redirectUrl, 'https://accounts.google.com/oauth');
		});
	});
	describe('googleCallback', () => {
		it('should redirect to success URL for returning users', async () => {
			mockAuthService.handleGoogleCallback.mock.mockImplementationOnce(() =>
				Promise.resolve({
					type: 'login',
					accessToken: 'google-access-token',
					refreshToken: 'google-refresh-token'
				})
			);

			const req = createMockRequest({
				query: { code: 'google-auth-code' }
			});

			await googleCallback(req as never, res as never, () => {});
			assert.strictEqual(res._cookies.get('refreshToken')?.value, 'google-refresh-token');
			assert.ok(res._redirectUrl?.startsWith('http://localhost:3001/auth/success'));
			assert.ok(res._redirectUrl?.includes('accessToken=google-access-token'));
		});
		it('should redirect to setup URL for new users', async () => {
			mockAuthService.handleGoogleCallback.mock.mockImplementationOnce(() =>
				Promise.resolve({
					type: 'setup',
					setupToken: 'setup-token-xyz'
				})
			);

			const req = createMockRequest({
				query: { code: 'google-auth-code' }
			});

			await googleCallback(req as never, res as never, () => {});
			assert.ok(res._redirectUrl?.startsWith('http://localhost:3001/register/google'));
			assert.ok(res._redirectUrl?.includes('token=setup-token-xyz'));
		});
		it('should throw bad request when code is missing', async () => {
			const req = createMockRequest({ query: {} });

			await assert.rejects(async () => {
				await googleCallback(req as never, res as never, () => {});
			}, /Missing authorization code/);
		});
	});
	describe('googleComplete', () => {
		it('should complete Google setup and return user', async () => {
			const mockUser = createMockApiUser();
			const body = {
				token: 'setup-token',
				username: 'googleuser',
				displayName: 'Google User'
			};

			mockAuthService.completeGoogleSetup.mock.mockImplementationOnce(() =>
				Promise.resolve({
					user: mockUser,
					accessToken: 'complete-access-token',
					refreshToken: 'complete-refresh-token'
				})
			);

			const req = createMockRequest({
				body
			});

			await googleComplete(req as never, res as never, () => {});
			assert.strictEqual(res._status, 201);
			assert.deepStrictEqual(res._json, {
				accessToken: 'complete-access-token',
				user: mockUser
			});
			assert.strictEqual(res._cookies.get('refreshToken')?.value, 'complete-refresh-token');
			assert.deepStrictEqual(mockAuthService.completeGoogleSetup.mock.calls[0]?.arguments, [
				body,
				undefined
			]);
		});
		it('should pass uploaded avatar URL to auth service', async () => {
			const body = {
				token: 'setup-token',
				username: 'googleuser',
				displayName: 'Google User'
			};

			mockAuthService.completeGoogleSetup.mock.mockImplementationOnce(() =>
				Promise.resolve({
					user: createMockApiUser(),
					accessToken: 'complete-access-token',
					refreshToken: 'complete-refresh-token'
				})
			);

			const req = createMockRequest({
				body,
				file: {
					fieldname: 'avatar',
					originalname: 'avatar.png',
					encoding: '7bit',
					mimetype: 'image/png',
					destination: 'uploads/',
					filename: 'avatar-file.png',
					path: 'uploads/avatar-file.png',
					size: 1024,
					stream: null as never,
					buffer: Buffer.from('')
				}
			});

			await googleComplete(req as never, res as never, () => {});
			assert.deepStrictEqual(mockAuthService.completeGoogleSetup.mock.calls[0]?.arguments, [
				body,
				'/uploads/avatar-file.png'
			]);
		});
	});
});
