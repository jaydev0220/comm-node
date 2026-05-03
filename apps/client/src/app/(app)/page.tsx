'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react';
import { House, Users, X } from 'lucide-react';
import { AccountActionsMenu } from '@/components/account-actions-menu';
import Avatar from '@/components/avatar';
import { DmView } from '@/components/dm-view';
import { GroupChatView } from '@/components/group-chat-view';
import { GroupsHomeView } from '@/components/groups-home-view';
import { HomeView } from '@/components/home-view';
import { ProfileView } from '@/components/profile-view';
import { useAuthSession } from '@/components/auth-session-provider';
import { api } from '@/lib/api';
import {
	useNotificationListener,
	type NotificationClearedPayload,
	type NotificationNewPayload
} from '@/lib/use-notification-listener';
import type {
	AppNotification,
	FriendRequestsResponse,
	FriendsResponse,
	Friendship,
	FriendWithPresence,
	NotificationsResponse,
	SearchUsersResponse
} from '@/lib/api-types';
import { Separator } from '@/components/ui';

type PageState = 'home' | 'dm' | 'groups-home' | 'group' | 'profile';
type FriendStatusFilter = 'all' | 'online' | 'offline';
type FriendAction = 'block' | 'remove';
type RequestAction = 'accept' | 'reject';
interface FriendRequestToast {
	id: string;
	message: string;
	createdAt: number;
}

const FRIEND_REQUEST_TOAST_DURATION_MS = 5000;
const NOTIFICATIONS_PAGE_LIMIT = 50;

const getFriends = (): Promise<FriendsResponse> => api.get('/friends');
const getPendingRequests = (): Promise<FriendRequestsResponse> => api.get('/friends/requests');

const UnreadDot = ({ className = '' }: { className?: string }) => (
	<span
		aria-hidden="true"
		className={`absolute size-3 rounded-full bg-red-500 ring-2 ring-surface ${
			className || 'top-0 right-0'
		}`}
	/>
);

const getErrorMessage = (error: unknown): string => {
	if (typeof error === 'object' && error && 'message' in error) {
		const message = (error as { message?: unknown }).message;

		if (typeof message === 'string' && message.length > 0) {
			return message;
		}
	}

	return '發生錯誤，請稍後再試';
};

const buildUserSearchQuery = (query: string): string => {
	const params = new URLSearchParams({
		q: query,
		type: 'users',
		page: '1',
		limit: '20'
	});

	return params.toString();
};

export default function AppPage() {
	const { user, accessToken, reloadSession, clearAccessToken } = useAuthSession();
	const [friends, setFriends] = useState<FriendWithPresence[]>([]);
	const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
	const [friendRequestToasts, setFriendRequestToasts] = useState<FriendRequestToast[]>([]);
	const [unreadNotifications, setUnreadNotifications] = useState<AppNotification[]>([]);
	const [pageState, setPageState] = useState<PageState>('home');
	const [friendSearchInput, setFriendSearchInput] = useState('');
	const [friendStatusFilter, setFriendStatusFilter] = useState<FriendStatusFilter>('all');
	const [addFriendInput, setAddFriendInput] = useState('');
	const [listError, setListError] = useState<string | null>(null);
	const [addFriendError, setAddFriendError] = useState<string | null>(null);
	const [addFriendSuccess, setAddFriendSuccess] = useState<string | null>(null);
	const [pendingRequestError, setPendingRequestError] = useState<string | null>(null);
	const [isSendingFriendRequest, setIsSendingFriendRequest] = useState(false);
	const [requestActionState, setRequestActionState] = useState<{
		requestId: string;
		action: RequestAction;
	} | null>(null);
	const [openFriendMenuId, setOpenFriendMenuId] = useState<string | null>(null);
	const [friendActionError, setFriendActionError] = useState<string | null>(null);
	const [friendActionState, setFriendActionState] = useState<{
		friendId: string;
		action: FriendAction;
	} | null>(null);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [selectedDmFriendId, setSelectedDmFriendId] = useState<string | null>(null);
	const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
	const openMenuContainerRef = useRef<HTMLDivElement | null>(null);

	const loadFriendData = useCallback(async () => {
		if (!user?.id) {
			return;
		}

		try {
			const [friendsResponse, pendingRequestsResponse] = await Promise.all([
				getFriends(),
				getPendingRequests()
			]);

			setFriends(friendsResponse.data);
			setPendingRequests(pendingRequestsResponse.data);
			setListError(null);
		} catch (error) {
			setListError(getErrorMessage(error));
		}
	}, [user?.id]);

	const loadUnreadNotifications = useCallback(async () => {
		if (!user?.id) {
			return;
		}

		try {
			const loadedNotifications: AppNotification[] = [];
			let page = 1;

			while (true) {
				const searchParams = new URLSearchParams({
					page: String(page),
					limit: String(NOTIFICATIONS_PAGE_LIMIT)
				});
				const response = await api.get<NotificationsResponse>(
					`/notifications?${searchParams.toString()}`
				);

				loadedNotifications.push(...response.data);

				if (!response.pagination.hasMore) {
					break;
				}

				page += 1;
			}

			setUnreadNotifications(loadedNotifications);
		} catch {
			setUnreadNotifications([]);
		}
	}, [user?.id]);

	useEffect(() => {
		void loadFriendData();
	}, [loadFriendData]);

	useEffect(() => {
		void loadUnreadNotifications();
	}, [loadUnreadNotifications]);

	const markNotificationsRead = useCallback(
		async (notificationIds: string[]) => {
			if (!user?.id) {
				return;
			}

			const uniqueNotificationIds = [...new Set(notificationIds)];

			if (uniqueNotificationIds.length === 0) {
				return;
			}

			try {
				await api.post<void>('/notifications/read', { ids: uniqueNotificationIds });
				const readNotificationIds = new Set(uniqueNotificationIds);

				setUnreadNotifications((currentNotifications) =>
					currentNotifications.filter((notification) => !readNotificationIds.has(notification.id))
				);
			} catch {
				// Keep unread state intact if the server cannot confirm the read transition.
			}
		},
		[user?.id]
	);

	const isMessageNotificationForActiveView = useCallback(
		(
			notification: Pick<
				AppNotification,
				'type' | 'actorId' | 'conversationId' | 'conversationType'
			>
		): boolean => {
			if (notification.type !== 'NEW_MESSAGE') {
				return false;
			}

			if (notification.conversationType === 'DIRECT') {
				return pageState === 'dm' && notification.actorId === selectedDmFriendId;
			}

			if (notification.conversationType === 'GROUP') {
				return pageState === 'group' && notification.conversationId === selectedGroupId;
			}

			return false;
		},
		[pageState, selectedDmFriendId, selectedGroupId]
	);

	const handleRealtimeNotification = useCallback(
		(payload: NotificationNewPayload) => {
			if (payload.type === 'NEW_MESSAGE' && isMessageNotificationForActiveView(payload)) {
				void markNotificationsRead([payload.id]);
				return;
			}

			setUnreadNotifications((currentNotifications) => {
				if (currentNotifications.some((notification) => notification.id === payload.id)) {
					return currentNotifications;
				}

				return [...currentNotifications, { ...payload, read: false }];
			});

			if (payload.type !== 'FRIEND_REQUEST') {
				return;
			}

			setFriendRequestToasts((currentToasts) => {
				if (currentToasts.some((toast) => toast.id === payload.id)) {
					return currentToasts;
				}

				return [
					...currentToasts,
					{
						id: payload.id,
						message: '收到新的好友邀請',
						createdAt: Date.now()
					}
				];
			});
			void loadFriendData();
		},
		[isMessageNotificationForActiveView, loadFriendData, markNotificationsRead]
	);

	const handleNotificationCleared = useCallback((payload: NotificationClearedPayload) => {
		setUnreadNotifications((currentNotifications) => {
			if (payload.ids.length === 0) {
				return [];
			}

			const clearedNotificationIds = new Set(payload.ids);
			return currentNotifications.filter(
				(notification) => !clearedNotificationIds.has(notification.id)
			);
		});

		setFriendRequestToasts((currentToasts) => {
			if (payload.ids.length === 0) {
				return [];
			}

			const clearedToastIds = new Set(payload.ids);
			return currentToasts.filter((toast) => !clearedToastIds.has(toast.id));
		});
	}, []);

	const handleFriendAccepted = useCallback(() => {
		void loadFriendData();
	}, [loadFriendData]);

	useEffect(() => {
		const visibleNotificationIds = unreadNotifications
			.filter(isMessageNotificationForActiveView)
			.map((notification) => notification.id);

		if (visibleNotificationIds.length > 0) {
			void markNotificationsRead(visibleNotificationIds);
		}
	}, [isMessageNotificationForActiveView, markNotificationsRead, unreadNotifications]);

	useNotificationListener({
		accessToken,
		enabled: Boolean(user?.id),
		onNotificationNew: handleRealtimeNotification,
		onNotificationCleared: handleNotificationCleared,
		onFriendAccepted: handleFriendAccepted
	});

	useEffect(() => {
		if (friendRequestToasts.length === 0) {
			return;
		}

		const timeoutHandles = friendRequestToasts.map((toast) =>
			window.setTimeout(() => {
				setFriendRequestToasts((currentToasts) =>
					currentToasts.filter((candidateToast) => candidateToast.id !== toast.id)
				);
			}, FRIEND_REQUEST_TOAST_DURATION_MS)
		);

		return () => {
			timeoutHandles.forEach((timeoutHandle) => {
				window.clearTimeout(timeoutHandle);
			});
		};
	}, [friendRequestToasts]);

	useEffect(() => {
		if (!openFriendMenuId) {
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			if (!openMenuContainerRef.current || friendActionState) {
				return;
			}

			if (event.target instanceof Node && !openMenuContainerRef.current.contains(event.target)) {
				setOpenFriendMenuId(null);
				setFriendActionError(null);
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !friendActionState) {
				setOpenFriendMenuId(null);
				setFriendActionError(null);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [openFriendMenuId, friendActionState]);

	const filteredFriends = useMemo(() => {
		const normalizedSearch = friendSearchInput.trim().toLowerCase();

		return friends.filter((friend) => {
			const isVisibleByStatus =
				friendStatusFilter === 'online'
					? friend.isOnline
					: friendStatusFilter === 'offline'
						? !friend.isOnline
						: true;

			if (!isVisibleByStatus) {
				return false;
			}

			if (!normalizedSearch) {
				return true;
			}

			return (
				friend.username.toLowerCase().includes(normalizedSearch) ||
				friend.displayName.toLowerCase().includes(normalizedSearch)
			);
		});
	}, [friendSearchInput, friendStatusFilter, friends]);

	const selectedDmFriend = useMemo<FriendWithPresence | null>(
		() => friends.find((friend) => friend.id === selectedDmFriendId) ?? null,
		[friends, selectedDmFriendId]
	);

	const unreadDmFriendIds = useMemo(() => {
		const friendIds = new Set<string>();

		for (const notification of unreadNotifications) {
			if (
				notification.type === 'NEW_MESSAGE' &&
				notification.conversationType === 'DIRECT' &&
				notification.actorId
			) {
				friendIds.add(notification.actorId);
			}
		}

		return friendIds;
	}, [unreadNotifications]);

	const unreadGroupIds = useMemo(() => {
		const groupIds = new Set<string>();

		for (const notification of unreadNotifications) {
			if (
				notification.type === 'NEW_MESSAGE' &&
				notification.conversationType === 'GROUP' &&
				notification.conversationId
			) {
				groupIds.add(notification.conversationId);
			}
		}

		return groupIds;
	}, [unreadNotifications]);

	useEffect(() => {
		if (!selectedDmFriendId) {
			return;
		}

		if (selectedDmFriend) {
			return;
		}

		setSelectedDmFriendId(null);

		if (pageState === 'dm') {
			setPageState('home');
		}
	}, [pageState, selectedDmFriend, selectedDmFriendId]);

	const handleSendFriendRequest = async (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmedInput = addFriendInput.trim();

		if (!trimmedInput) {
			setAddFriendError('請輸入使用者名稱');
			setAddFriendSuccess(null);
			return;
		}

		setIsSendingFriendRequest(true);
		setAddFriendError(null);
		setAddFriendSuccess(null);

		try {
			const searchResponse = await api.get<SearchUsersResponse>(
				`/search?${buildUserSearchQuery(trimmedInput)}`
			);
			const normalizedInput = trimmedInput.toLowerCase();
			const targetUser = searchResponse.data.find(
				(candidate) => candidate.username.toLowerCase() === normalizedInput
			);

			if (!targetUser) {
				setAddFriendError('找不到此使用者');
				return;
			}

			await api.post<Friendship>('/friends/requests', { addresseeId: targetUser.id });
			setAddFriendInput('');
			setAddFriendSuccess(`好友邀請已送出！`);
		} catch (error) {
			setAddFriendError(getErrorMessage(error));
		} finally {
			setIsSendingFriendRequest(false);
		}
	};

	const handleRespondToRequest = async (requestId: string, action: RequestAction) => {
		setRequestActionState({ requestId, action });
		setPendingRequestError(null);

		try {
			await api.patch<Friendship | { message: string }>(`/friends/requests/${requestId}`, {
				action
			});
			await loadFriendData();
		} catch (error) {
			setPendingRequestError(getErrorMessage(error));
		} finally {
			setRequestActionState(null);
		}
	};

	const toggleFriendMenu = (friendId: string) => {
		if (friendActionState) {
			return;
		}

		setFriendActionError(null);
		setOpenFriendMenuId((current) => (current === friendId ? null : friendId));
	};

	const handleFriendAction = async (friendId: string, action: FriendAction) => {
		setFriendActionState({ friendId, action });
		setFriendActionError(null);

		try {
			if (action === 'block') {
				await api.post<Friendship>('/friends/blocks', { targetId: friendId });
			} else {
				await api.delete<void>(`/friends/${friendId}`);
			}

			setFriends((currentFriends) => currentFriends.filter((friend) => friend.id !== friendId));

			if (selectedDmFriendId === friendId) {
				setSelectedDmFriendId(null);
				setPageState('home');
			}

			setOpenFriendMenuId(null);
		} catch (error) {
			setFriendActionError(getErrorMessage(error));
		} finally {
			setFriendActionState(null);
		}
	};

	const handleOpenDm = useCallback((friendId: string) => {
		setSelectedDmFriendId(friendId);
		setOpenFriendMenuId(null);
		setFriendActionError(null);
		setPageState('dm');
	}, []);

	const handleOpenGroup = useCallback((groupId: string) => {
		setSelectedGroupId(groupId);
		setPageState('group');
	}, []);

	const handleLogout = async () => {
		if (isLoggingOut) {
			return;
		}

		setIsLoggingOut(true);

		try {
			await api.post<void>('/auth/logout', {});
		} catch {
			// Local sign-out still needs to complete if the server session is already unavailable.
		} finally {
			clearAccessToken();
			setIsLoggingOut(false);
		}
	};

	const dismissToast = (toastId: string) => {
		setFriendRequestToasts((currentToasts) =>
			currentToasts.filter((toast) => toast.id !== toastId)
		);
	};

	if (!user) {
		return null;
	}

	const renderHome = () => (
		<HomeView
			addFriendInput={addFriendInput}
			addFriendError={addFriendError}
			addFriendSuccess={addFriendSuccess}
			pendingRequests={pendingRequests}
			pendingRequestError={pendingRequestError}
			requestActionState={requestActionState}
			isSendingFriendRequest={isSendingFriendRequest}
			friendStatusFilter={friendStatusFilter}
			listError={listError}
			filteredFriends={filteredFriends}
			unreadDmFriendIds={unreadDmFriendIds}
			openFriendMenuId={openFriendMenuId}
			friendActionState={friendActionState}
			friendActionError={friendActionError}
			openMenuContainerRef={openMenuContainerRef}
			onAddFriendInputChange={setAddFriendInput}
			onSendFriendRequest={(event) => {
				void handleSendFriendRequest(event);
			}}
			onRespondToRequest={(requestId, action) => {
				void handleRespondToRequest(requestId, action);
			}}
			onFriendSearchInputChange={setFriendSearchInput}
			onFriendStatusFilterChange={setFriendStatusFilter}
			onOpenDm={handleOpenDm}
			onToggleFriendMenu={toggleFriendMenu}
			onFriendAction={(friendId, action) => {
				void handleFriendAction(friendId, action);
			}}
		/>
	);

	const renderDM = () => {
		if (!selectedDmFriend || !accessToken) {
			return (
				<div className="text-text-muted flex h-full w-full items-center justify-center px-6 text-sm">
					請先從好友列表選擇對話對象
				</div>
			);
		}

		return <DmView accessToken={accessToken} currentUser={user} friend={selectedDmFriend} />;
	};

	const renderGroupsHome = () => (
		<GroupsHomeView
			friends={friends}
			unreadGroupIds={unreadGroupIds}
			onOpenGroup={handleOpenGroup}
		/>
	);

	const renderGroupChat = () => {
		if (!selectedGroupId || !accessToken) {
			return (
				<div className="text-text-muted flex h-full w-full items-center justify-center px-6 text-sm">
					請先從群組列表選擇對話
				</div>
			);
		}

		return <GroupChatView accessToken={accessToken} currentUser={user} groupId={selectedGroupId} />;
	};

	const renderProfile = () => (
		<ProfileView user={user} accessToken={accessToken} onProfileSaved={reloadSession} />
	);

	return (
		<div className="flex h-dvh w-dvw overflow-hidden">
			<aside className="bg-surface border-border relative flex h-dvh w-20 flex-col border-r p-3">
				<div className="flex w-full flex-col gap-2">
					<button
						type="button"
						aria-label="回到好友首頁"
						className="border-border hover:bg-surface-raised relative flex aspect-square h-auto w-full cursor-pointer items-center justify-center rounded-full border"
						onClick={() => setPageState('home')}
					>
						<House size={32} />
						{pendingRequests.length > 0 ? <UnreadDot className="top-1 right-1" /> : null}
					</button>
					<button
						type="button"
						aria-label="進入群組首頁"
						className="border-border hover:bg-surface-raised relative flex aspect-square h-auto w-full cursor-pointer items-center justify-center rounded-full border"
						onClick={() => setPageState('groups-home')}
					>
						<Users size={32} />
						{unreadGroupIds.size > 0 ? <UnreadDot className="top-1 right-1" /> : null}
					</button>
				</div>

				<Separator />

				<div className="invisible-scroll-y flex h-full min-h-0 w-full grow flex-col items-center">
					<div className="flex flex-col gap-2">
						{friends.map((friend) => (
							<div
								key={friend.id}
								className="relative"
								onClick={() => handleOpenDm(friend.id)}
							>
								<Avatar name={friend.displayName} avatarUrl={friend.avatarUrl} size="lg" />
								{unreadDmFriendIds.has(friend.id) ? <UnreadDot /> : null}
							</div>
						))}
					</div>
				</div>

				<div className="flex aspect-square w-full items-center justify-center">
					<AccountActionsMenu
						displayName={user.displayName}
						avatarUrl={user.avatarUrl}
						isLogoutPending={isLoggingOut}
						onOpenSettings={() => setPageState('profile')}
						onLogout={handleLogout}
					/>
				</div>
			</aside>

			<main className="h-dvh grow">
				{pageState === 'home'
					? renderHome()
					: pageState === 'dm'
						? renderDM()
						: pageState === 'groups-home'
							? renderGroupsHome()
							: pageState === 'profile'
								? renderProfile()
								: renderGroupChat()}
			</main>
			{friendRequestToasts.length > 0 ? (
				<div className="pointer-events-none fixed top-4 right-4 z-50 flex w-80 flex-col gap-2">
					{friendRequestToasts.map((toast) => (
						<div
							key={toast.id}
							role="status"
							aria-live="polite"
							className="border-border bg-surface-raised pointer-events-auto flex items-start gap-2 rounded-lg border p-3 shadow-lg"
						>
							<div className="grow">
								<p className="text-sm font-medium">{toast.message}</p>
							</div>
							<button
								type="button"
								aria-label="關閉通知"
								className="text-text-muted hover:bg-surface focus-visible:ring-border cursor-pointer rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
								onClick={() => dismissToast(toast.id)}
							>
								<X size={14} />
							</button>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
