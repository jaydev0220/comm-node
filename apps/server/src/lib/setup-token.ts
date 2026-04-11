import * as jose from 'jose';
import { env } from './env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const SETUP_TOKEN_EXPIRY = '15m';

export interface OAuthSetupTokenPayload {
	email: string;
	googleId: string;
	type: 'oauth-setup';
}

export interface RegisterSetupTokenPayload {
	email: string;
	passwordHash: string;
	type: 'register-setup';
}

export type SetupTokenPayload = OAuthSetupTokenPayload;

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

/**
 * Sign a short-lived setup token for email registration completion.
 * Valid for 15 minutes.
 */
export const signRegisterSetupToken = async (
	email: string,
	passwordHash: string
): Promise<string> => {
	return new jose.SignJWT({ email, passwordHash, type: 'register-setup' })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime(SETUP_TOKEN_EXPIRY)
		.sign(secret);
};

/**
 * Verify and decode an email registration setup token.
 * Returns payload if valid, null otherwise.
 */
export const verifyRegisterSetupToken = async (
	token: string
): Promise<RegisterSetupTokenPayload | null> => {
	try {
		const { payload } = await jose.jwtVerify(token, secret);

		if (
			payload['type'] !== 'register-setup' ||
			typeof payload['email'] !== 'string' ||
			typeof payload['passwordHash'] !== 'string'
		) {
			return null;
		}
		return {
			email: payload['email'],
			passwordHash: payload['passwordHash'],
			type: 'register-setup'
		};
	} catch {
		return null;
	}
};
