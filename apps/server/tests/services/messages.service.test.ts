import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { createMockFunction } from '../setup.js';

const mockPrisma = {
	conversationParticipant: {
		findUnique: createMockFunction()
	},
	message: {
		findUnique: createMockFunction(),
		update: createMockFunction()
	}
};

mock.module('../../src/lib/db.js', {
	namedExports: { prisma: mockPrisma }
});

const { getConversationParticipantRole, loadMessageForMutation, editMessage, deleteMessage } =
	await import('../../src/services/messages.service.js');
const createMockMessage = (overrides: Record<string, unknown> = {}) => ({
	id: 'message-1',
	conversationId: 'conversation-1',
	senderId: 'sender-1',
	deletedAt: null,
	conversation: { type: 'GROUP' },
	...overrides
});

describe('messages.service', () => {
	beforeEach(() => {
		mockPrisma.conversationParticipant.findUnique.mock.resetCalls();
		mockPrisma.message.findUnique.mock.resetCalls();
		mockPrisma.message.update.mock.resetCalls();
	});
	it('returns participant role when user is in the conversation', async () => {
		mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve({ role: 'MEMBER' })
		);

		const role = await getConversationParticipantRole('user-1', 'conversation-1');

		assert.strictEqual(role, 'MEMBER');
	});
	it('loads message for mutation and rejects deleted messages', async () => {
		mockPrisma.message.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(createMockMessage({ deletedAt: new Date('2024-01-01T00:00:00.000Z') }))
		);
		await assert.rejects(
			() => loadMessageForMutation('message-1', 'edit'),
			(error: { code?: string; message?: string }) => {
				assert.strictEqual(error.code, 'FORBIDDEN');
				assert.strictEqual(error.message, 'Cannot edit a deleted message');
				return true;
			}
		);
	});
	it('edits message only when requester is sender', async () => {
		mockPrisma.message.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(createMockMessage())
		);
		mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve({ role: 'MEMBER' })
		);
		mockPrisma.message.update.mock.mockImplementationOnce(() => Promise.resolve(undefined));

		const result = await editMessage('sender-1', 'message-1', 'edited');

		assert.strictEqual(result.messageId, 'message-1');
		assert.strictEqual(result.content, 'edited');
		assert.strictEqual(mockPrisma.message.update.mock.calls.length, 1);
	});
	it('blocks edit when requester is not sender', async () => {
		mockPrisma.message.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(createMockMessage())
		);
		await assert.rejects(
			() => editMessage('other-user', 'message-1', 'edited'),
			(error: { code?: string; message?: string }) => {
				assert.strictEqual(error.code, 'FORBIDDEN');
				assert.strictEqual(error.message, 'Only the sender can edit this message');
				return true;
			}
		);
	});
	it('blocks edit when sender is no longer a participant', async () => {
		mockPrisma.message.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(createMockMessage({ senderId: 'sender-1' }))
		);
		mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(null)
		);
		await assert.rejects(
			() => editMessage('sender-1', 'message-1', 'edited'),
			(error: { code?: string; message?: string }) => {
				assert.strictEqual(error.code, 'FORBIDDEN');
				assert.strictEqual(error.message, 'You are not a participant of this conversation');
				return true;
			}
		);
		assert.strictEqual(mockPrisma.message.update.mock.calls.length, 0);
	});
	it('allows sender to delete own message', async () => {
		mockPrisma.message.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(createMockMessage())
		);
		mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve({ role: 'MEMBER' })
		);
		mockPrisma.message.update.mock.mockImplementationOnce(() => Promise.resolve(undefined));

		const result = await deleteMessage('sender-1', 'message-1');

		assert.deepStrictEqual(result, {
			conversationId: 'conversation-1',
			messageId: 'message-1'
		});
		assert.strictEqual(mockPrisma.message.update.mock.calls.length, 1);
	});
	it('allows group owner to delete others messages', async () => {
		mockPrisma.message.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(createMockMessage({ senderId: 'sender-2' }))
		);
		mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve({ role: 'OWNER' })
		);
		mockPrisma.message.update.mock.mockImplementationOnce(() => Promise.resolve(undefined));
		await deleteMessage('owner-1', 'message-1');
		assert.strictEqual(mockPrisma.message.update.mock.calls.length, 1);
	});
	it('blocks group member deleting others messages', async () => {
		mockPrisma.message.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(createMockMessage({ senderId: 'sender-2' }))
		);
		mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve({ role: 'MEMBER' })
		);
		await assert.rejects(
			() => deleteMessage('member-1', 'message-1'),
			(error: { code?: string; message?: string }) => {
				assert.strictEqual(error.code, 'FORBIDDEN');
				assert.strictEqual(error.message, 'You do not have permission to delete this message');
				return true;
			}
		);
		assert.strictEqual(mockPrisma.message.update.mock.calls.length, 0);
	});
	it('blocks admin deleting others messages', async () => {
		mockPrisma.message.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(createMockMessage({ senderId: 'sender-2' }))
		);
		mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve({ role: 'ADMIN' })
		);
		await assert.rejects(
			() => deleteMessage('admin-1', 'message-1'),
			(error: { code?: string; message?: string }) => {
				assert.strictEqual(error.code, 'FORBIDDEN');
				assert.strictEqual(error.message, 'You do not have permission to delete this message');
				return true;
			}
		);
		assert.strictEqual(mockPrisma.message.update.mock.calls.length, 0);
	});
	it('blocks owner delete-any in direct conversations', async () => {
		mockPrisma.message.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(createMockMessage({ senderId: 'sender-2', conversation: { type: 'DIRECT' } }))
		);
		mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve({ role: 'OWNER' })
		);
		await assert.rejects(
			() => deleteMessage('owner-1', 'message-1'),
			(error: { code?: string; message?: string }) => {
				assert.strictEqual(error.code, 'FORBIDDEN');
				assert.strictEqual(error.message, 'You do not have permission to delete this message');
				return true;
			}
		);
	});
	it('rejects edit when message does not belong to target conversation', async () => {
		mockPrisma.message.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(createMockMessage({ conversationId: 'conversation-2' }))
		);
		await assert.rejects(
			() => editMessage('sender-1', 'message-1', 'edited', 'conversation-1'),
			(error: { code?: string; message?: string }) => {
				assert.strictEqual(error.code, 'NOT_FOUND');
				assert.strictEqual(error.message, 'Message not found');
				return true;
			}
		);
		assert.strictEqual(mockPrisma.message.update.mock.calls.length, 0);
	});
	it('rejects delete when message does not belong to target conversation', async () => {
		mockPrisma.message.findUnique.mock.mockImplementationOnce(() =>
			Promise.resolve(createMockMessage({ conversationId: 'conversation-2' }))
		);
		await assert.rejects(
			() => deleteMessage('sender-1', 'message-1', 'conversation-1'),
			(error: { code?: string; message?: string }) => {
				assert.strictEqual(error.code, 'NOT_FOUND');
				assert.strictEqual(error.message, 'Message not found');
				return true;
			}
		);
		assert.strictEqual(mockPrisma.message.update.mock.calls.length, 0);
	});
});
