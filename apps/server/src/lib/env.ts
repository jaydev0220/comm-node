import { z } from 'zod';

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	PORT: z.coerce.number().int().positive().default(3000),
	DATABASE_URL: z.string().url(),

	// JWT configuration
	JWT_SECRET: z.string().min(32),
	JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
	JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

	// CORS
	CORS_ORIGIN: z.string().url().default('http://localhost:3001'),

	// Google OAuth
	GOOGLE_CLIENT_ID: z.string().min(1),
	GOOGLE_CLIENT_SECRET: z.string().min(1),
	GOOGLE_CALLBACK_URL: z.string().url(),
	GOOGLE_SUCCESS_REDIRECT_URL: z
		.string()
		.url()
		.optional()
		.transform((val) => val ?? undefined),
	GOOGLE_SETUP_REDIRECT_URL: z
		.string()
		.url()
		.optional()
		.transform((val) => val ?? undefined)
});
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	console.error('❌ Invalid environment variables:');
	console.error(parsed.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = {
	...parsed.data,
	// Derive redirect URLs from CORS_ORIGIN if not explicitly set
	GOOGLE_SUCCESS_REDIRECT_URL:
		parsed.data.GOOGLE_SUCCESS_REDIRECT_URL ?? `${parsed.data.CORS_ORIGIN}/auth/success`,
	GOOGLE_SETUP_REDIRECT_URL:
		parsed.data.GOOGLE_SETUP_REDIRECT_URL ?? `${parsed.data.CORS_ORIGIN}/register/google`
};

export type Env = z.infer<typeof envSchema>;
