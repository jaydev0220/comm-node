/**
 * Unit tests for friends.service.ts
 * Uses Node.js built-in test runner with mocked dependencies.
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createMockDbUser } from '../setup.js';

const mockPrisma = {
	friendship: {
		findMany: mock.fn(),
		findFirst: mock.fn(),
		create: mock.fn()
	}
};
const mockGetConnectedUserIds = mock.fn();
const mockCreateNotification = mock.fn();

mock.module('../../src/lib/db.js', { namedExports: { prisma: mockPrisma } });
mock.module('../../src/ws/connection.js', {
	namedExports: { getConnectedUserIds: mockGetConnectedUserIds }
});
mock.module('../../src/services/notifications.service.js', {
	namedExports: { createNotification: mockCreateNotification }
});

const { listFriends, sendFriendRequest } = await import('../../src/services/friends.service.js');

describe('Friends Service', () => {
	beforeEach(() => {
		mockPrisma.friendship.findMany.mock.resetCalls();
		mockPrisma.friendship.findFirst.mock.resetCalls();
		mockPrisma.friendship.create.mock.resetCalls();
		mockGetConnectedUserIds.mock.resetCalls();
		mockCreateNotification.mock.resetCalls();
	});
	describe('listFriends', () => {
		it('should return friends with online presence', async () => {
			const friendships = [
				{
					id: 'friendship-1',
					status: 'ACCEPTED',
					requesterId: 'user-123',
					addresseeId: 'friend-1',
					requester: createMockDbUser({ id: 'user-123' }),
					addressee: createMockDbUser({
						id: 'friend-1',
						email: 'friend1@example.com',
						username: 'friend1',
						displayName: 'Friend One'
					}),
					createdAt: new Date('2024-01-01T00:00:00.000Z'),
					updatedAt: new Date('2024-01-01T00:00:00.000Z')
				},
				{
					id: 'friendship-2',
					status: 'ACCEPTED',
					requesterId: 'friend-2',
					addresseeId: 'user-123',
					requester: createMockDbUser({
						id: 'friend-2',
						email: 'friend2@example.com',
						username: 'friend2',
						displayName: 'Friend Two'
					}),
					addressee: createMockDbUser({ id: 'user-123' }),
					createdAt: new Date('2024-01-02T00:00:00.000Z'),
					updatedAt: new Date('2024-01-02T00:00:00.000Z')
				}
			];

			mockPrisma.friendship.findMany.mock.mockImplementationOnce(() =>
				Promise.resolve(friendships)
			);
			mockGetConnectedUserIds.mock.mockImplementationOnce(() => ['friend-1']);

			const friends = await listFriends('user-123');

			assert.deepStrictEqual(mockPrisma.friendship.findMany.mock.calls[0]?.arguments[0], {
				where: {
					status: 'ACCEPTED',
					OR: [{ requesterId: 'user-123' }, { addresseeId: 'user-123' }]
				},
				include: {
					requester: true,
					addressee: true
				}
			});
			assert.strictEqual(mockGetConnectedUserIds.mock.calls.length, 1);
			assert.deepStrictEqual(friends, [
				{
					id: 'friend-1',
					email: 'friend1@example.com',
					username: 'friend1',
					displayName: 'Friend One',
					avatarUrl: undefined,
					createdAt: '2024-01-01T00:00:00.000Z',
					updatedAt: '2024-01-01T00:00:00.000Z',
					isOnline: true
				},
				{
					id: 'friend-2',
					email: 'friend2@example.com',
					username: 'friend2',
					displayName: 'Friend Two',
					avatarUrl: undefined,
					createdAt: '2024-01-01T00:00:00.000Z',
					updatedAt: '2024-01-01T00:00:00.000Z',
					isOnline: false
				}
			]);
		});
	});
	describe('sendFriendRequest', () => {
		it('should create friend request and notification for addressee', async () => {
			const createdFriendship = {
				id: '5af97f0d-62cc-4de6-8cd8-fad91a4e63f2',
				status: 'PENDING',
				requesterId: 'requester-1',
				addresseeId: 'addressee-1',
				requester: createMockDbUser({ id: 'requester-1' }),
				addressee: createMockDbUser({ id: 'addressee-1' }),
				createdAt: new Date('2024-01-01T00:00:00.000Z'),
				updatedAt: new Date('2024-01-01T00:00:00.000Z')
			};

			mockPrisma.friendship.findFirst.mock.mockImplementationOnce(() => Promise.resolve(null));
			mockPrisma.friendship.create.mock.mockImplementationOnce(() =>
				Promise.resolve(createdFriendship)
			);
			mockCreateNotification.mock.mockImplementationOnce(() =>
				Promise.resolve({
					id: 'notification-1',
					type: 'FRIEND_REQUEST',
					referenceId: createdFriendship.id,
					read: false,
					createdAt: '2024-01-01T00:00:00.000Z'
				})
			);

			const result = await sendFriendRequest('requester-1', 'addressee-1');

			assert.deepStrictEqual(mockPrisma.friendship.findFirst.mock.calls[0]?.arguments[0], {
				where: {
					OR: [
						{ requesterId: 'requester-1', addresseeId: 'addressee-1' },
						{ requesterId: 'addressee-1', addresseeId: 'requester-1' }
					]
				}
			});
			assert.deepStrictEqual(mockPrisma.friendship.create.mock.calls[0]?.arguments[0], {
				data: {
					requesterId: 'requester-1',
					addresseeId: 'addressee-1',
					status: 'PENDING'
				},
				include: { requester: true, addressee: true }
			});
			assert.deepStrictEqual(mockCreateNotification.mock.calls[0]?.arguments, [
				'addressee-1',
				'FRIEND_REQUEST',
				'5af97f0d-62cc-4de6-8cd8-fad91a4e63f2'
			]);
			assert.strictEqual(result.id, '5af97f0d-62cc-4de6-8cd8-fad91a4e63f2');
		});
	});
});
