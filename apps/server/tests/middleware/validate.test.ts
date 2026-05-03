/**
 * Unit tests for validate middleware.
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
	deleteMessageRequestSchema,
	editMessageRequestSchema,
	listChatsParamsSchema,
	listMessagesParamsSchema,
	userSearchParamsSchema,
	uuidSchema
} from '@packages/schemas';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../../src/middleware/validate.js';
import { createMockNext } from '../setup.js';

const createGetterQueryRequest = (query: Record<string, string>) => {
	const req: Record<string, unknown> = {};

	Object.defineProperty(req, 'query', {
		configurable: true,
		enumerable: true,
		get: () => query
	});
	return req;
};

describe('validate middleware', () => {
	it('should replace getter-based req.query with parsed values for chat lists', async () => {
		const req = createGetterQueryRequest({});
		const next = createMockNext();

		await validateQuery(listChatsParamsSchema)(req as never, {} as never, next);
		assert.deepStrictEqual(req['query'], { limit: 50 });
		assert.deepStrictEqual(next.mock.calls, [[]]);
	});
	it('should coerce search query params and apply defaults', async () => {
		const req = createGetterQueryRequest({ q: 'alice', page: '2' });
		const next = createMockNext();

		await validateQuery(userSearchParamsSchema)(req as never, {} as never, next);
		assert.deepStrictEqual(req['query'], { q: 'alice', page: 2, limit: 20 });
		assert.deepStrictEqual(next.mock.calls, [[]]);
	});
	it('should coerce message list limit query for message endpoints', async () => {
		const req = createGetterQueryRequest({ cursor: 'msg-1', limit: '25' });
		const next = createMockNext();

		await validateQuery(listMessagesParamsSchema)(req as never, {} as never, next);
		assert.deepStrictEqual(req['query'], { cursor: 'msg-1', limit: 25 });
		assert.deepStrictEqual(next.mock.calls, [[]]);
	});
	it('should return validation error when message list limit exceeds max', async () => {
		const req = createGetterQueryRequest({ limit: '101' });
		const next = createMockNext();

		await assert.rejects(
			async () => {
				await validateQuery(listMessagesParamsSchema)(req as never, {} as never, next);
			},
			(error: { code?: string; status?: number; details?: Array<{ field: string }> }) => {
				assert.strictEqual(error.code, 'VALIDATION_FAILED');
				assert.strictEqual(error.status, 422);
				assert.ok(error.details?.some((detail) => detail.field === 'limit'));
				return true;
			}
		);
		assert.deepStrictEqual(next.mock.calls, []);
	});
	it('should validate message mutation params and reject invalid UUIDs', async () => {
		const req = { params: { id: 'bad-id', messageId: 'bad-message-id' } };
		const next = createMockNext();
		const messageMutationParamsSchema = z.object({
			id: uuidSchema,
			messageId: uuidSchema
		});

		await assert.rejects(
			async () => {
				await validateParams(messageMutationParamsSchema)(req as never, {} as never, next);
			},
			(error: { code?: string; status?: number; details?: Array<{ field: string }> }) => {
				assert.strictEqual(error.code, 'VALIDATION_FAILED');
				assert.strictEqual(error.status, 422);
				assert.ok(error.details?.some((detail) => detail.field === 'id'));
				assert.ok(error.details?.some((detail) => detail.field === 'messageId'));
				return true;
			}
		);
		assert.deepStrictEqual(next.mock.calls, []);
	});
	it('should validate edit message payload content constraints', async () => {
		const req = { body: { content: '' } };
		const next = createMockNext();

		await assert.rejects(
			async () => {
				await validateBody(editMessageRequestSchema)(req as never, {} as never, next);
			},
			(error: { code?: string; status?: number; details?: Array<{ field: string }> }) => {
				assert.strictEqual(error.code, 'VALIDATION_FAILED');
				assert.strictEqual(error.status, 422);
				assert.ok(error.details?.some((detail) => detail.field === 'content'));
				return true;
			}
		);
		assert.deepStrictEqual(next.mock.calls, []);
	});
	it('should reject extra fields for delete message payload', async () => {
		const req = { body: { reason: 'cleanup' } };
		const next = createMockNext();

		await assert.rejects(
			async () => {
				await validateBody(deleteMessageRequestSchema)(req as never, {} as never, next);
			},
			(error: { code?: string; status?: number; details?: Array<{ field: string }> }) => {
				assert.strictEqual(error.code, 'VALIDATION_FAILED');
				assert.strictEqual(error.status, 422);
				assert.ok(error.details?.some((detail) => detail.field === ''));
				return true;
			}
		);
		assert.deepStrictEqual(next.mock.calls, []);
	});
});
