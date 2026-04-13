/**
 * Unit tests for users.controller.ts
 * Uses Node.js built-in test runner with mocked services.
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
	createMockRequest,
	createMockResponse,
	createMockUser,
	createMockApiUser,
	type MockResponse
} from '../setup.js';

// Mock the service module
const mockUsersService = {
	findById: mock.fn(),
	updateUser: mock.fn(),
	updateUserAvatar: mock.fn(),
	deleteUser: mock.fn(),
	searchUsers: mock.fn()
};

mock.module('../../src/services/users.service.js', { namedExports: mockUsersService });

// Import controller after mocking
const { getMe, updateMe, uploadMeAvatar, deleteMe, searchUsers } =
	await import('../../src/controllers/users.controller.js');

describe('Users Controller', () => {
	let res: MockResponse;

	beforeEach(() => {
		res = createMockResponse();
		mockUsersService.findById.mock.resetCalls();
		mockUsersService.updateUser.mock.resetCalls();
		mockUsersService.updateUserAvatar.mock.resetCalls();
		mockUsersService.deleteUser.mock.resetCalls();
		mockUsersService.searchUsers.mock.resetCalls();
	});
	describe('getMe', () => {
		it('should return current user', async () => {
			const mockUser = createMockApiUser();

			mockUsersService.findById.mock.mockImplementationOnce(() => Promise.resolve(mockUser));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' })
			});

			await getMe(req as never, res as never, () => {});
			assert.deepStrictEqual(res._json, mockUser);
			assert.strictEqual(mockUsersService.findById.mock.calls[0]?.arguments[0], 'user-123');
		});
		it('should throw not found when user does not exist', async () => {
			mockUsersService.findById.mock.mockImplementationOnce(() => Promise.resolve(null));

			const req = createMockRequest({
				user: createMockUser({ sub: 'nonexistent-user' })
			});

			await assert.rejects(
				async () => {
					await getMe(req as never, res as never, () => {});
				},
				{ message: 'User not found' }
			);
		});
		it('should use user ID from authenticated request', async () => {
			mockUsersService.findById.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockApiUser())
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'specific-user-id-456' })
			});

			await getMe(req as never, res as never, () => {});
			assert.strictEqual(
				mockUsersService.findById.mock.calls[0]?.arguments[0],
				'specific-user-id-456'
			);
		});
	});
	describe('updateMe', () => {
		it('should update current user', async () => {
			const updatedUser = createMockApiUser({ displayName: 'Updated Name' });

			mockUsersService.updateUser.mock.mockImplementationOnce(() => Promise.resolve(updatedUser));

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				body: { displayName: 'Updated Name' }
			});

			await updateMe(req as never, res as never, () => {});
			assert.deepStrictEqual(res._json, updatedUser);
		});
		it('should pass user ID and update data to service', async () => {
			mockUsersService.updateUser.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockApiUser())
			);

			const updateData = { displayName: 'New Name', username: 'new_name' };
			const req = createMockRequest({
				user: createMockUser({ sub: 'user-789' }),
				body: updateData
			});

			await updateMe(req as never, res as never, () => {});
			assert.strictEqual(mockUsersService.updateUser.mock.calls[0]?.arguments[0], 'user-789');
			assert.deepStrictEqual(mockUsersService.updateUser.mock.calls[0]?.arguments[1], updateData);
		});
		it('should handle partial updates', async () => {
			mockUsersService.updateUser.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockApiUser({ displayName: 'Only Name' }))
			);

			const req = createMockRequest({
				user: createMockUser(),
				body: { displayName: 'Only Name' }
			});

			await updateMe(req as never, res as never, () => {});
			assert.strictEqual(mockUsersService.updateUser.mock.calls.length, 1);
		});
	});
	describe('uploadMeAvatar', () => {
		it('should update avatar and return updated user', async () => {
			const updatedUser = createMockApiUser({ avatarUrl: '/uploads/avatar-123.png' });

			mockUsersService.updateUserAvatar.mock.mockImplementationOnce(() =>
				Promise.resolve(updatedUser)
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				file: {
					filename: 'avatar-123.png'
				} as Express.Multer.File
			});

			await uploadMeAvatar(req as never, res as never, () => {});
			assert.deepStrictEqual(res._json, updatedUser);
			assert.strictEqual(mockUsersService.updateUserAvatar.mock.calls[0]?.arguments[0], 'user-123');
			assert.strictEqual(
				mockUsersService.updateUserAvatar.mock.calls[0]?.arguments[1],
				'/uploads/avatar-123.png'
			);
		});
		it('should throw bad request when no file is provided', async () => {
			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' })
			});

			await assert.rejects(
				async () => {
					await uploadMeAvatar(req as never, res as never, () => {});
				},
				{ message: 'No avatar file provided' }
			);
		});
	});
	describe('deleteMe', () => {
		it('should delete current user and return 204', async () => {
			mockUsersService.deleteUser.mock.mockImplementationOnce(() => Promise.resolve());

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-to-delete' })
			});

			await deleteMe(req as never, res as never, () => {});
			assert.strictEqual(res._status, 204);
			assert.strictEqual(mockUsersService.deleteUser.mock.calls[0]?.arguments[0], 'user-to-delete');
		});
		it('should call delete service with correct user ID', async () => {
			mockUsersService.deleteUser.mock.mockImplementationOnce(() => Promise.resolve());

			const req = createMockRequest({
				user: createMockUser({ sub: 'delete-me-123' })
			});

			await deleteMe(req as never, res as never, () => {});
			assert.strictEqual(mockUsersService.deleteUser.mock.calls.length, 1);
			assert.strictEqual(mockUsersService.deleteUser.mock.calls[0]?.arguments[0], 'delete-me-123');
		});
	});
	describe('searchUsers', () => {
		it('should return search results with pagination', async () => {
			const searchResult = {
				data: [createMockApiUser({ id: 'user-1' }), createMockApiUser({ id: 'user-2' })],
				pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
			};

			mockUsersService.searchUsers.mock.mockImplementationOnce(() => Promise.resolve(searchResult));

			const req = createMockRequest({
				query: { q: 'test', page: '1', limit: '10' }
			});

			await searchUsers(req as never, res as never, () => {});
			assert.deepStrictEqual(res._json, searchResult);
		});
		it('should pass query params to service', async () => {
			mockUsersService.searchUsers.mock.mockImplementationOnce(() =>
				Promise.resolve({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
			);

			const queryParams = { q: 'john', page: '2', limit: '20' };
			const req = createMockRequest({ query: queryParams });

			await searchUsers(req as never, res as never, () => {});
			assert.deepStrictEqual(mockUsersService.searchUsers.mock.calls[0]?.arguments[0], queryParams);
		});
		it('should handle empty search results', async () => {
			const emptyResult = {
				data: [],
				pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
			};

			mockUsersService.searchUsers.mock.mockImplementationOnce(() => Promise.resolve(emptyResult));

			const req = createMockRequest({
				query: { q: 'nonexistent' }
			});

			await searchUsers(req as never, res as never, () => {});
			assert.deepStrictEqual(res._json, emptyResult);
		});
	});
});
