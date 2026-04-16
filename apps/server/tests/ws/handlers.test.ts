import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';

const registeredHandlers = new Map<string, (...args: unknown[]) => Promise<void>>();
const mockRegisterHandler = mock.fn((event: string, handler: (...args: unknown[]) => Promise<void>) => {
	registeredHandlers.set(event, handler);
});
const mockPrisma = {
	conversationParticipant: {
		findUnique: mock.fn(),
		findMany: mock.fn()
	},
	message: {
		create: mock.fn()
	},
	conversation: {
		update: mock.fn()
	}
};
const mockSendError = mock.fn();
const mockSendAck = mock.fn();
const mockFormatMessageForWs = mock.fn();
const mockBroadcastToConversation = mock.fn();
const mockCreateNotification = mock.fn();

mock.module('../../src/ws/index.js', {
	namedExports: { registerHandler: mockRegisterHandler }
});
mock.module('../../src/lib/db.js', {
	namedExports: { prisma: mockPrisma }
});
mock.module('../../src/ws/broadcast.js', {
	namedExports: {
		sendError: mockSendError,
		sendAck: mockSendAck,
		formatMessageForWs: mockFormatMessageForWs,
		broadcastToConversation: mockBroadcastToConversation
	}
});
mock.module('../../src/services/notifications.service.js', {
	namedExports: { createNotification: mockCreateNotification }
});
await import('../../src/ws/handlers.js');

const messageSendHandler = registeredHandlers.get('message:send');

describe('WS handlers', () => {
	beforeEach(() => {
		mockPrisma.conversationParticipant.findUnique.mock.resetCalls();
		mockPrisma.conversationParticipant.findMany.mock.resetCalls();
		mockPrisma.message.create.mock.resetCalls();
		mockPrisma.conversation.update.mock.resetCalls();
		mockSendError.mock.resetCalls();
		mockSendAck.mock.resetCalls();
		mockFormatMessageForWs.mock.resetCalls();
		mockBroadcastToConversation.mock.resetCalls();
		mockCreateNotification.mock.resetCalls();
	});
	describe('message:send', () => {
		it('should create NEW_MESSAGE notifications for recipients excluding sender', async () => {
			assert.ok(messageSendHandler);

			const createdMessage = {
				id: '733e4b9d-bf1b-4439-a094-1d4dd04f8f68',
				conversationId: 'conversation-1',
				sender: {
					id: 'sender-1',
					username: 'sender',
					displayName: 'Sender',
					avatarUrl: null
				},
				content: 'hello',
				type: 'TEXT',
				attachments: [],
				ogEmbed: null,
				editedAt: null,
				deletedAt: null,
				createdAt: new Date('2024-01-01T00:00:00.000Z')
			};

			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ role: 'MEMBER' })
			);
			mockPrisma.message.create.mock.mockImplementationOnce(() => Promise.resolve(createdMessage));
			mockPrisma.conversation.update.mock.mockImplementationOnce(() => Promise.resolve(undefined));
			mockPrisma.conversationParticipant.findMany.mock.mockImplementationOnce(() =>
				Promise.resolve([
					{ userId: 'sender-1' },
					{ userId: 'recipient-1' },
					{ userId: 'recipient-2' }
				])
			);
			mockCreateNotification.mock.mockImplementation(() => Promise.resolve(undefined));
			mockFormatMessageForWs.mock.mockImplementationOnce(() => ({
				id: 'ws-message-1',
				conversationId: 'conversation-1'
			}));
			mockBroadcastToConversation.mock.mockImplementationOnce(() => Promise.resolve(undefined));
			await messageSendHandler(
				{ userId: 'sender-1' } as never,
				{
					event: 'message:send',
					requestId: 'request-1',
					payload: {
						conversationId: 'conversation-1',
						content: 'hello'
					}
				} as never
			);
			assert.strictEqual(mockCreateNotification.mock.calls.length, 2);
			assert.deepStrictEqual(
				mockCreateNotification.mock.calls.map((call) => call.arguments),
				[
					['recipient-1', 'NEW_MESSAGE', '733e4b9d-bf1b-4439-a094-1d4dd04f8f68'],
					['recipient-2', 'NEW_MESSAGE', '733e4b9d-bf1b-4439-a094-1d4dd04f8f68']
				]
			);
			assert.strictEqual(mockSendAck.mock.calls.length, 1);
			assert.strictEqual(mockSendError.mock.calls.length, 0);
		});
	});
});
