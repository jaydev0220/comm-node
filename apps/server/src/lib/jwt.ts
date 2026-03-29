import * as jose from 'jose';
import { env } from './env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface TokenPayload {
	sub: string;
	email: string;
	type: 'access' | 'refresh';
}

/**
 * Parse duration string (e.g., "15m", "7d", "1h") to seconds.
 */
const parseDuration = (duration: string): number => {
	const match = duration.match(/^(\d+)([smhd])$/);

	if (!match || !match[1] || !match[2]) {
		throw new Error(`Invalid duration format: ${duration}`);
	}

	const value = parseInt(match[1], 10);
	const unit = match[2];

	switch (unit) {
		case 's':
			return value;
		case 'm':
			return value * 60;
		case 'h':
			return value * 60 * 60;
		case 'd':
			return value * 60 * 60 * 24;
		default:
			throw new Error(`Unknown duration unit: ${unit}`);
	}
};

/**
 * Sign an access token for the given user.
 */
export const signAccessToken = async (userId: string, email: string): Promise<string> => {
	const expiresIn = parseDuration(env.JWT_ACCESS_EXPIRES_IN);
	return new jose.SignJWT({ email, type: 'access' })
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(userId)
		.setIssuedAt()
		.setExpirationTime(`${expiresIn}s`)
		.sign(secret);
};

/**
 * Sign a refresh token for the given user.
 */
export const signRefreshToken = async (userId: string, email: string): Promise<string> => {
	const expiresIn = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
	return new jose.SignJWT({ email, type: 'refresh' })
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(userId)
		.setIssuedAt()
		.setExpirationTime(`${expiresIn}s`)
		.sign(secret);
};

/**
 * Verify and decode a JWT token.
 * Returns the payload if valid, null otherwise.
 */
export const verifyToken = async (token: string): Promise<TokenPayload | null> => {
	try {
		const { payload } = await jose.jwtVerify(token, secret);

		if (!payload.sub || !payload['email'] || !payload['type']) {
			return null;
		}
		return {
			sub: payload.sub,
			email: payload['email'] as string,
			type: payload['type'] as 'access' | 'refresh'
		};
	} catch {
		return null;
	}
};
