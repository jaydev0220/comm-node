import { Router } from 'express';
import * as searchController from '../controllers/search.controller.js';
import { validateQuery } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { searchParamsSchema } from '@packages/schemas';

const router = Router();

router.use(authenticate);
router.get('/', validateQuery(searchParamsSchema), searchController.search);

export default router;
