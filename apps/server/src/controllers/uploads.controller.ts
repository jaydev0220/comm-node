import type { RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { errors } from '../middleware/error-handler.js';

// Configure multer storage
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, 'uploads/');
	},
	filename: (_req, file, cb) => {
		const ext = path.extname(file.originalname);
		cb(null, `${randomUUID()}${ext}`);
	}
});

// File filter - allow common types
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
	const allowedTypes = [
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

	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error('Invalid file type'));
	}
};

export const upload = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 10 * 1024 * 1024 // 10MB
	}
});

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
