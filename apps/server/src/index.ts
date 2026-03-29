import { createServer } from 'node:http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './lib/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import routes from './routes/index.js';
import { createWebSocketServer } from './ws/index.js';
import './ws/handlers.js';

const app = express();

// Trust proxy (for rate limiting headers behind reverse proxy)
app.set('trust proxy', 1);
// Security middleware
app.use(helmet());
app.use(
	cors({
		origin: env.CORS_ORIGIN,
		credentials: true
	})
);
// Rate limiting
app.use(
	rateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 100, // limit each IP to 100 requests per windowMs
		standardHeaders: true,
		legacyHeaders: false,
		message: {
			error: {
				code: 'TOO_MANY_REQUESTS',
				message: 'Too many requests, please try again later'
			}
		}
	})
);
// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
// Health check
app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});
// Static file serving for uploads
app.use('/uploads', express.static('uploads'));
// API routes
app.use('/api', routes);
// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Create HTTP server and attach WebSocket
const httpServer = createServer(app);

createWebSocketServer(httpServer);
// Start server
httpServer.listen(env.PORT, () => {
	console.log(`🚀 Server running on http://localhost:${env.PORT}`);
	console.log(`🔌 WebSocket available at ws://localhost:${env.PORT}/api/ws`);
	console.log(`📝 Environment: ${env.NODE_ENV}`);
});
