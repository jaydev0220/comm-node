import { existsSync } from 'node:fs';
import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Load .env.development for local dev, .env for production/docker
const envFile = existsSync('.env.development') ? '.env.development' : '.env';

config({ path: envFile });

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations',
		seed: 'tsx prisma/seed.ts'
	},
	datasource: {
		url: env('DATABASE_URL')
	}
});
