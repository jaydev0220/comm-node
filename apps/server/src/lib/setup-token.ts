import * as jose from 'jose';
import { env } from './env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const SETUP_TOKEN_EXPIRY = '15m';

export interface SetupTokenPayload {
	email: string;
	googleId: string;
	type: 'oauth-setup';
}

/**
 * Sign a short-lived setup token for OAuth profile completion.
 * Valid for 15 minutes.
 */
export const signSetupToken = async (email: string, googleId: string): Promise<string> => {
	return new jose.SignJWT({ email, googleId, type: 'oauth-setup' })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime(SETUP_TOKEN_EXPIRY)
		.sign(secret);
};

/**
 * Verify and decode a setup token.
 * Returns payload if valid, null otherwise.
 */
export const verifySetupToken = async (token: string): Promise<SetupTokenPayload | null> => {
	try {
		const { payload } = await jose.jwtVerify(token, secret);

		if (
			payload['type'] !== 'oauth-setup' ||
			typeof payload['email'] !== 'string' ||
			typeof payload['googleId'] !== 'string'
		) {
			return null;
		}
		return {
			email: payload['email'],
			googleId: payload['googleId'],
			type: 'oauth-setup'
		};
	} catch {
		return null;
	}
};
