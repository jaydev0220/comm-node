import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';

const registeredHandlers = new Map<string, (...args: unknown[]) => Promise<void>>();
const mockRegisterHandler = mock.fn(
	(event: string, handler: (...args: unknown[]) => Promise<void>) => {
		registeredHandlers.set(event, handler);
	}
);
const mockPrisma = {
	conversationParticipant: {
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
const mockMessagesService = {
	getConversationParticipantRole: mock.fn(),
	editMessage: mock.fn(),
	deleteMessage: mock.fn()
};

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
mock.module('../../src/services/messages.service.js', {
	namedExports: mockMessagesService
});
await import('../../src/ws/handlers.js');

const messageSendHandler = registeredHandlers.get('message:send');
const messageEditHandler = registeredHandlers.get('message:edit');
const messageDeleteHandler = registeredHandlers.get('message:delete');
const createAppError = (code: 'FORBIDDEN' | 'NOT_FOUND', message: string) =>
	Object.assign(new Error(message), {
		code,
		status: code === 'FORBIDDEN' ? 403 : 404
	});

describe('WS handlers', () => {
	beforeEach(() => {
		mockMessagesService.getConversationParticipantRole.mock.resetCalls();
		mockMessagesService.editMessage.mock.resetCalls();
		mockMessagesService.deleteMessage.mock.resetCalls();
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

			mockMessagesService.getConversationParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('MEMBER')
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
	describe('message:edit', () => {
		it('should broadcast message:edited and ack on successful edit', async () => {
			assert.ok(messageEditHandler);

			const editedAt = new Date('2024-02-01T00:00:00.000Z');

			mockMessagesService.editMessage.mock.mockImplementationOnce(() =>
				Promise.resolve({
					conversationId: 'conversation-1',
					messageId: 'message-1',
					content: 'edited content',
					editedAt
				})
			);
			mockBroadcastToConversation.mock.mockImplementationOnce(() => Promise.resolve(undefined));
			await messageEditHandler(
				{ userId: 'sender-1' } as never,
				{
					event: 'message:edit',
					requestId: 'request-edit-1',
					payload: { messageId: 'message-1', content: 'edited content' }
				} as never
			);
			assert.deepStrictEqual(mockMessagesService.editMessage.mock.calls[0]?.arguments, [
				'sender-1',
				'message-1',
				'edited content'
			]);
			assert.deepStrictEqual(mockBroadcastToConversation.mock.calls[0]?.arguments, [
				'conversation-1',
				{
					event: 'message:edited',
					payload: {
						messageId: 'message-1',
						content: 'edited content',
						editedAt: editedAt.toISOString()
					}
				}
			]);
			assert.deepStrictEqual(mockSendAck.mock.calls[0]?.arguments, [
				{ userId: 'sender-1' },
				'request-edit-1'
			]);
			assert.strictEqual(mockSendError.mock.calls.length, 0);
		});
		it('should send FORBIDDEN error without ack when edit is denied', async () => {
			assert.ok(messageEditHandler);
			mockMessagesService.editMessage.mock.mockImplementationOnce(() =>
				Promise.reject(createAppError('FORBIDDEN', 'Only the sender can edit this message'))
			);
			await messageEditHandler(
				{ userId: 'other-user' } as never,
				{
					event: 'message:edit',
					requestId: 'request-edit-2',
					payload: { messageId: 'message-1', content: 'edited content' }
				} as never
			);
			assert.deepStrictEqual(mockSendError.mock.calls[0]?.arguments, [
				{ userId: 'other-user' },
				'FORBIDDEN',
				'Only the sender can edit this message',
				'request-edit-2'
			]);
			assert.strictEqual(mockSendAck.mock.calls.length, 0);
			assert.strictEqual(mockBroadcastToConversation.mock.calls.length, 0);
		});
	});
	describe('message:delete', () => {
		it('should broadcast message:deleted and ack on successful delete', async () => {
			assert.ok(messageDeleteHandler);
			mockMessagesService.deleteMessage.mock.mockImplementationOnce(() =>
				Promise.resolve({
					conversationId: 'conversation-1',
					messageId: 'message-1'
				})
			);
			mockBroadcastToConversation.mock.mockImplementationOnce(() => Promise.resolve(undefined));
			await messageDeleteHandler(
				{ userId: 'owner-1' } as never,
				{
					event: 'message:delete',
					requestId: 'request-delete-1',
					payload: { messageId: 'message-1' }
				} as never
			);
			assert.deepStrictEqual(mockMessagesService.deleteMessage.mock.calls[0]?.arguments, [
				'owner-1',
				'message-1'
			]);
			assert.deepStrictEqual(mockBroadcastToConversation.mock.calls[0]?.arguments, [
				'conversation-1',
				{
					event: 'message:deleted',
					payload: { messageId: 'message-1' }
				}
			]);
			assert.deepStrictEqual(mockSendAck.mock.calls[0]?.arguments, [
				{ userId: 'owner-1' },
				'request-delete-1'
			]);
			assert.strictEqual(mockSendError.mock.calls.length, 0);
		});
		it('should send NOT_FOUND error without ack when message is missing', async () => {
			assert.ok(messageDeleteHandler);
			mockMessagesService.deleteMessage.mock.mockImplementationOnce(() =>
				Promise.reject(createAppError('NOT_FOUND', 'Message not found'))
			);
			await messageDeleteHandler(
				{ userId: 'owner-1' } as never,
				{
					event: 'message:delete',
					requestId: 'request-delete-2',
					payload: { messageId: 'missing-message' }
				} as never
			);
			assert.deepStrictEqual(mockSendError.mock.calls[0]?.arguments, [
				{ userId: 'owner-1' },
				'NOT_FOUND',
				'Message not found',
				'request-delete-2'
			]);
			assert.strictEqual(mockSendAck.mock.calls.length, 0);
			assert.strictEqual(mockBroadcastToConversation.mock.calls.length, 0);
		});
	});
});
