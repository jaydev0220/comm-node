import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { WsClientMessage } from '@packages/schemas';
import { wsClientMessageSchema } from '@packages/schemas';
import {
	addConnection,
	removeConnection,
	authenticateConnection,
	startHeartbeat,
	stopHeartbeat,
	handlePong,
	type AuthenticatedSocket
} from './connection.js';
import { sendError } from './broadcast.js';

// ============================================================================
// Types
// ============================================================================

export type WsMessageHandler = (
	socket: AuthenticatedSocket,
	message: WsClientMessage
) => Promise<void>;

// ============================================================================
// Message Handlers Registry
// ============================================================================

const handlers: Map<string, WsMessageHandler> = new Map();

/**
 * Register a handler for a specific event type.
 */
export const registerHandler = (event: string, handler: WsMessageHandler): void => {
	handlers.set(event, handler);
};

// ============================================================================
// WebSocket Server
// ============================================================================

let wss: WebSocketServer | null = null;

/**
 * Create and configure the WebSocket server.
 */
export const createWebSocketServer = (httpServer: HttpServer): WebSocketServer => {
	wss = new WebSocketServer({
		noServer: true
	});
	// Handle new connections
	wss.on('connection', (ws: WebSocket, userId: string, email: string) => {
		const socket = ws as AuthenticatedSocket;

		socket.userId = userId;
		socket.email = email;
		socket.isAlive = true;
		addConnection(socket);
		// Handle pong for heartbeat
		socket.on('pong', () => handlePong(socket));
		// Handle incoming messages
		socket.on('message', async (data) => {
			try {
				const raw = JSON.parse(data.toString()) as unknown;
				const result = wsClientMessageSchema.safeParse(raw);

				if (!result.success) {
					const requestId = (raw as { requestId?: string })?.requestId;

					sendError(
						socket,
						'VALIDATION_FAILED',
						result.error.issues[0]?.message ?? 'Invalid message format',
						requestId
					);
					return;
				}

				const message = result.data;
				const handler = handlers.get(message.event);

				if (!handler) {
					sendError(
						socket,
						'VALIDATION_FAILED',
						`Unknown event: ${message.event}`,
						message.requestId
					);
					return;
				}

				await handler(socket, message);
			} catch (err) {
				console.error('[WS] Message handling error:', err);
				sendError(socket, 'INTERNAL_ERROR', 'Internal server error');
			}
		});
		// Handle close
		socket.on('close', () => {
			removeConnection(socket);
		});
		// Handle errors
		socket.on('error', (err) => {
			console.error('[WS] Socket error:', err);
			removeConnection(socket);
		});
	});
	// Handle HTTP upgrade requests
	httpServer.on('upgrade', async (request: IncomingMessage, socket, head) => {
		// Only handle /api/ws path
		const pathname = new URL(request.url ?? '', 'http://localhost').pathname;

		if (pathname !== '/api/ws') {
			socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
			socket.destroy();
			return;
		}

		// Authenticate
		const payload = await authenticateConnection(request.url);

		if (!payload) {
			socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
			socket.destroy();
			return;
		}

		// Complete upgrade
		wss!.handleUpgrade(request, socket, head, (ws) => {
			wss!.emit('connection', ws, payload.sub, payload.email);
		});
	});
	// Start heartbeat
	startHeartbeat();
	return wss;
};

/**
 * Get the WebSocket server instance.
 */
export const getWebSocketServer = (): WebSocketServer | null => wss;

/**
 * Gracefully shutdown the WebSocket server.
 */
export const closeWebSocketServer = (): Promise<void> => {
	return new Promise((resolve) => {
		stopHeartbeat();

		if (!wss) {
			resolve();
			return;
		}

		// Close all connections
		for (const client of wss.clients) {
			client.close(1001, 'Server shutting down');
		}

		wss.close(() => {
			wss = null;
			resolve();
		});
	});
};
