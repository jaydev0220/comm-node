import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { createMockFunction } from '../setup.js';

const mockPrisma = {
	$transaction: createMockFunction(),
	notification: {
		create: createMockFunction(),
		findMany: createMockFunction(),
		updateMany: createMockFunction()
	}
};
const mockBroadcastNotificationNew = createMockFunction();
const mockBroadcastNotificationCleared = createMockFunction();

mock.module('../../src/lib/db.js', {
	namedExports: { prisma: mockPrisma }
});
mock.module('../../src/ws/broadcast.js', {
	namedExports: {
		broadcastNotificationNew: mockBroadcastNotificationNew,
		broadcastNotificationCleared: mockBroadcastNotificationCleared
	}
});

const { createNotification, markUnreadByReference } = await import(
	'../../src/services/notifications.service.js'
);

describe('notifications.service', () => {
	beforeEach(() => {
		mockPrisma.$transaction.mock.resetCalls();
		mockPrisma.notification.create.mock.resetCalls();
		mockPrisma.notification.findMany.mock.resetCalls();
		mockPrisma.notification.updateMany.mock.resetCalls();
		mockBroadcastNotificationNew.mock.resetCalls();
		mockBroadcastNotificationCleared.mock.resetCalls();
		mockPrisma.$transaction.mock.mockImplementation((callback: (tx: typeof mockPrisma) => unknown) =>
			callback(mockPrisma)
		);
	});

	it('creates conversation-aware message notifications and broadcasts them', async () => {
		const notification = {
			id: '13378f86-9e96-45df-9623-3e4752c85a74',
			type: 'NEW_MESSAGE',
			referenceId: '733e4b9d-bf1b-4439-a094-1d4dd04f8f68',
			actorId: '4a583cf0-86f8-48f0-9b52-c766d0812b11',
			conversationId: 'e0d4cc22-5a48-4424-bd7f-2518079716f6',
			conversationType: 'GROUP',
			read: false,
			createdAt: new Date('2024-01-01T00:00:00.000Z')
		};

		mockPrisma.notification.create.mock.mockImplementationOnce(() => Promise.resolve(notification));

		const result = await createNotification('recipient-1', 'NEW_MESSAGE', notification.referenceId, {
			actorId: notification.actorId,
			conversationId: notification.conversationId,
			conversationType: 'GROUP'
		});

		assert.deepStrictEqual(mockPrisma.notification.create.mock.calls[0]?.arguments[0], {
			data: {
				userId: 'recipient-1',
				type: 'NEW_MESSAGE',
				referenceId: notification.referenceId,
				actorId: notification.actorId,
				conversationId: notification.conversationId,
				conversationType: 'GROUP'
			}
		});
		assert.deepStrictEqual(result, {
			...notification,
			createdAt: '2024-01-01T00:00:00.000Z'
		});
		assert.deepStrictEqual(mockBroadcastNotificationNew.mock.calls[0]?.arguments, [
			'recipient-1',
			result
		]);
	});

	it('marks unread notifications by reference and broadcasts cleared ids', async () => {
		mockPrisma.notification.findMany.mock.mockImplementationOnce(() =>
			Promise.resolve([{ id: 'notification-1' }, { id: 'notification-2' }])
		);
		mockPrisma.notification.updateMany.mock.mockImplementationOnce(() => Promise.resolve({ count: 2 }));

		const result = await markUnreadByReference(
			'user-1',
			'FRIEND_REQUEST',
			'5af97f0d-62cc-4de6-8cd8-fad91a4e63f2'
		);

		assert.deepStrictEqual(mockPrisma.notification.findMany.mock.calls[0]?.arguments[0], {
			where: {
				userId: 'user-1',
				type: 'FRIEND_REQUEST',
				referenceId: '5af97f0d-62cc-4de6-8cd8-fad91a4e63f2',
				read: false
			},
			select: { id: true }
		});
		assert.deepStrictEqual(mockPrisma.notification.updateMany.mock.calls[0]?.arguments[0], {
			where: {
				userId: 'user-1',
				id: { in: ['notification-1', 'notification-2'] },
				read: false
			},
			data: { read: true }
		});
		assert.deepStrictEqual(result, ['notification-1', 'notification-2']);
		assert.deepStrictEqual(mockBroadcastNotificationCleared.mock.calls[0]?.arguments, [
			'user-1',
			['notification-1', 'notification-2']
		]);
	});
});
