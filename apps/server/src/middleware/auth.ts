import type { RequestHandler } from 'express';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';
import { errors } from './error-handler.js';

// Extend Express Request type to include user
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface Request {
			user?: TokenPayload;
		}
	}
}

/**
 * Extract Bearer token from Authorization header.
 */
const extractBearerToken = (authHeader: string | undefined): string | null => {
	if (!authHeader?.startsWith('Bearer ')) {
		return null;
	}
	return authHeader.slice(7);
};

/**
 * Authentication middleware.
 * Verifies JWT from Authorization header and populates req.user.
 * Throws 401 if token is missing or invalid.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
	const token = extractBearerToken(req.headers.authorization);

	if (!token) {
		throw errors.unauthorized('Missing authorization token');
	}

	const payload = await verifyToken(token);

	if (!payload) {
		throw errors.unauthorized('Invalid or expired token');
	}

	if (payload.type !== 'access') {
		throw errors.unauthorized('Invalid token type');
	}

	req.user = payload;
	next();
};

/**
 * Optional authentication middleware.
 * Populates req.user if valid token present, but doesn't require it.
 * Useful for endpoints that behave differently for authenticated users.
 */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
	const token = extractBearerToken(req.headers.authorization);

	if (token) {
		const payload = await verifyToken(token);
		if (payload?.type === 'access') {
			req.user = payload;
		}
	}

	next();
};
