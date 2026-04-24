import { mkdirSync } from 'node:fs';
import path from 'node:path';

const UPLOADS_DIRECTORY_NAME = 'uploads';

export const uploadsDirectoryPath = path.resolve(process.cwd(), UPLOADS_DIRECTORY_NAME);

export const ensureUploadsDirectory = (): string => {
	mkdirSync(uploadsDirectoryPath, { recursive: true });
	return uploadsDirectoryPath;
};