import type { WebSocket } from 'ws';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';

// ============================================================================
// Types
// ============================================================================

/** Extended WebSocket with user metadata */
export interface AuthenticatedSocket extends WebSocket {
	userId: string;
	email: string;
	isAlive: boolean;
}

// ============================================================================
// Connection Store
// ============================================================================

/** Map of userId → Set of active WebSocket connections (multi-device support) */
const connections = new Map<string, Set<AuthenticatedSocket>>();

/**
 * Add a socket to the connection store.
 */
export const addConnection = (socket: AuthenticatedSocket): void => {
	const userSockets = connections.get(socket.userId);

	if (userSockets) {
		userSockets.add(socket);
	} else {
		connections.set(socket.userId, new Set([socket]));
	}
};

/**
 * Remove a socket from the connection store.
 */
export const removeConnection = (socket: AuthenticatedSocket): void => {
	const userSockets = connections.get(socket.userId);

	if (userSockets) {
		userSockets.delete(socket);

		if (userSockets.size === 0) {
			connections.delete(socket.userId);
		}
	}
};

/**
 * Get all sockets for a user (empty set if not connected).
 */
export const getSocketsForUser = (userId: string): Set<AuthenticatedSocket> => {
	return connections.get(userId) ?? new Set();
};

/**
 * Get all connected user IDs.
 */
export const getConnectedUserIds = (): string[] => {
	return Array.from(connections.keys());
};

/**
 * Get total connection count (for monitoring).
 */
export const getConnectionCount = (): number => {
	let count = 0;

	for (const sockets of connections.values()) {
		count += sockets.size;
	}
	return count;
};

// ============================================================================
// Authentication
// ============================================================================

/**
 * Authenticate a WebSocket connection using JWT from query param.
 * Returns TokenPayload on success, null on failure.
 */
export const authenticateConnection = async (
	url: string | undefined
): Promise<TokenPayload | null> => {
	if (!url) return null;

	try {
		const parsedUrl = new URL(url, 'ws://localhost');
		const token = parsedUrl.searchParams.get('token');

		if (!token) return null;

		const payload = await verifyToken(token);

		if (!payload || payload.type !== 'access') {
			return null;
		}
		return payload;
	} catch {
		return null;
	}
};

// ============================================================================
// Heartbeat
// ============================================================================

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the heartbeat mechanism for connection liveness.
 * Should be called once when the WebSocket server starts.
 */
export const startHeartbeat = (): void => {
	if (heartbeatTimer) return;

	heartbeatTimer = setInterval(() => {
		for (const userSockets of connections.values()) {
			for (const socket of userSockets) {
				if (!socket.isAlive) {
					socket.terminate();
					removeConnection(socket);
					continue;
				}

				socket.isAlive = false;
				socket.ping();
			}
		}
	}, HEARTBEAT_INTERVAL);
};

/**
 * Stop the heartbeat mechanism.
 * Should be called when shutting down the WebSocket server.
 */
export const stopHeartbeat = (): void => {
	if (heartbeatTimer) {
		clearInterval(heartbeatTimer);
		heartbeatTimer = null;
	}
};

/**
 * Handle pong response from client (marks connection as alive).
 */
export const handlePong = (socket: AuthenticatedSocket): void => {
	socket.isAlive = true;
};
