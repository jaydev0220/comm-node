import type { RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { errors } from '../middleware/error-handler.js';
import { ensureUploadsDirectory } from '../lib/uploads.js';

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const AVATAR_FIELD_NAME = 'avatar';

type FileFilter = NonNullable<multer.Options['fileFilter']>;

const GENERIC_ALLOWED_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'video/mp4',
	'video/webm',
	'audio/mpeg',
	'audio/wav',
	'application/pdf',
	'text/plain'
];
const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
const uploadsDirectoryPath = ensureUploadsDirectory();
// Configure multer storage
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, uploadsDirectoryPath);
	},
	filename: (_req, file, cb) => {
		const ext = path.extname(file.originalname);

		cb(null, `${randomUUID()}${ext}`);
	}
});

const createFileFilter =
	(allowedMimeTypes: readonly string[], errorMessage: string): FileFilter =>
	(_req, file, cb) => {
		if (allowedMimeTypes.includes(file.mimetype)) {
			cb(null, true);
			return;
		}

		cb(errors.badRequest(errorMessage));
	};

const createUpload = (
	allowedMimeTypes: readonly string[],
	errorMessage = 'Invalid file type'
): multer.Multer =>
	multer({
		storage,
		fileFilter: createFileFilter(allowedMimeTypes, errorMessage),
		limits: {
			fileSize: DEFAULT_MAX_FILE_SIZE_BYTES
		}
	});

export const upload = createUpload(GENERIC_ALLOWED_MIME_TYPES);

const avatarUpload = createUpload(
	AVATAR_ALLOWED_MIME_TYPES,
	'Invalid avatar file type. Allowed: image/jpeg, image/png, image/gif, image/webp'
);

export const uploadAvatar: RequestHandler = (req, res, next) => {
	avatarUpload.single(AVATAR_FIELD_NAME)(req, res, (err) => {
		if (!err) {
			next();
			return;
		}
		if (err instanceof multer.MulterError) {
			if (err.code === 'LIMIT_FILE_SIZE') {
				next(errors.badRequest('Avatar file must be 10MB or smaller'));
				return;
			}
			if (err.code === 'LIMIT_UNEXPECTED_FILE') {
				next(errors.badRequest(`Avatar file field must be "${AVATAR_FIELD_NAME}"`));
				return;
			}

			next(errors.badRequest('Invalid avatar upload payload'));
			return;
		}

		next(err);
	});
};

export const uploadFile: RequestHandler = async (req, res) => {
	if (!req.file) {
		throw errors.badRequest('No file provided');
	}

	const file = req.file;

	res.status(201).json({
		id: randomUUID(),
		url: `/uploads/${file.filename}`,
		mimeType: file.mimetype,
		size: file.size,
		name: file.originalname
	});
};
