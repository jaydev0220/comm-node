import type { RequestHandler } from 'express';
import * as authService from '../services/auth.service.js';
import { errors } from '../middleware/error-handler.js';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env['NODE_ENV'] === 'production',
	sameSite: 'strict' as const,
	maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const register: RequestHandler = async (req, res) => {
	const { user, accessToken, refreshToken } = await authService.registerUser(req.body);

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

// Google OAuth stubs
export const googleAuth: RequestHandler = (_req, res) => {
	res.status(501).json({
		error: { code: 'NOT_IMPLEMENTED', message: 'Google OAuth not configured' }
	});
};

export const googleCallback: RequestHandler = (_req, res) => {
	res.status(501).json({
		error: { code: 'NOT_IMPLEMENTED', message: 'Google OAuth not configured' }
	});
};
