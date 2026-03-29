import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import friendsRoutes from './friends.routes.js';
import chatsRoutes from './chats.routes.js';
import participantsRoutes from './participants.routes.js';
import messagesRoutes from './messages.routes.js';
import uploadsRoutes from './uploads.routes.js';
import searchRoutes from './search.routes.js';

const router = Router();

// Auth routes (public)
router.use('/auth', authRoutes);
// User routes
router.use('/users', usersRoutes);
// Friends routes
router.use('/friends', friendsRoutes);
// Chat routes with nested participants and messages
router.use('/chats', chatsRoutes);
router.use('/chats/:id/participants', participantsRoutes);
router.use('/chats/:id/messages', messagesRoutes);
// Uploads
router.use('/uploads', uploadsRoutes);
// Search
router.use('/search', searchRoutes);

export default router;
