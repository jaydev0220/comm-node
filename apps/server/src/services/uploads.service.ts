import { unlink } from 'node:fs/promises';
import type { Attachment } from '@packages/schemas';
import { prisma } from '../lib/db.js';
import { errors } from '../middleware/error-handler.js';

const formatAttachment = (attachment: {
	id: string;
	url: string;
	mimeType: string;
	size: number;
	name: string;
}): Attachment => ({
	id: attachment.id,
	url: attachment.url,
	mimeType: attachment.mimeType,
	size: attachment.size,
	name: attachment.name
});

const removeStoredFile = async (filePath: string): Promise<void> => {
	try {
		await unlink(filePath);
	} catch (error: unknown) {
		console.error('[Uploads] failed to remove unpersisted file:', error);
	}
};

export const createUploadedAttachment = async (file: Express.Multer.File): Promise<Attachment> => {
	const url = `/uploads/${file.filename}`;

	try {
		const attachment = await prisma.attachment.create({
			data: {
				url,
				mimeType: file.mimetype,
				size: file.size,
				name: file.originalname
			}
		});
		return formatAttachment(attachment);
	} catch (error: unknown) {
		await removeStoredFile(file.path);
		console.error('[Uploads] failed to persist attachment metadata:', error);
		throw errors.internal('Failed to persist uploaded file');
	}
};
