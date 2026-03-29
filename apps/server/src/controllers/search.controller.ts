import type { RequestHandler } from 'express';
import * as searchService from '../services/search.service.js';
import type { SearchParams } from '@packages/schemas';

export const search: RequestHandler = async (req, res) => {
	const params = req.query as unknown as SearchParams;
	const userId = req.user!.sub;
	const result =
		params.type === 'users'
			? await searchService.searchUsers(userId, params)
			: await searchService.searchMessages(userId, params);

	res.json(result);
};
