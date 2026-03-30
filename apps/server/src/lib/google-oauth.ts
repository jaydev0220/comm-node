import { env } from './env.js';

export interface GoogleUserInfo {
	googleId: string;
	email: string;
	name: string | undefined;
	picture: string | undefined;
}

interface GoogleTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	id_token?: string;
	scope: string;
}

interface GoogleUserInfoResponse {
	id: string;
	email: string;
	verified_email: boolean;
	name?: string;
	given_name?: string;
	family_name?: string;
	picture?: string;
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Build the Google OAuth authorization URL.
 * Redirects user to Google's consent screen.
 */
export const buildAuthorizationUrl = (): string => {
	const params = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID,
		redirect_uri: env.GOOGLE_CALLBACK_URL,
		response_type: 'code',
		scope: 'openid email profile',
		access_type: 'online',
		prompt: 'select_account'
	});
	return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

/**
 * Exchange authorization code for access token.
 */
const exchangeCodeForTokens = async (code: string): Promise<GoogleTokenResponse> => {
	const response = await fetch(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			code,
			grant_type: 'authorization_code',
			redirect_uri: env.GOOGLE_CALLBACK_URL
		})
	});

	if (!response.ok) {
		const error = await response.text();

		throw new Error(`Failed to exchange code for tokens: ${error}`);
	}
	return response.json() as Promise<GoogleTokenResponse>;
};

/**
 * Fetch user info from Google using access token.
 */
const fetchUserInfo = async (accessToken: string): Promise<GoogleUserInfoResponse> => {
	const response = await fetch(GOOGLE_USERINFO_URL, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});

	if (!response.ok) {
		const error = await response.text();

		throw new Error(`Failed to fetch user info: ${error}`);
	}
	return response.json() as Promise<GoogleUserInfoResponse>;
};

/**
 * Complete OAuth flow: exchange code for tokens and fetch user info.
 * Returns normalized user data.
 */
export const getGoogleUserInfo = async (code: string): Promise<GoogleUserInfo> => {
	const tokens = await exchangeCodeForTokens(code);
	const userInfo = await fetchUserInfo(tokens.access_token);

	if (!userInfo.email) {
		throw new Error('Google account does not have an email address');
	}
	return {
		googleId: userInfo.id,
		email: userInfo.email,
		name: userInfo.name ?? undefined,
		picture: userInfo.picture ?? undefined
	};
};
