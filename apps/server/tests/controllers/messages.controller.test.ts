/**
 * Unit tests for messages.controller.ts
 * Uses Node.js built-in test runner with mocked database.
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createMockRequest, createMockResponse, createMockUser, type MockResponse } from '../setup.js';

// Mock prisma
const mockPrisma = {
	conversationParticipant: {
		findUnique: mock.fn()
	},
	message: {
		findMany: mock.fn()
	}
};

mock.module('../src/lib/db.js', {
	namedExports: { prisma: mockPrisma }
});

// Import controller after mocking
const { listMessages } = await import('../src/controllers/messages.controller.js');

// Helper to create mock message data
const createMockDbMessage = (overrides = {}) => ({
	id: 'msg-123',
	conversationId: 'chat-123',
	sender: {
		id: 'sender-123',
		email: 'sender@example.com',
		username: 'sender',
		displayName: 'Sender User',
		avatarUrl: null,
		createdAt: new Date('2024-01-01'),
		updatedAt: new Date('2024-01-01')
	},
	content: 'Hello, world!',
	type: 'TEXT' as const,
	attachments: [],
	ogEmbed: null,
	editedAt: null,
	deletedAt: null,
	createdAt: new Date('2024-01-15'),
	...overrides
});

const createMockApiMessage = (overrides = {}) => ({
	id: 'msg-123',
	chatId: 'chat-123',
	sender: {
		id: 'sender-123',
		email: 'sender@example.com',
		username: 'sender',
		displayName: 'Sender User',
		avatarUrl: undefined,
		createdAt: '2024-01-01T00:00:00.000Z',
		updatedAt: '2024-01-01T00:00:00.000Z'
	},
	content: 'Hello, world!',
	type: 'TEXT',
	attachments: [],
	ogEmbed: null,
	editedAt: undefined,
	deletedAt: undefined,
	createdAt: '2024-01-15T00:00:00.000Z',
	...overrides
});

describe('Messages Controller', () => {
	let res: MockResponse;

	beforeEach(() => {
		res = createMockResponse();
		mockPrisma.conversationParticipant.findUnique.mock.resetCalls();
		mockPrisma.message.findMany.mock.resetCalls();
	});

	describe('listMessages', () => {
		it('should return messages with pagination', async () => {
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'user-123', conversationId: 'chat-123', role: 'MEMBER' })
			);
			mockPrisma.message.findMany.mock.mockImplementationOnce(() =>
				Promise.resolve([createMockDbMessage({ id: 'msg-1' }), createMockDbMessage({ id: 'msg-2' })])
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'chat-123' },
				query: { limit: '50' }
			});

			await listMessages(req as never, res as never, () => {});

			assert.ok(res._json);
			const responseData = res._json as { data: unknown[]; pagination: { hasMore: boolean } };
			assert.strictEqual(responseData.data.length, 2);
			assert.strictEqual(responseData.pagination.hasMore, false);
		});

		it('should throw forbidden when user is not a participant', async () => {
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve(null)
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'non-participant' }),
				params: { id: 'chat-123' },
				query: {}
			});

			await assert.rejects(
				async () => {
					await listMessages(req as never, res as never, () => {});
				},
				{ message: 'Not a participant' }
			);
		});

		it('should handle cursor-based pagination', async () => {
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'user-123', conversationId: 'chat-123', role: 'MEMBER' })
			);
			mockPrisma.message.findMany.mock.mockImplementationOnce(() =>
				Promise.resolve([createMockDbMessage({ id: 'msg-older' })])
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'chat-123' },
				query: { cursor: 'msg-cursor', limit: '10' }
			});

			await listMessages(req as never, res as never, () => {});

			// Verify cursor was passed to query
			const findManyCall = mockPrisma.message.findMany.mock.calls[0];
			assert.ok(findManyCall?.arguments[0]?.cursor);
		});

		it('should indicate hasMore when more messages exist', async () => {
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'user-123', conversationId: 'chat-123', role: 'MEMBER' })
			);

			// Return more messages than requested to indicate hasMore
			const messages = Array.from({ length: 11 }, (_, i) =>
				createMockDbMessage({ id: `msg-${i}` })
			);
			mockPrisma.message.findMany.mock.mockImplementationOnce(() => Promise.resolve(messages));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'chat-123' },
				query: { limit: '10' }
			});

			await listMessages(req as never, res as never, () => {});

			const responseData = res._json as {
				data: unknown[];
				pagination: { hasMore: boolean; nextCursor?: string };
			};
			assert.strictEqual(responseData.pagination.hasMore, true);
			assert.strictEqual(responseData.data.length, 10);
			assert.ok(responseData.pagination.nextCursor);
		});

		it('should use default limit of 50 when not specified', async () => {
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'user-123', conversationId: 'chat-123', role: 'MEMBER' })
			);
			mockPrisma.message.findMany.mock.mockImplementationOnce(() => Promise.resolve([]));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'chat-123' },
				query: {}
			});

			await listMessages(req as never, res as never, () => {});

			const findManyCall = mockPrisma.message.findMany.mock.calls[0];
			assert.strictEqual(findManyCall?.arguments[0]?.take, 51); // limit + 1 to check hasMore
		});

		it('should format messages correctly with attachments', async () => {
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'user-123', conversationId: 'chat-123', role: 'MEMBER' })
			);

			const messageWithAttachment = createMockDbMessage({
				id: 'msg-with-file',
				type: 'FILE',
				content: null,
				attachments: [
					{
						id: 'att-1',
						url: '/uploads/file.pdf',
						mimeType: 'application/pdf',
						size: 12345,
						name: 'document.pdf'
					}
				]
			});
			mockPrisma.message.findMany.mock.mockImplementationOnce(() =>
				Promise.resolve([messageWithAttachment])
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'chat-123' },
				query: {}
			});

			await listMessages(req as never, res as never, () => {});

			const responseData = res._json as { data: Array<{ attachments: unknown[] }> };
			assert.strictEqual(responseData.data[0]?.attachments.length, 1);
		});

		it('should handle edited and deleted messages', async () => {
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'user-123', conversationId: 'chat-123', role: 'MEMBER' })
			);

			const editedMessage = createMockDbMessage({
				id: 'edited-msg',
				content: 'Edited content',
				editedAt: new Date('2024-01-16')
			});
			const deletedMessage = createMockDbMessage({
				id: 'deleted-msg',
				deletedAt: new Date('2024-01-17')
			});

			mockPrisma.message.findMany.mock.mockImplementationOnce(() =>
				Promise.resolve([editedMessage, deletedMessage])
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'chat-123' },
				query: {}
			});

			await listMessages(req as never, res as never, () => {});

			const responseData = res._json as {
				data: Array<{ editedAt?: string; deletedAt?: string }>;
			};
			assert.ok(responseData.data[0]?.editedAt);
			assert.ok(responseData.data[1]?.deletedAt);
		});

		it('should order messages by createdAt descending', async () => {
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'user-123', conversationId: 'chat-123', role: 'MEMBER' })
			);
			mockPrisma.message.findMany.mock.mockImplementationOnce(() => Promise.resolve([]));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'chat-123' },
				query: {}
			});

			await listMessages(req as never, res as never, () => {});

			const findManyCall = mockPrisma.message.findMany.mock.calls[0];
			assert.deepStrictEqual(findManyCall?.arguments[0]?.orderBy, { createdAt: 'desc' });
		});
	});
});
