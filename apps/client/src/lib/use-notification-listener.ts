'use client';

import { useEffect, useRef } from 'react';
import { getApiUrl } from '@/lib/api';
import type { Friendship } from '@/lib/api-types';

export type NotificationType = 'NEW_MESSAGE' | 'FRIEND_REQUEST';

export interface NotificationNewPayload {
	id: string;
	type: NotificationType;
	referenceId: string;
	createdAt: string;
}

export interface NotificationClearedPayload {
	ids: string[];
}

export type FriendAcceptedPayload = Friendship;

interface UseNotificationListenerOptions {
	accessToken: string | null;
	enabled?: boolean;
	onNotificationNew?: (payload: NotificationNewPayload) => void;
	onNotificationCleared?: (payload: NotificationClearedPayload) => void;
	onFriendAccepted?: (payload: FriendAcceptedPayload) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const isNotificationType = (value: unknown): value is NotificationType =>
	value === 'NEW_MESSAGE' || value === 'FRIEND_REQUEST';

const isFriendshipStatus = (value: unknown): value is Friendship['status'] =>
	value === 'PENDING' || value === 'ACCEPTED' || value === 'BLOCKED';

const parseFriendshipUser = (value: unknown): Friendship['requester'] | null => {
	if (!isRecord(value)) {
		return null;
	}

	const { id, email, username, displayName, createdAt, updatedAt } = value;
	const avatarUrl = value.avatarUrl;

	if (
		typeof id !== 'string' ||
		typeof email !== 'string' ||
		typeof username !== 'string' ||
		typeof displayName !== 'string' ||
		typeof createdAt !== 'string' ||
		typeof updatedAt !== 'string' ||
		(avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl !== 'string')
	) {
		return null;
	}

	const normalizedAvatarUrl = typeof avatarUrl === 'string' ? avatarUrl : undefined;

	return {
		id,
		email,
		username,
		displayName,
		avatarUrl: normalizedAvatarUrl,
		createdAt,
		updatedAt
	};
};

const parseNotificationNewPayload = (value: unknown): NotificationNewPayload | null => {
	if (!isRecord(value)) {
		return null;
	}

	const { id, type, referenceId, createdAt } = value;

	if (
		typeof id !== 'string' ||
		!isNotificationType(type) ||
		typeof referenceId !== 'string' ||
		typeof createdAt !== 'string'
	) {
		return null;
	}

	return { id, type, referenceId, createdAt };
};

const parseNotificationClearedPayload = (value: unknown): NotificationClearedPayload | null => {
	if (!isRecord(value) || !Array.isArray(value.ids)) {
		return null;
	}

	const ids: string[] = [];

	for (const id of value.ids) {
		if (typeof id !== 'string') {
			return null;
		}

		ids.push(id);
	}

	return { ids };
};

const parseFriendAcceptedPayload = (value: unknown): FriendAcceptedPayload | null => {
	if (!isRecord(value)) {
		return null;
	}

	const { id, status, requester, addressee, createdAt, updatedAt } = value;

	if (
		typeof id !== 'string' ||
		!isFriendshipStatus(status) ||
		typeof createdAt !== 'string' ||
		typeof updatedAt !== 'string'
	) {
		return null;
	}

	const parsedRequester = parseFriendshipUser(requester);
	const parsedAddressee = parseFriendshipUser(addressee);

	if (!parsedRequester || !parsedAddressee) {
		return null;
	}

	return {
		id,
		status,
		requester: parsedRequester,
		addressee: parsedAddressee,
		createdAt,
		updatedAt
	};
};

const toWebSocketUrl = (url: string, accessToken: string): string => {
	const wsUrl = new URL(url);
	wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
	wsUrl.searchParams.set('token', accessToken);
	return wsUrl.toString();
};

export const useNotificationListener = ({
	accessToken,
	enabled = true,
	onNotificationNew,
	onNotificationCleared,
	onFriendAccepted
}: UseNotificationListenerOptions): void => {
	const onNotificationNewRef = useRef(onNotificationNew);
	const onNotificationClearedRef = useRef(onNotificationCleared);
	const onFriendAcceptedRef = useRef(onFriendAccepted);

	useEffect(() => {
		onNotificationNewRef.current = onNotificationNew;
	}, [onNotificationNew]);

	useEffect(() => {
		onNotificationClearedRef.current = onNotificationCleared;
	}, [onNotificationCleared]);

	useEffect(() => {
		onFriendAcceptedRef.current = onFriendAccepted;
	}, [onFriendAccepted]);

	useEffect(() => {
		if (!enabled || !accessToken) {
			return;
		}

		const socket = new WebSocket(toWebSocketUrl(getApiUrl('/ws'), accessToken));
		const handleMessage = (event: MessageEvent) => {
			if (typeof event.data !== 'string') {
				return;
			}

			let parsedMessage: unknown;

			try {
				parsedMessage = JSON.parse(event.data);
			} catch {
				return;
			}

			if (!isRecord(parsedMessage)) {
				return;
			}

			if (parsedMessage.event === 'notification:new') {
				const payload = parseNotificationNewPayload(parsedMessage.payload);

				if (payload) {
					onNotificationNewRef.current?.(payload);
				}

				return;
			}

			if (parsedMessage.event === 'notification:cleared') {
				const payload = parseNotificationClearedPayload(parsedMessage.payload);

				if (payload) {
					onNotificationClearedRef.current?.(payload);
				}

				return;
			}

			if (parsedMessage.event === 'friend:accepted') {
				const payload = parseFriendAcceptedPayload(parsedMessage.payload);

				if (payload) {
					onFriendAcceptedRef.current?.(payload);
				}
			}
		};

		socket.addEventListener('message', handleMessage);

		return () => {
			socket.removeEventListener('message', handleMessage);
			socket.close();
		};
	}, [accessToken, enabled]);
};
