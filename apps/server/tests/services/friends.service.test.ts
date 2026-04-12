/**
 * Unit tests for friends.service.ts
 * Uses Node.js built-in test runner with mocked dependencies.
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createMockDbUser } from '../setup.js';

const mockPrisma = {
	friendship: {
		findMany: mock.fn()
	}
};
const mockGetConnectedUserIds = mock.fn();

mock.module('../../src/lib/db.js', { namedExports: { prisma: mockPrisma } });
mock.module('../../src/ws/connection.js', {
	namedExports: { getConnectedUserIds: mockGetConnectedUserIds }
});

const { listFriends } = await import('../../src/services/friends.service.js');

describe('Friends Service', () => {
	beforeEach(() => {
		mockPrisma.friendship.findMany.mock.resetCalls();
		mockGetConnectedUserIds.mock.resetCalls();
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
});
