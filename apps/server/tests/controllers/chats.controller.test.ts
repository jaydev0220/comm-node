/**
 * Unit tests for chats.controller.ts
 * Uses Node.js built-in test runner with mocked services.
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createMockRequest, createMockResponse, createMockUser, type MockResponse } from '../setup.js';

// Mock the service module
const mockChatsService = {
	listChats: mock.fn(),
	createChat: mock.fn(),
	getChat: mock.fn(),
	updateChat: mock.fn(),
	deleteChat: mock.fn()
};

mock.module('../src/services/chats.service.js', { namedExports: mockChatsService });

// Import controller after mocking
const { listChats, createChat, getChat, updateChat, deleteChat } = await import(
	'../src/controllers/chats.controller.js'
);

// Helper to create mock chat data
const createMockChat = (overrides = {}) => ({
	id: 'chat-123',
	type: 'GROUP',
	name: 'Test Chat',
	avatarUrl: null,
	createdAt: '2024-01-01T00:00:00.000Z',
	updatedAt: '2024-01-01T00:00:00.000Z',
	...overrides
});

describe('Chats Controller', () => {
	let res: MockResponse;

	beforeEach(() => {
		res = createMockResponse();
		mockChatsService.listChats.mock.resetCalls();
		mockChatsService.createChat.mock.resetCalls();
		mockChatsService.getChat.mock.resetCalls();
		mockChatsService.updateChat.mock.resetCalls();
		mockChatsService.deleteChat.mock.resetCalls();
	});

	describe('listChats', () => {
		it('should return paginated list of chats', async () => {
			const listResult = {
				data: [createMockChat({ id: 'chat-1' }), createMockChat({ id: 'chat-2' })],
				pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
			};
			mockChatsService.listChats.mock.mockImplementationOnce(() => Promise.resolve(listResult));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				query: { page: '1', limit: '10' }
			});

			await listChats(req as never, res as never, () => {});

			assert.deepStrictEqual(res._json, listResult);
		});

		it('should pass user ID and query params to service', async () => {
			mockChatsService.listChats.mock.mockImplementationOnce(() =>
				Promise.resolve({ data: [], pagination: {} })
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-456' }),
				query: { type: 'GROUP', page: '2' }
			});

			await listChats(req as never, res as never, () => {});

			assert.strictEqual(mockChatsService.listChats.mock.calls[0]?.arguments[0], 'user-456');
			assert.deepStrictEqual(mockChatsService.listChats.mock.calls[0]?.arguments[1], {
				type: 'GROUP',
				page: '2'
			});
		});

		it('should handle empty chat list', async () => {
			const emptyResult = {
				data: [],
				pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
			};
			mockChatsService.listChats.mock.mockImplementationOnce(() => Promise.resolve(emptyResult));

			const req = createMockRequest({
				user: createMockUser(),
				query: {}
			});

			await listChats(req as never, res as never, () => {});

			assert.deepStrictEqual(res._json, emptyResult);
		});
	});

	describe('createChat', () => {
		it('should create a new chat and return 201', async () => {
			const newChat = createMockChat({ id: 'new-chat-id', name: 'New Chat' });
			mockChatsService.createChat.mock.mockImplementationOnce(() => Promise.resolve(newChat));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				body: { name: 'New Chat', type: 'GROUP', participantIds: ['user-456'] }
			});

			await createChat(req as never, res as never, () => {});

			assert.strictEqual(res._status, 201);
			assert.deepStrictEqual(res._json, newChat);
		});

		it('should pass user ID and body to service', async () => {
			mockChatsService.createChat.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockChat())
			);

			const body = { name: 'Team Chat', type: 'GROUP', participantIds: ['user-2', 'user-3'] };
			const req = createMockRequest({
				user: createMockUser({ sub: 'creator-id' }),
				body
			});

			await createChat(req as never, res as never, () => {});

			assert.strictEqual(mockChatsService.createChat.mock.calls[0]?.arguments[0], 'creator-id');
			assert.deepStrictEqual(mockChatsService.createChat.mock.calls[0]?.arguments[1], body);
		});

		it('should handle DM chat creation', async () => {
			const dmChat = createMockChat({ type: 'DM', name: null });
			mockChatsService.createChat.mock.mockImplementationOnce(() => Promise.resolve(dmChat));

			const req = createMockRequest({
				user: createMockUser(),
				body: { type: 'DM', participantIds: ['other-user'] }
			});

			await createChat(req as never, res as never, () => {});

			assert.strictEqual(res._status, 201);
			assert.strictEqual((res._json as { type: string }).type, 'DM');
		});
	});

	describe('getChat', () => {
		it('should return single chat by ID', async () => {
			const chat = createMockChat({ id: 'chat-xyz' });
			mockChatsService.getChat.mock.mockImplementationOnce(() => Promise.resolve(chat));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'chat-xyz' }
			});

			await getChat(req as never, res as never, () => {});

			assert.deepStrictEqual(res._json, chat);
		});

		it('should pass user ID and chat ID to service', async () => {
			mockChatsService.getChat.mock.mockImplementationOnce(() => Promise.resolve(createMockChat()));

			const req = createMockRequest({
				user: createMockUser({ sub: 'viewer-user' }),
				params: { id: 'target-chat-id' }
			});

			await getChat(req as never, res as never, () => {});

			assert.strictEqual(mockChatsService.getChat.mock.calls[0]?.arguments[0], 'viewer-user');
			assert.strictEqual(mockChatsService.getChat.mock.calls[0]?.arguments[1], 'target-chat-id');
		});
	});

	describe('updateChat', () => {
		it('should update chat and return updated data', async () => {
			const updatedChat = createMockChat({ name: 'Updated Name' });
			mockChatsService.updateChat.mock.mockImplementationOnce(() => Promise.resolve(updatedChat));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'chat-123' },
				body: { name: 'Updated Name' }
			});

			await updateChat(req as never, res as never, () => {});

			assert.deepStrictEqual(res._json, updatedChat);
		});

		it('should pass user ID, chat ID, and update data to service', async () => {
			mockChatsService.updateChat.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockChat())
			);

			const updateData = { name: 'New Name', avatarUrl: 'https://example.com/avatar.png' };
			const req = createMockRequest({
				user: createMockUser({ sub: 'admin-user' }),
				params: { id: 'chat-to-update' },
				body: updateData
			});

			await updateChat(req as never, res as never, () => {});

			assert.strictEqual(mockChatsService.updateChat.mock.calls[0]?.arguments[0], 'admin-user');
			assert.strictEqual(
				mockChatsService.updateChat.mock.calls[0]?.arguments[1],
				'chat-to-update'
			);
			assert.deepStrictEqual(mockChatsService.updateChat.mock.calls[0]?.arguments[2], updateData);
		});

		it('should handle partial updates', async () => {
			mockChatsService.updateChat.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockChat({ avatarUrl: 'new-avatar.jpg' }))
			);

			const req = createMockRequest({
				user: createMockUser(),
				params: { id: 'chat-123' },
				body: { avatarUrl: 'new-avatar.jpg' }
			});

			await updateChat(req as never, res as never, () => {});

			assert.strictEqual(mockChatsService.updateChat.mock.calls.length, 1);
		});
	});

	describe('deleteChat', () => {
		it('should delete chat and return 204', async () => {
			mockChatsService.deleteChat.mock.mockImplementationOnce(() => Promise.resolve());

			const req = createMockRequest({
				user: createMockUser({ sub: 'owner-user' }),
				params: { id: 'chat-to-delete' }
			});

			await deleteChat(req as never, res as never, () => {});

			assert.strictEqual(res._status, 204);
		});

		it('should pass user ID and chat ID to service', async () => {
			mockChatsService.deleteChat.mock.mockImplementationOnce(() => Promise.resolve());

			const req = createMockRequest({
				user: createMockUser({ sub: 'deleter-user' }),
				params: { id: 'doomed-chat' }
			});

			await deleteChat(req as never, res as never, () => {});

			assert.strictEqual(mockChatsService.deleteChat.mock.calls[0]?.arguments[0], 'deleter-user');
			assert.strictEqual(mockChatsService.deleteChat.mock.calls[0]?.arguments[1], 'doomed-chat');
		});
	});
});
