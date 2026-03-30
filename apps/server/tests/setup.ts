/**
 * Test utilities and mock factories for controller unit tests.
 * Uses Node.js built-in test runner with tsx.
 */

import type { Request, Response, NextFunction } from 'express';
import type { TokenPayload } from '../src/lib/jwt.js';

/**
 * Mock user data factory
 */
export const createMockUser = (overrides: Partial<TokenPayload> = {}): TokenPayload => ({
	sub: 'user-123',
	email: 'test@example.com',
	type: 'access',
	iat: Math.floor(Date.now() / 1000),
	exp: Math.floor(Date.now() / 1000) + 3600,
	...overrides
});

/**
 * Database user format (as returned from Prisma)
 */
export interface MockDbUser {
	id: string;
	email: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export const createMockDbUser = (overrides: Partial<MockDbUser> = {}): MockDbUser => ({
	id: 'user-123',
	email: 'test@example.com',
	username: 'testuser',
	displayName: 'Test User',
	avatarUrl: null,
	createdAt: new Date('2024-01-01'),
	updatedAt: new Date('2024-01-01'),
	...overrides
});

/**
 * API user format (as returned to client)
 */
export interface MockApiUser {
	id: string;
	email: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export const createMockApiUser = (overrides: Partial<MockApiUser> = {}): MockApiUser => ({
	id: 'user-123',
	email: 'test@example.com',
	username: 'testuser',
	displayName: 'Test User',
	avatarUrl: null,
	createdAt: '2024-01-01T00:00:00.000Z',
	updatedAt: '2024-01-01T00:00:00.000Z',
	...overrides
});

/**
 * Mock Express Request factory
 */
export interface MockRequestOptions {
	body?: Record<string, unknown>;
	params?: Record<string, string>;
	query?: Record<string, string>;
	user?: TokenPayload;
	headers?: Record<string, string>;
	cookies?: Record<string, string>;
	file?: Express.Multer.File;
}

export const createMockRequest = (options: MockRequestOptions = {}): Partial<Request> => ({
	body: options.body ?? {},
	params: options.params ?? {},
	query: options.query ?? {},
	user: options.user,
	headers: options.headers ?? {},
	cookies: options.cookies ?? {},
	file: options.file
});

/**
 * Mock Express Response factory with tracking
 */
export interface MockResponse {
	status: ReturnType<typeof createStatusMock>;
	json: ReturnType<typeof createJsonMock>;
	cookie: ReturnType<typeof createCookieMock>;
	clearCookie: ReturnType<typeof createClearCookieMock>;
	redirect: ReturnType<typeof createRedirectMock>;
	_status: number | null;
	_json: unknown;
	_cookies: Map<string, { value: string; options?: unknown }>;
	_clearedCookies: Set<string>;
	_redirectUrl: string | null;
}

const createStatusMock = (res: MockResponse) => {
	const fn = (code: number) => {
		res._status = code;
		return res;
	};
	fn.mock = { calls: [] as number[][] };
	const original = fn;
	return Object.assign(
		(code: number) => {
			fn.mock.calls.push([code]);
			return original(code);
		},
		{ mock: fn.mock }
	);
};

const createJsonMock = (res: MockResponse) => {
	const fn = (data: unknown) => {
		res._json = data;
		return res;
	};
	fn.mock = { calls: [] as unknown[][] };
	const original = fn;
	return Object.assign(
		(data: unknown) => {
			fn.mock.calls.push([data]);
			return original(data);
		},
		{ mock: fn.mock }
	);
};

const createCookieMock = (res: MockResponse) => {
	const fn = (name: string, value: string, options?: unknown) => {
		res._cookies.set(name, { value, options });
		return res;
	};
	fn.mock = { calls: [] as unknown[][] };
	const original = fn;
	return Object.assign(
		(name: string, value: string, options?: unknown) => {
			fn.mock.calls.push([name, value, options]);
			return original(name, value, options);
		},
		{ mock: fn.mock }
	);
};

const createClearCookieMock = (res: MockResponse) => {
	const fn = (name: string) => {
		res._clearedCookies.add(name);
		return res;
	};
	fn.mock = { calls: [] as string[][] };
	const original = fn;
	return Object.assign(
		(name: string) => {
			fn.mock.calls.push([name]);
			return original(name);
		},
		{ mock: fn.mock }
	);
};

const createRedirectMock = (res: MockResponse) => {
	const fn = (url: string) => {
		res._redirectUrl = url;
		return res;
	};
	fn.mock = { calls: [] as string[][] };
	const original = fn;
	return Object.assign(
		(url: string) => {
			fn.mock.calls.push([url]);
			return original(url);
		},
		{ mock: fn.mock }
	);
};

export const createMockResponse = (): MockResponse => {
	const res: MockResponse = {
		_status: null,
		_json: null,
		_cookies: new Map(),
		_clearedCookies: new Set(),
		_redirectUrl: null
	} as MockResponse;

	res.status = createStatusMock(res);
	res.json = createJsonMock(res);
	res.cookie = createCookieMock(res);
	res.clearCookie = createClearCookieMock(res);
	res.redirect = createRedirectMock(res);

	return res;
};

/**
 * Mock NextFunction factory
 */
export const createMockNext = (): NextFunction & { mock: { calls: unknown[][] } } => {
	const calls: unknown[][] = [];
	const fn = ((err?: unknown) => {
		calls.push(err !== undefined ? [err] : []);
	}) as NextFunction & { mock: { calls: unknown[][] } };
	fn.mock = { calls };
	return fn;
};

/**
 * Assert helper for checking error throws
 */
export const assertThrowsAppError = async (
	fn: () => Promise<void>,
	expectedStatus: number,
	expectedCode: string
): Promise<void> => {
	try {
		await fn();
		throw new Error('Expected function to throw');
	} catch (error) {
		const appError = error as { status?: number; code?: string; message?: string };
		if (appError.status !== expectedStatus) {
			throw new Error(`Expected status ${expectedStatus}, got ${appError.status}`);
		}
		if (appError.code !== expectedCode) {
			throw new Error(`Expected code ${expectedCode}, got ${appError.code}`);
		}
	}
};

/**
 * Assert helper for successful response
 */
export const assertJsonResponse = (
	res: MockResponse,
	expectedStatus: number,
	expectedData?: unknown
): void => {
	if (res._status !== expectedStatus) {
		throw new Error(`Expected status ${expectedStatus}, got ${res._status}`);
	}
	if (expectedData !== undefined) {
		const actualJson = JSON.stringify(res._json);
		const expectedJson = JSON.stringify(expectedData);
		if (actualJson !== expectedJson) {
			throw new Error(`Expected JSON ${expectedJson}, got ${actualJson}`);
		}
	}
};

/**
 * Create a mock function with call tracking
 */
export const createMockFn = <T extends (...args: unknown[]) => unknown>(
	implementation?: T
): T & { mock: { calls: Parameters<T>[] } } => {
	const calls: Parameters<T>[] = [];
	const fn = ((...args: Parameters<T>) => {
		calls.push(args);
		return implementation?.(...args);
	}) as T & { mock: { calls: Parameters<T>[] } };
	fn.mock = { calls };
	return fn;
};

/**
 * Create a mock function that returns a promise
 */
export const createMockAsyncFn = <T>(
	returnValue: T
): ((...args: unknown[]) => Promise<T>) & { mock: { calls: unknown[][] } } => {
	const calls: unknown[][] = [];
	const fn = (async (...args: unknown[]) => {
		calls.push(args);
		return returnValue;
	}) as ((...args: unknown[]) => Promise<T>) & { mock: { calls: unknown[][] } };
	fn.mock = { calls };
	return fn;
};

/**
 * Create a mock function that throws an error
 */
export const createMockRejectFn = (
	error: Error
): ((...args: unknown[]) => Promise<never>) & { mock: { calls: unknown[][] } } => {
	const calls: unknown[][] = [];
	const fn = (async (...args: unknown[]) => {
		calls.push(args);
		throw error;
	}) as ((...args: unknown[]) => Promise<never>) & { mock: { calls: unknown[][] } };
	fn.mock = { calls };
	return fn;
};
