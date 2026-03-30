/**
 * Unit tests for uploads.controller.ts
 * Uses Node.js built-in test runner.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createMockRequest, createMockResponse, type MockResponse } from '../setup.js';

// Note: For upload controller, we test the uploadFile handler directly
// The multer middleware is configured separately and should be tested in integration tests

// Import controller
const { uploadFile } = await import('../src/controllers/uploads.controller.js');
// Helper to create mock multer file
const createMockMulterFile = (overrides = {}): Express.Multer.File => ({
	fieldname: 'file',
	originalname: 'test-document.pdf',
	encoding: '7bit',
	mimetype: 'application/pdf',
	destination: 'uploads/',
	filename: 'uuid-123.pdf',
	path: 'uploads/uuid-123.pdf',
	size: 12345,
	stream: null as never,
	buffer: Buffer.from(''),
	...overrides
});

describe('Uploads Controller', () => {
	let res: MockResponse;

	beforeEach(() => {
		res = createMockResponse();
	});
	describe('uploadFile', () => {
		it('should return 201 with file info when file is uploaded', async () => {
			const mockFile = createMockMulterFile({
				originalname: 'document.pdf',
				mimetype: 'application/pdf',
				filename: 'abc-123.pdf',
				size: 54321
			});
			const req = createMockRequest({
				file: mockFile
			});

			await uploadFile(req as never, res as never, () => {});
			assert.strictEqual(res._status, 201);

			const responseData = res._json as {
				id: string;
				url: string;
				mimeType: string;
				size: number;
				name: string;
			};

			assert.ok(responseData.id); // UUID generated
			assert.strictEqual(responseData.url, '/uploads/abc-123.pdf');
			assert.strictEqual(responseData.mimeType, 'application/pdf');
			assert.strictEqual(responseData.size, 54321);
			assert.strictEqual(responseData.name, 'document.pdf');
		});
		it('should throw bad request when no file is provided', async () => {
			const req = createMockRequest({
				file: undefined
			});

			await assert.rejects(
				async () => {
					await uploadFile(req as never, res as never, () => {});
				},
				{ message: 'No file provided' }
			);
		});
		it('should handle image file upload', async () => {
			const mockFile = createMockMulterFile({
				originalname: 'photo.jpg',
				mimetype: 'image/jpeg',
				filename: 'img-456.jpg',
				size: 98765
			});
			const req = createMockRequest({
				file: mockFile
			});

			await uploadFile(req as never, res as never, () => {});
			assert.strictEqual(res._status, 201);

			const responseData = res._json as { mimeType: string; name: string };

			assert.strictEqual(responseData.mimeType, 'image/jpeg');
			assert.strictEqual(responseData.name, 'photo.jpg');
		});
		it('should handle video file upload', async () => {
			const mockFile = createMockMulterFile({
				originalname: 'video.mp4',
				mimetype: 'video/mp4',
				filename: 'vid-789.mp4',
				size: 1048576
			});
			const req = createMockRequest({
				file: mockFile
			});

			await uploadFile(req as never, res as never, () => {});
			assert.strictEqual(res._status, 201);

			const responseData = res._json as { mimeType: string; size: number };

			assert.strictEqual(responseData.mimeType, 'video/mp4');
			assert.strictEqual(responseData.size, 1048576);
		});
		it('should return correct URL path format', async () => {
			const mockFile = createMockMulterFile({
				filename: 'unique-id.png'
			});
			const req = createMockRequest({
				file: mockFile
			});

			await uploadFile(req as never, res as never, () => {});

			const responseData = res._json as { url: string };

			assert.ok(responseData.url.startsWith('/uploads/'));
			assert.ok(responseData.url.includes('unique-id.png'));
		});
		it('should generate unique ID for each upload', async () => {
			const mockFile1 = createMockMulterFile({ filename: 'file1.pdf' });
			const mockFile2 = createMockMulterFile({ filename: 'file2.pdf' });
			const req1 = createMockRequest({ file: mockFile1 });
			const req2 = createMockRequest({ file: mockFile2 });
			const res1 = createMockResponse();
			const res2 = createMockResponse();

			await uploadFile(req1 as never, res1 as never, () => {});
			await uploadFile(req2 as never, res2 as never, () => {});

			const data1 = res1._json as { id: string };
			const data2 = res2._json as { id: string };

			assert.notStrictEqual(data1.id, data2.id);
		});
		it('should preserve original filename in response', async () => {
			const mockFile = createMockMulterFile({
				originalname: 'My Important Document (2024).pdf',
				filename: 'uuid-renamed.pdf'
			});
			const req = createMockRequest({
				file: mockFile
			});

			await uploadFile(req as never, res as never, () => {});

			const responseData = res._json as { name: string };

			assert.strictEqual(responseData.name, 'My Important Document (2024).pdf');
		});
		it('should handle zero-byte file', async () => {
			const mockFile = createMockMulterFile({
				originalname: 'empty.txt',
				mimetype: 'text/plain',
				size: 0
			});
			const req = createMockRequest({
				file: mockFile
			});

			await uploadFile(req as never, res as never, () => {});
			assert.strictEqual(res._status, 201);

			const responseData = res._json as { size: number };

			assert.strictEqual(responseData.size, 0);
		});
		it('should handle audio file upload', async () => {
			const mockFile = createMockMulterFile({
				originalname: 'song.mp3',
				mimetype: 'audio/mpeg',
				filename: 'audio-123.mp3',
				size: 3145728
			});
			const req = createMockRequest({
				file: mockFile
			});

			await uploadFile(req as never, res as never, () => {});
			assert.strictEqual(res._status, 201);

			const responseData = res._json as { mimeType: string };

			assert.strictEqual(responseData.mimeType, 'audio/mpeg');
		});
	});
});
