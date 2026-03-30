/**
 * Unit tests for search.controller.ts
 * Uses Node.js built-in test runner with mocked services.
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
	createMockRequest,
	createMockResponse,
	createMockUser,
	type MockResponse
} from '../setup.js';

// Mock the service module
const mockSearchService = {
	searchUsers: mock.fn(),
	searchMessages: mock.fn()
};

mock.module('../../src/services/search.service.js', { namedExports: mockSearchService });

// Import controller after mocking
const { search } = await import('../../src/controllers/search.controller.js');

describe('Search Controller', () => {
	let res: MockResponse;

	beforeEach(() => {
		res = createMockResponse();
		mockSearchService.searchUsers.mock.resetCalls();
		mockSearchService.searchMessages.mock.resetCalls();
	});
	describe('search', () => {
		it('should search users when type is users', async () => {
			const userResults = {
				data: [
					{ id: 'user-1', username: 'john', displayName: 'John Doe' },
					{ id: 'user-2', username: 'jane', displayName: 'Jane Doe' }
				],
				pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
			};

			mockSearchService.searchUsers.mock.mockImplementationOnce(() => Promise.resolve(userResults));

			const req = createMockRequest({
				user: createMockUser({ sub: 'searcher-user' }),
				query: { type: 'users', q: 'john' }
			});

			await search(req as never, res as never, () => {});
			assert.deepStrictEqual(res._json, userResults);
			assert.strictEqual(mockSearchService.searchMessages.mock.calls.length, 0);
		});
		it('should search messages when type is messages', async () => {
			const messageResults = {
				data: [
					{ id: 'msg-1', content: 'Hello world', chatId: 'chat-1' },
					{ id: 'msg-2', content: 'Hello there', chatId: 'chat-2' }
				],
				pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
			};

			mockSearchService.searchMessages.mock.mockImplementationOnce(() =>
				Promise.resolve(messageResults)
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'searcher-user' }),
				query: { type: 'messages', q: 'hello' }
			});

			await search(req as never, res as never, () => {});
			assert.deepStrictEqual(res._json, messageResults);
			assert.strictEqual(mockSearchService.searchUsers.mock.calls.length, 0);
		});
		it('should pass user ID and params to searchUsers', async () => {
			mockSearchService.searchUsers.mock.mockImplementationOnce(() =>
				Promise.resolve({ data: [], pagination: {} })
			);

			const queryParams = { type: 'users', q: 'test', page: '2', limit: '20' };
			const req = createMockRequest({
				user: createMockUser({ sub: 'user-xyz' }),
				query: queryParams
			});

			await search(req as never, res as never, () => {});
			assert.strictEqual(mockSearchService.searchUsers.mock.calls[0]?.arguments[0], 'user-xyz');
			assert.deepStrictEqual(
				mockSearchService.searchUsers.mock.calls[0]?.arguments[1],
				queryParams
			);
		});
		it('should pass user ID and params to searchMessages', async () => {
			mockSearchService.searchMessages.mock.mockImplementationOnce(() =>
				Promise.resolve({ data: [], pagination: {} })
			);

			const queryParams = { type: 'messages', q: 'keyword', chatId: 'chat-123' };
			const req = createMockRequest({
				user: createMockUser({ sub: 'user-abc' }),
				query: queryParams
			});

			await search(req as never, res as never, () => {});
			assert.strictEqual(mockSearchService.searchMessages.mock.calls[0]?.arguments[0], 'user-abc');
			assert.deepStrictEqual(
				mockSearchService.searchMessages.mock.calls[0]?.arguments[1],
				queryParams
			);
		});
		it('should handle empty search results for users', async () => {
			const emptyResults = {
				data: [],
				pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
			};

			mockSearchService.searchUsers.mock.mockImplementationOnce(() =>
				Promise.resolve(emptyResults)
			);

			const req = createMockRequest({
				user: createMockUser(),
				query: { type: 'users', q: 'nonexistent' }
			});

			await search(req as never, res as never, () => {});
			assert.deepStrictEqual(res._json, emptyResults);
		});
		it('should handle empty search results for messages', async () => {
			const emptyResults = {
				data: [],
				pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
			};

			mockSearchService.searchMessages.mock.mockImplementationOnce(() =>
				Promise.resolve(emptyResults)
			);

			const req = createMockRequest({
				user: createMockUser(),
				query: { type: 'messages', q: 'no-match' }
			});

			await search(req as never, res as never, () => {});
			assert.deepStrictEqual(res._json, emptyResults);
		});
		it('should search messages when type is not users', async () => {
			mockSearchService.searchMessages.mock.mockImplementationOnce(() =>
				Promise.resolve({ data: [], pagination: {} })
			);

			const req = createMockRequest({
				user: createMockUser(),
				query: { type: 'other', q: 'test' }
			});

			await search(req as never, res as never, () => {});
			// Should fall through to searchMessages since type !== 'users'
			assert.strictEqual(mockSearchService.searchMessages.mock.calls.length, 1);
			assert.strictEqual(mockSearchService.searchUsers.mock.calls.length, 0);
		});
	});
});
