import { Router } from 'express';
import { upload, uploadFile } from '../controllers/uploads.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.post('/', upload.single('file'), uploadFile);

export default router;
