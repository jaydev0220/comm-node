/**
 * Unit tests for participants.controller.ts
 * Uses Node.js built-in test runner with mocked database and services.
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createMockRequest, createMockResponse, createMockUser, type MockResponse } from '../setup.js';

// Mock prisma
const mockPrisma = {
	conversationParticipant: {
		findMany: mock.fn(),
		findUnique: mock.fn(),
		create: mock.fn(),
		update: mock.fn(),
		delete: mock.fn()
	},
	user: {
		findUnique: mock.fn()
	}
};

const mockChatsService = {
	getParticipantRole: mock.fn()
};

mock.module('../src/lib/db.js', { namedExports: { prisma: mockPrisma } });
mock.module('../src/services/chats.service.js', { namedExports: mockChatsService });

// Import controller after mocking
const { listParticipants, addParticipant, updateRole, removeParticipant } = await import(
	'../src/controllers/participants.controller.js'
);

// Helper to create mock participant data
const createMockDbParticipant = (overrides = {}) => ({
	user: {
		id: 'participant-123',
		email: 'participant@example.com',
		username: 'participant',
		displayName: 'Participant User',
		avatarUrl: null,
		createdAt: new Date('2024-01-01'),
		updatedAt: new Date('2024-01-01')
	},
	role: 'MEMBER' as const,
	joinedAt: new Date('2024-01-05'),
	...overrides
});

describe('Participants Controller', () => {
	let res: MockResponse;

	beforeEach(() => {
		res = createMockResponse();
		mockPrisma.conversationParticipant.findMany.mock.resetCalls();
		mockPrisma.conversationParticipant.findUnique.mock.resetCalls();
		mockPrisma.conversationParticipant.create.mock.resetCalls();
		mockPrisma.conversationParticipant.update.mock.resetCalls();
		mockPrisma.conversationParticipant.delete.mock.resetCalls();
		mockPrisma.user.findUnique.mock.resetCalls();
		mockChatsService.getParticipantRole.mock.resetCalls();
	});

	describe('listParticipants', () => {
		it('should return list of participants', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('MEMBER')
			);
			mockPrisma.conversationParticipant.findMany.mock.mockImplementationOnce(() =>
				Promise.resolve([
					createMockDbParticipant({ user: { ...createMockDbParticipant().user, id: 'user-1' } }),
					createMockDbParticipant({ user: { ...createMockDbParticipant().user, id: 'user-2' } })
				])
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'chat-123' }
			});

			await listParticipants(req as never, res as never, () => {});

			assert.ok(Array.isArray(res._json));
			assert.strictEqual((res._json as unknown[]).length, 2);
		});

		it('should throw not found when user is not a member', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() => Promise.resolve(null));

			const req = createMockRequest({
				user: createMockUser({ sub: 'non-member' }),
				params: { id: 'chat-123' }
			});

			await assert.rejects(
				async () => {
					await listParticipants(req as never, res as never, () => {});
				},
				{ message: 'Chat not found or not a member' }
			);
		});

		it('should order participants by joinedAt ascending', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('MEMBER')
			);
			mockPrisma.conversationParticipant.findMany.mock.mockImplementationOnce(() =>
				Promise.resolve([])
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'user-123' }),
				params: { id: 'chat-123' }
			});

			await listParticipants(req as never, res as never, () => {});

			const findManyCall = mockPrisma.conversationParticipant.findMany.mock.calls[0];
			assert.deepStrictEqual(findManyCall?.arguments[0]?.orderBy, { joinedAt: 'asc' });
		});
	});

	describe('addParticipant', () => {
		it('should add participant and return 201', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('ADMIN')
			);
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve(null)
			);
			mockPrisma.user.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ id: 'new-user' })
			);
			mockPrisma.conversationParticipant.create.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockDbParticipant())
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'admin-user' }),
				params: { id: 'chat-123' },
				body: { userId: 'new-user' }
			});

			await addParticipant(req as never, res as never, () => {});

			assert.strictEqual(res._status, 201);
		});

		it('should throw forbidden when member tries to add participant', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('MEMBER')
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'member-user' }),
				params: { id: 'chat-123' },
				body: { userId: 'new-user' }
			});

			await assert.rejects(
				async () => {
					await addParticipant(req as never, res as never, () => {});
				},
				{ message: 'Only admins and owners can add participants' }
			);
		});

		it('should throw conflict when user is already a participant', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('ADMIN')
			);
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'existing-user' })
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'admin-user' }),
				params: { id: 'chat-123' },
				body: { userId: 'existing-user' }
			});

			await assert.rejects(
				async () => {
					await addParticipant(req as never, res as never, () => {});
				},
				{ message: 'User is already a participant' }
			);
		});

		it('should throw not found when target user does not exist', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('ADMIN')
			);
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve(null)
			);
			mockPrisma.user.findUnique.mock.mockImplementationOnce(() => Promise.resolve(null));

			const req = createMockRequest({
				user: createMockUser({ sub: 'admin-user' }),
				params: { id: 'chat-123' },
				body: { userId: 'nonexistent-user' }
			});

			await assert.rejects(
				async () => {
					await addParticipant(req as never, res as never, () => {});
				},
				{ message: 'User not found' }
			);
		});

		it('should allow owner to add participant', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('OWNER')
			);
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve(null)
			);
			mockPrisma.user.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ id: 'new-user' })
			);
			mockPrisma.conversationParticipant.create.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockDbParticipant())
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'owner-user' }),
				params: { id: 'chat-123' },
				body: { userId: 'new-user' }
			});

			await addParticipant(req as never, res as never, () => {});

			assert.strictEqual(res._status, 201);
		});
	});

	describe('updateRole', () => {
		it('should update participant role', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('OWNER')
			);
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'target-user', role: 'MEMBER' })
			);
			mockPrisma.conversationParticipant.update.mock.mockImplementationOnce(() =>
				Promise.resolve(createMockDbParticipant({ role: 'ADMIN' }))
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'owner-user' }),
				params: { id: 'chat-123', uid: 'target-user' },
				body: { role: 'ADMIN' }
			});

			await updateRole(req as never, res as never, () => {});

			assert.ok(res._json);
		});

		it('should throw forbidden when non-owner tries to update role', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('ADMIN')
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'admin-user' }),
				params: { id: 'chat-123', uid: 'target-user' },
				body: { role: 'ADMIN' }
			});

			await assert.rejects(
				async () => {
					await updateRole(req as never, res as never, () => {});
				},
				{ message: 'Only owners can update participant roles' }
			);
		});

		it('should throw bad request when trying to change own role', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('OWNER')
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'owner-user' }),
				params: { id: 'chat-123', uid: 'owner-user' },
				body: { role: 'ADMIN' }
			});

			await assert.rejects(
				async () => {
					await updateRole(req as never, res as never, () => {});
				},
				{ message: 'Cannot change your own role' }
			);
		});

		it('should throw forbidden when trying to change owner role', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('OWNER')
			);
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'other-owner', role: 'OWNER' })
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'owner-user' }),
				params: { id: 'chat-123', uid: 'other-owner' },
				body: { role: 'ADMIN' }
			});

			await assert.rejects(
				async () => {
					await updateRole(req as never, res as never, () => {});
				},
				{ message: 'Cannot change the role of an owner' }
			);
		});
	});

	describe('removeParticipant', () => {
		it('should remove participant and return 204', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('ADMIN')
			);
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'target-user', role: 'MEMBER' })
			);
			mockPrisma.conversationParticipant.delete.mock.mockImplementationOnce(() =>
				Promise.resolve({})
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'admin-user' }),
				params: { id: 'chat-123', uid: 'target-user' }
			});

			await removeParticipant(req as never, res as never, () => {});

			assert.strictEqual(res._status, 204);
		});

		it('should allow member to leave chat', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('MEMBER')
			);
			mockPrisma.conversationParticipant.delete.mock.mockImplementationOnce(() =>
				Promise.resolve({})
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'member-user' }),
				params: { id: 'chat-123', uid: 'member-user' }
			});

			await removeParticipant(req as never, res as never, () => {});

			assert.strictEqual(res._status, 204);
		});

		it('should throw forbidden when member tries to remove others', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('MEMBER')
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'member-user' }),
				params: { id: 'chat-123', uid: 'other-user' }
			});

			await assert.rejects(
				async () => {
					await removeParticipant(req as never, res as never, () => {});
				},
				{ message: 'Only admins and owners can remove participants' }
			);
		});

		it('should throw bad request when owner tries to leave', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('OWNER')
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'owner-user' }),
				params: { id: 'chat-123', uid: 'owner-user' }
			});

			await assert.rejects(
				async () => {
					await removeParticipant(req as never, res as never, () => {});
				},
				{ message: 'Owner cannot leave the chat. Transfer ownership first.' }
			);
		});

		it('should throw forbidden when admin tries to remove another admin', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('ADMIN')
			);
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'other-admin', role: 'ADMIN' })
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'admin-user' }),
				params: { id: 'chat-123', uid: 'other-admin' }
			});

			await assert.rejects(
				async () => {
					await removeParticipant(req as never, res as never, () => {});
				},
				{ message: 'Admins can only remove members' }
			);
		});

		it('should throw forbidden when trying to remove owner', async () => {
			mockChatsService.getParticipantRole.mock.mockImplementationOnce(() =>
				Promise.resolve('OWNER')
			);
			mockPrisma.conversationParticipant.findUnique.mock.mockImplementationOnce(() =>
				Promise.resolve({ userId: 'co-owner', role: 'OWNER' })
			);

			const req = createMockRequest({
				user: createMockUser({ sub: 'owner-user' }),
				params: { id: 'chat-123', uid: 'co-owner' }
			});

			await assert.rejects(
				async () => {
					await removeParticipant(req as never, res as never, () => {});
				},
				{ message: 'Cannot remove the owner' }
			);
		});
	});
});
