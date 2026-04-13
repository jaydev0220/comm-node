/**
 * Unit tests for validate middleware.
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { listChatsParamsSchema, userSearchParamsSchema } from '@packages/schemas';
import { validateQuery } from '../../src/middleware/validate.js';
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
		assert.deepStrictEqual(req.query, { limit: 50 });
		assert.deepStrictEqual(next.mock.calls, [[]]);
	});
	it('should coerce search query params and apply defaults', async () => {
		const req = createGetterQueryRequest({ q: 'alice', page: '2' });
		const next = createMockNext();

		await validateQuery(userSearchParamsSchema)(req as never, {} as never, next);
		assert.deepStrictEqual(req.query, { q: 'alice', page: 2, limit: 20 });
		assert.deepStrictEqual(next.mock.calls, [[]]);
	});
});
