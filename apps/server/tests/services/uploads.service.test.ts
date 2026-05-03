import { mkdtemp, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';

const mockPrisma = {
	attachment: {
		create: mock.fn()
	}
};

mock.module('../../src/lib/db.js', {
	namedExports: { prisma: mockPrisma }
});

const { createUploadedAttachment } = await import('../../src/services/uploads.service.js');
const createMockMulterFile = (overrides = {}): Express.Multer.File => ({
	fieldname: 'file',
	originalname: 'document.pdf',
	encoding: '7bit',
	mimetype: 'application/pdf',
	destination: 'uploads/',
	filename: 'stored-document.pdf',
	path: 'uploads/stored-document.pdf',
	size: 12345,
	stream: null as never,
	buffer: Buffer.from(''),
	...overrides
});

describe('uploads.service', () => {
	beforeEach(() => {
		mockPrisma.attachment.create.mock.resetCalls();
	});
	it('creates a pending attachment record for the uploaded file', async () => {
		mockPrisma.attachment.create.mock.mockImplementationOnce(() =>
			Promise.resolve({
				id: 'attachment-1',
				messageId: null,
				url: '/uploads/stored-document.pdf',
				mimeType: 'application/pdf',
				size: 12345,
				name: 'document.pdf',
				createdAt: new Date('2024-01-01T00:00:00.000Z')
			})
		);

		const attachment = await createUploadedAttachment(createMockMulterFile());

		assert.deepStrictEqual(mockPrisma.attachment.create.mock.calls[0]?.arguments, [
			{
				data: {
					url: '/uploads/stored-document.pdf',
					mimeType: 'application/pdf',
					size: 12345,
					name: 'document.pdf'
				}
			}
		]);
		assert.deepStrictEqual(attachment, {
			id: 'attachment-1',
			url: '/uploads/stored-document.pdf',
			mimeType: 'application/pdf',
			size: 12345,
			name: 'document.pdf'
		});
	});
	it('removes the saved file when attachment persistence fails', async () => {
		const tempDirectory = await mkdtemp(path.join(tmpdir(), 'comm-node-upload-'));
		const filePath = path.join(tempDirectory, 'orphan.pdf');

		await writeFile(filePath, 'orphaned file content');
		mockPrisma.attachment.create.mock.mockImplementationOnce(() =>
			Promise.reject(new Error('database unavailable'))
		);

		try {
			await assert.rejects(
				() =>
					createUploadedAttachment(
						createMockMulterFile({
							filename: 'orphan.pdf',
							path: filePath
						})
					),
				(error: { code?: string; message?: string }) => {
					assert.strictEqual(error.code, 'INTERNAL_ERROR');
					assert.strictEqual(error.message, 'Failed to persist uploaded file');
					return true;
				}
			);
			await assert.rejects(() => access(filePath));
		} finally {
			await rm(tempDirectory, { recursive: true, force: true });
		}
	});
});
