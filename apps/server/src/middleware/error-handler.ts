import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ErrorDetail } from '@packages/schemas';

export interface AppErrorOptions {
	code: string;
	message: string;
	status: number;
	details?: ErrorDetail[] | undefined;
}

/**
 * Create an application error with structured response format.
 * Uses factory function pattern (FP style, no classes).
 */
export const createAppError = (options: AppErrorOptions): Error & AppErrorOptions => {
	const error = new Error(options.message) as Error & AppErrorOptions;

	error.code = options.code;
	error.status = options.status;

	if (options.details) {
		error.details = options.details;
	}
	return error;
};

/**
 * Type guard to check if an error is an AppError.
 */
export const isAppError = (error: unknown): error is Error & AppErrorOptions => {
	return (
		error instanceof Error &&
		'code' in error &&
		'status' in error &&
		typeof (error as AppErrorOptions).code === 'string' &&
		typeof (error as AppErrorOptions).status === 'number'
	);
};

/**
 * Common error factories for typical HTTP errors.
 */
export const errors = {
	badRequest: (message: string, details?: ErrorDetail[]) =>
		createAppError({ code: 'BAD_REQUEST', message, status: 400, details }),

	unauthorized: (message = 'Invalid or expired token') =>
		createAppError({ code: 'UNAUTHORIZED', message, status: 401 }),

	forbidden: (message = 'Insufficient permissions') =>
		createAppError({ code: 'FORBIDDEN', message, status: 403 }),

	notFound: (message = 'Resource not found') =>
		createAppError({ code: 'NOT_FOUND', message, status: 404 }),

	conflict: (message: string) => createAppError({ code: 'CONFLICT', message, status: 409 }),

	validationFailed: (details: ErrorDetail[]) =>
		createAppError({
			code: 'VALIDATION_FAILED',
			message: 'Request validation failed',
			status: 422,
			details
		}),

	tooManyRequests: (message = 'Too many requests') =>
		createAppError({ code: 'TOO_MANY_REQUESTS', message, status: 429 }),

	internal: (message = 'Internal server error') =>
		createAppError({ code: 'INTERNAL_ERROR', message, status: 500 })
};

/**
 * 404 catch-all handler. Place after all routes, before error handler.
 */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
	next(errors.notFound(`Route ${req.method} ${req.path} not found`));
};

/**
 * Central error handler middleware.
 * Express 5 auto-forwards rejected promises to this handler.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
	if (isAppError(err)) {
		res.status(err.status).json({
			error: {
				code: err.code,
				message: err.message,
				...(err.details && { details: err.details })
			}
		});
		return;
	}
	// Log unexpected errors in development
	if (process.env['NODE_ENV'] !== 'production') {
		console.error('Unhandled error:', err);
	}

	// Don't expose internal error details to client
	res.status(500).json({
		error: {
			code: 'INTERNAL_ERROR',
			message: 'Internal server error'
		}
	});
};
