/**
 * Unit tests for friends.controller.ts
 * Uses Node.js built-in test runner with mocked services.
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createMockRequest, createMockResponse, createMockUser, type MockResponse } from '../setup.js';

// Mock the service module
const mockFriendsService = {
	listFriends: mock.fn(),
	listPendingRequests: mock.fn(),
	sendFriendRequest: mock.fn(),
	respondToRequest: mock.fn(),
	removeFriend: mock.fn(),
	blockUser: mock.fn(),
	unblockUser: mock.fn()
};

mock.module('../src/services/friends.service.js', { namedExports: mockFriendsService });

// Import controller after mocking
const {
	listFriends,
	listRequests,
	sendRequest,
	respondToRequest,
	removeFriend,
	blockUser,
	unblockUser
} = await import('../src/controllers/friends.controller.js');

// Helper to create mock friend data
const createMockFriend = (overrides = {}) => ({
	id: 'friend-123',
	email: 'friend@example.com',
	username: 'frienduser',
	displayName: 'Friend User',
	avatarUrl: null,
	createdAt: '2024-01-01T00:00:00.000Z',
	updatedAt: '2024-01-01T00:00:00.000Z',
	...overrides
});

const createMockFriendRequest = (overrides = {}) => ({
	id: 'request-123',
	requesterId: 'requester-id',
	addresseeId: 'addressee-id',
	status: 'PENDING',
	createdAt: '2024-01-01T00:00:00.000Z',
	...overrides
});

const createMockBlock = (overrides = {}) => ({
	id: 'block-123',
	blockerId: 'blocker-id',
	blockedId: 'blocked-id',
	createdAt: '2024-01-01T00:00:00.000Z',
	...overrides
});

describe('Friends Controller', () => {
	let res: MockResponse;

	beforeEach(() => {
		res = createMockResponse();
		mockFriendsService.listFriends.mock.resetCalls();
		mockFriendsService.listPendingRequests.mock.resetCalls();
		mockFriendsService.sendFriendRequest.mock.resetCalls();
		mockFriendsService.respondToRequest.mock.resetCalls();
		mockFriendsService.removeFriend.mock.resetCalls();
		mockFriendsService.blockUser.mock.resetCalls();
		mockFriendsService.unblockUser.mock.resetCalls();
	});

	describe('listFriends', () => {
		it('should return list of friends wrapped in data object', async () => {
			const friends = [createMockFriend({ id: 'friend-1' }), createMockFriend({ id: 'friend-2' })];
			mockFriendsService.listFriends.mock.mockImplementationOnce(() => Promise.resolve(friends));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' })
			});

			await listFriends(req as never, res as never, () => {});

			assert.deepStrictEqual(res._json, { data: friends });
		});

		it('should pass user ID to service', async () => {
			mockFriendsService.listFriends.mock.mockImplementationOnce(() => Promise.resolve([]));

			const req = createMockRequest({
				user: createMockUser({ sub: 'specific-user-id' })
			});

			await listFriends(req as never, res as never, () => {});

			assert.strictEqual(
				mockFriendsService.listFriends.mock.calls[0]?.arguments[0],
				'specific-user-id'
			);
		});

		it('should handle empty friends list', async () => {
			mockFriendsService.listFriends.mock.mockImplementationOnce(() => Promise.resolve([]));

			const req = createMockRequest({
				user: createMockUser()
			});

			await listFriends(req as never, res as never, () => {});

			assert.deepStrictEqual(res._json, { data: [] });
		});
	});

	describe('listRequests', () => {
		it('should return pending friend requests', async () => {
			const requests = [
				createMockFriendRequest({ id: 'req-1' }),
				createMockFriendRequest({ id: 'req-2' })
			];
			mockFriendsService.listPendingRequests.mock.mockImplementationOnce(() =>
				Promise.resolve(requests)
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' })
			});

			await listRequests(req as never, res as never, () => {});

			assert.deepStrictEqual(res._json, { data: requests });
		});

		it('should pass user ID to service', async () => {
			mockFriendsService.listPendingRequests.mock.mockImplementationOnce(() => Promise.resolve([]));

			const req = createMockRequest({
				user: createMockUser({ sub: 'request-checker' })
			});

			await listRequests(req as never, res as never, () => {});

			assert.strictEqual(
				mockFriendsService.listPendingRequests.mock.calls[0]?.arguments[0],
				'request-checker'
			);
		});
	});

	describe('sendRequest', () => {
		it('should send friend request and return 201', async () => {
			const friendship = createMockFriendRequest({
				requesterId: 'user-123',
				addresseeId: 'target-user'
			});
			mockFriendsService.sendFriendRequest.mock.mockImplementationOnce(() =>
				Promise.resolve(friendship)
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				body: { addresseeId: 'target-user' }
			});

			await sendRequest(req as never, res as never, () => {});

			assert.strictEqual(res._status, 201);
			assert.deepStrictEqual(res._json, friendship);
		});

		it('should pass user ID and addressee ID to service', async () => {
			mockFriendsService.sendFriendRequest.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockFriendRequest())
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'requester-user' }),
				body: { addresseeId: 'target-friend' }
			});

			await sendRequest(req as never, res as never, () => {});

			assert.strictEqual(
				mockFriendsService.sendFriendRequest.mock.calls[0]?.arguments[0],
				'requester-user'
			);
			assert.strictEqual(
				mockFriendsService.sendFriendRequest.mock.calls[0]?.arguments[1],
				'target-friend'
			);
		});
	});

	describe('respondToRequest', () => {
		it('should accept friend request and return friendship', async () => {
			const friendship = createMockFriendRequest({ status: 'ACCEPTED' });
			mockFriendsService.respondToRequest.mock.mockImplementationOnce(() =>
				Promise.resolve(friendship)
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'request-id' },
				body: { action: 'accept' }
			});

			await respondToRequest(req as never, res as never, () => {});

			assert.deepStrictEqual(res._json, friendship);
		});

		it('should reject friend request and return message', async () => {
			mockFriendsService.respondToRequest.mock.mockImplementationOnce(() => Promise.resolve(null));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'request-id' },
				body: { action: 'reject' }
			});

			await respondToRequest(req as never, res as never, () => {});

			assert.strictEqual(res._status, 200);
			assert.deepStrictEqual(res._json, { message: 'Request rejected' });
		});

		it('should pass user ID, request ID, and action to service', async () => {
			mockFriendsService.respondToRequest.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockFriendRequest())
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'responder-user' }),
				params: { id: 'pending-request-123' },
				body: { action: 'accept' }
			});

			await respondToRequest(req as never, res as never, () => {});

			assert.strictEqual(
				mockFriendsService.respondToRequest.mock.calls[0]?.arguments[0],
				'responder-user'
			);
			assert.strictEqual(
				mockFriendsService.respondToRequest.mock.calls[0]?.arguments[1],
				'pending-request-123'
			);
			assert.strictEqual(
				mockFriendsService.respondToRequest.mock.calls[0]?.arguments[2],
				'accept'
			);
		});
	});

	describe('removeFriend', () => {
		it('should remove friend and return 204', async () => {
			mockFriendsService.removeFriend.mock.mockImplementationOnce(() => Promise.resolve());

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { userId: 'friend-to-remove' }
			});

			await removeFriend(req as never, res as never, () => {});

			assert.strictEqual(res._status, 204);
		});

		it('should pass user ID and friend ID to service', async () => {
			mockFriendsService.removeFriend.mock.mockImplementationOnce(() => Promise.resolve());

			const req = createMockRequest({
				user: createMockUser({ sub: 'remover-user' }),
				params: { userId: 'removed-friend' }
			});

			await removeFriend(req as never, res as never, () => {});

			assert.strictEqual(
				mockFriendsService.removeFriend.mock.calls[0]?.arguments[0],
				'remover-user'
			);
			assert.strictEqual(
				mockFriendsService.removeFriend.mock.calls[0]?.arguments[1],
				'removed-friend'
			);
		});
	});

	describe('blockUser', () => {
		it('should block user and return 201', async () => {
			const block = createMockBlock({ blockerId: 'user-123', blockedId: 'blocked-user' });
			mockFriendsService.blockUser.mock.mockImplementationOnce(() => Promise.resolve(block));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				body: { targetId: 'blocked-user' }
			});

			await blockUser(req as never, res as never, () => {});

			assert.strictEqual(res._status, 201);
			assert.deepStrictEqual(res._json, block);
		});

		it('should pass user ID and target ID to service', async () => {
			mockFriendsService.blockUser.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockBlock())
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'blocker-user' }),
				body: { targetId: 'user-to-block' }
			});

			await blockUser(req as never, res as never, () => {});

			assert.strictEqual(mockFriendsService.blockUser.mock.calls[0]?.arguments[0], 'blocker-user');
			assert.strictEqual(
				mockFriendsService.blockUser.mock.calls[0]?.arguments[1],
				'user-to-block'
			);
		});
	});

	describe('unblockUser', () => {
		it('should unblock user and return 204', async () => {
			mockFriendsService.unblockUser.mock.mockImplementationOnce(() => Promise.resolve());

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { userId: 'user-to-unblock' }
			});

			await unblockUser(req as never, res as never, () => {});

			assert.strictEqual(res._status, 204);
		});

		it('should pass user ID and blocked user ID to service', async () => {
			mockFriendsService.unblockUser.mock.mockImplementationOnce(() => Promise.resolve());

			const req = createMockRequest({
				user: createMockUser({ sub: 'unblocker-user' }),
				params: { userId: 'previously-blocked' }
			});

			await unblockUser(req as never, res as never, () => {});

			assert.strictEqual(
				mockFriendsService.unblockUser.mock.calls[0]?.arguments[0],
				'unblocker-user'
			);
			assert.strictEqual(
				mockFriendsService.unblockUser.mock.calls[0]?.arguments[1],
				'previously-blocked'
			);
		});
	});
});
