import type { RequestHandler } from 'express';
import type {
	GoogleCompleteRequest,
	RegisterCompleteRequest,
	RegisterStartRequest
} from '@packages/schemas';
import * as authService from '../services/auth.service.js';
import { errors } from '../middleware/error-handler.js';
import { buildAuthorizationUrl } from '../lib/google-oauth.js';
import { env } from '../lib/env.js';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env['NODE_ENV'] === 'production',
	sameSite: 'strict' as const,
	maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const register: RequestHandler = async (req, res) => {
	const avatarUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
	const { user, accessToken, refreshToken } = await authService.registerUser(req.body, avatarUrl);

	res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
	res.status(201).json({ accessToken, user });
};

export const registerStart: RequestHandler = async (req, res) => {
	const { setupToken } = await authService.startEmailRegistration(req.body as RegisterStartRequest);
	const setupUrl = `/register/setup?flow=email&token=${encodeURIComponent(setupToken)}`;

	res.status(201).json({ setupToken, setupUrl });
};

export const registerComplete: RequestHandler = async (req, res) => {
	const avatarUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
	const { user, accessToken, refreshToken } = await authService.completeEmailRegistration(
		req.body as RegisterCompleteRequest,
		avatarUrl
	);

	res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
	res.status(201).json({ accessToken, user });
};

export const login: RequestHandler = async (req, res) => {
	const { user, accessToken, refreshToken } = await authService.loginUser(req.body);

	res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
	res.json({ accessToken, user });
};

export const logout: RequestHandler = async (req, res) => {
	const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;

	if (refreshToken) {
		await authService.logoutUser(refreshToken);
	}

	res.clearCookie(REFRESH_TOKEN_COOKIE);
	res.status(204).send();
};

export const refresh: RequestHandler = async (req, res) => {
	const token = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;

	if (!token) {
		throw errors.unauthorized('Missing refresh token');
	}

	const { accessToken, refreshToken } = await authService.refreshTokens(token);

	res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
	res.json({ accessToken });
};

// Google OAuth
export const googleAuth: RequestHandler = (_req, res) => {
	const authUrl = buildAuthorizationUrl();

	res.redirect(authUrl);
};

export const googleCallback: RequestHandler = async (req, res) => {
	const code = req.query['code'] as string | undefined;

	if (!code) {
		throw errors.badRequest('Missing authorization code');
	}

	const result = await authService.handleGoogleCallback(code);

	if (result.type === 'login') {
		// Returning user with complete profile → set cookie and redirect to success
		res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, COOKIE_OPTIONS);

		const successUrl = new URL(env.GOOGLE_SUCCESS_REDIRECT_URL);

		successUrl.searchParams.set('accessToken', result.accessToken);
		res.redirect(successUrl.toString());
	} else {
		// New/incomplete user → redirect to setup page with token
		const setupUrl = new URL(env.GOOGLE_SETUP_REDIRECT_URL);

		setupUrl.searchParams.set('token', result.setupToken);
		res.redirect(setupUrl.toString());
	}
};

export const googleComplete: RequestHandler = async (req, res) => {
	const avatarUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
	const { user, accessToken, refreshToken } = await authService.completeGoogleSetup(
		req.body as GoogleCompleteRequest,
		avatarUrl
	);

	res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
	res.status(201).json({ accessToken, user });
};
