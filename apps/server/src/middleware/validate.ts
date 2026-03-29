import type { RequestHandler } from "express";
import type { ZodSchema, ZodError } from "zod";
import { errors } from "./error-handler.js";
import type { ErrorDetail } from "@packages/schemas";

/**
 * Convert Zod error to API error details format.
 */
const formatZodError = (error: ZodError): ErrorDetail[] => {
	return error.issues.map((issue) => ({
		field: issue.path.map(String).join("."),
		code: issue.code,
		message: issue.message,
	}));
};

interface ValidateOptions {
	body?: ZodSchema;
	query?: ZodSchema;
	params?: ZodSchema;
}

/**
 * Validation middleware factory.
 * Validates request body, query, and/or params against Zod schemas.
 * On success, replaces req.body/query/params with parsed (and coerced) values.
 * On failure, throws a 422 validation error.
 */
export const validate = (options: ValidateOptions): RequestHandler => {
	return async (req, _res, next) => {
		const allDetails: ErrorDetail[] = [];

		if (options.body) {
			const result = options.body.safeParse(req.body);
			if (!result.success) {
				allDetails.push(...formatZodError(result.error));
			} else {
				req.body = result.data;
			}
		}

		if (options.query) {
			const result = options.query.safeParse(req.query);
			if (!result.success) {
				allDetails.push(...formatZodError(result.error));
			} else {
				// Cast to satisfy Express types
				req.query = result.data as typeof req.query;
			}
		}

		if (options.params) {
			const result = options.params.safeParse(req.params);
			if (!result.success) {
				allDetails.push(...formatZodError(result.error));
			} else {
				// Cast to satisfy Express types
				req.params = result.data as typeof req.params;
			}
		}

		if (allDetails.length > 0) {
			throw errors.validationFailed(allDetails);
		}

		next();
	};
};

/**
 * Shorthand validators for common use cases.
 */
export const validateBody = (schema: ZodSchema): RequestHandler =>
	validate({ body: schema });

export const validateQuery = (schema: ZodSchema): RequestHandler =>
	validate({ query: schema });

export const validateParams = (schema: ZodSchema): RequestHandler =>
	validate({ params: schema });
