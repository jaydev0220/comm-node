'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react';
import { Check, Ellipsis, House, Loader2, MessageSquare, Plus, Search, X } from 'lucide-react';
import Avatar from '@/components/avatar';
import { useAuthSession } from '@/components/auth-session-provider';
import { api } from '@/lib/api';
import {
	useNotificationListener,
	type NotificationClearedPayload,
	type NotificationNewPayload
} from '@/lib/use-notification-listener';
import type {
	FriendRequestsResponse,
	FriendsResponse,
	Friendship,
	FriendWithPresence,
	SearchUsersResponse
} from '@/lib/api-types';
import { Button, FormField, Input, Separator } from '@/components/ui';

type PageState = 'home' | 'dm' | 'group';
type FriendStatusFilter = 'all' | 'online' | 'offline';
type FriendAction = 'block' | 'remove';
type RequestAction = 'accept' | 'reject';
interface FriendRequestToast {
	id: string;
	message: string;
	createdAt: number;
}

const FRIEND_REQUEST_TOAST_DURATION_MS = 5000;

const FRIEND_STATUS_OPTIONS: {
	value: FriendStatusFilter;
	label: string;
}[] = [
	{ value: 'all', label: '全部' },
	{ value: 'online', label: '線上' },
	{ value: 'offline', label: '離線' }
];

const getFriends = (): Promise<FriendsResponse> => api.get('/friends');
const getPendingRequests = (): Promise<FriendRequestsResponse> => api.get('/friends/requests');

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
	const { user, accessToken } = useAuthSession();
	const [friends, setFriends] = useState<FriendWithPresence[]>([]);
	const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
	const [friendRequestToasts, setFriendRequestToasts] = useState<FriendRequestToast[]>([]);
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

	useEffect(() => {
		void loadFriendData();
	}, [loadFriendData]);

	const handleRealtimeNotification = useCallback(
		(payload: NotificationNewPayload) => {
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
		[loadFriendData]
	);

	const handleNotificationCleared = useCallback((payload: NotificationClearedPayload) => {
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
			setOpenFriendMenuId(null);
		} catch (error) {
			setFriendActionError(getErrorMessage(error));
		} finally {
			setFriendActionState(null);
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
		<div className="flex h-full w-full flex-col overflow-hidden px-12 py-8">
			<div className="flex w-full flex-col gap-2">
				<form
					className="flex w-full items-end gap-2 text-xl"
					onSubmit={(event) => void handleSendFriendRequest(event)}
				>
					<div className="grow">
						<FormField label="新增好友" htmlFor="username">
							<Input
								id="username"
								name="username"
								type="text"
								value={addFriendInput}
								className="border-border w-full border"
								icon={<Plus size={16} />}
								placeholder="username…"
								autoComplete="username"
								spellCheck={false}
								onChange={(event) => setAddFriendInput(event.target.value)}
							/>
						</FormField>
					</div>
					<Button className="w-20" type="submit" loading={isSendingFriendRequest}>
						新增
					</Button>
				</form>
				{addFriendError ? (
					<p className="text-sm text-red-400" aria-live="polite">
						{addFriendError}
					</p>
				) : null}
				{addFriendSuccess ? (
					<p className="text-sm text-green-400" aria-live="polite">
						{addFriendSuccess}
					</p>
				) : null}
				{pendingRequests.length > 0 ? (
					<div className="border-border bg-surface flex w-full flex-col gap-2 rounded-lg border p-2">
						<div className="text-sm font-semibold">交友請求</div>
						{pendingRequestError ? (
							<p className="text-sm text-red-400" aria-live="polite">
								{pendingRequestError}
							</p>
						) : null}
						{pendingRequests.map((request) => {
							const isProcessing = requestActionState?.requestId === request.id;

							return (
								<div
									key={request.id}
									className="bg-surface-raised flex items-center gap-2 rounded-lg p-2"
								>
									<Avatar
										name={request.requester.displayName}
										avatarUrl={request.requester.avatarUrl}
										size="md"
									/>
									<div className="flex min-w-0 grow items-end gap-1 truncate">
										<span>{request.requester.displayName}</span>
										<span className="text-text-muted text-sm"> ({request.requester.username})</span>
									</div>
									<Button
										size="sm"
										variant="primary"
										loading={isProcessing && requestActionState?.action === 'accept'}
										onClick={() => void handleRespondToRequest(request.id, 'accept')}
									>
										<Check size={14} />
										接受
									</Button>
									<Button
										size="sm"
										variant="outline"
										loading={isProcessing && requestActionState?.action === 'reject'}
										onClick={() => void handleRespondToRequest(request.id, 'reject')}
									>
										<X size={14} />
										拒絕
									</Button>
								</div>
							);
						})}
					</div>
				) : null}
			</div>

			<Separator />

			<div className="flex min-h-0 w-full grow flex-col gap-2">
				<div className="flex w-full gap-2">
					<div className="grow">
						<Input
							id="user"
							name="user"
							type="text"
							icon={<Search size={16} />}
							placeholder="搜尋使用者…"
							autoComplete="off"
							onChange={(event) => setFriendSearchInput(event.target.value)}
						/>
					</div>
					<select
						id="filter-status"
						aria-label="好友狀態篩選"
						value={friendStatusFilter}
						onChange={(event) => setFriendStatusFilter(event.target.value as FriendStatusFilter)}
						className="border-border bg-surface w-20 rounded-lg border text-sm"
					>
						{FRIEND_STATUS_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
				{listError ? (
					<p className="text-sm text-red-400" aria-live="polite">
						{listError}
					</p>
				) : null}
				<div className="invisible-scroll-y flex min-h-0 grow flex-col gap-1 truncate">
					{filteredFriends.map((friend) => {
						const isMenuOpen = openFriendMenuId === friend.id;
						const isActionLoading = friendActionState?.friendId === friend.id;

						return (
							<div
								key={friend.id}
								className="border-border bg-surface flex w-full items-center gap-2 rounded-lg border p-2"
							>
								<Avatar name={friend.displayName} avatarUrl={friend.avatarUrl} size="md" />
								<div className="flex min-w-0 grow items-end gap-1">
									<span className="truncate">{friend.displayName}</span>
									<span className="text-text-muted truncate text-sm">({friend.username})</span>
								</div>
								<button
									type="button"
									aria-label="開啟私訊"
									className="hover:bg-surface-raised focus-visible:ring-border cursor-pointer rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
								>
									<MessageSquare size={20} />
								</button>
								<div className="relative" ref={isMenuOpen ? openMenuContainerRef : undefined}>
									<button
										type="button"
										aria-haspopup="menu"
										aria-expanded={isMenuOpen}
										aria-label="好友操作選單"
										className="hover:bg-surface-raised focus-visible:ring-border cursor-pointer rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
										onClick={() => toggleFriendMenu(friend.id)}
									>
										<Ellipsis size={20} />
									</button>
									{isMenuOpen ? (
										<div className="border-border bg-surface absolute top-full right-0 z-10 mt-2 flex w-36 flex-col gap-1 rounded-lg border p-1 shadow-lg">
											<button
												type="button"
												disabled={Boolean(isActionLoading)}
												className="hover:bg-surface-raised focus-visible:ring-border flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
												onClick={() => void handleFriendAction(friend.id, 'block')}
											>
												{isActionLoading && friendActionState?.action === 'block' ? (
													<Loader2 className="size-4 animate-spin" />
												) : null}
												<span>封鎖好友</span>
											</button>
											<button
												type="button"
												disabled={Boolean(isActionLoading)}
												className="hover:bg-surface-raised focus-visible:ring-border flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-400 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
												onClick={() => void handleFriendAction(friend.id, 'remove')}
											>
												{isActionLoading && friendActionState?.action === 'remove' ? (
													<Loader2 className="size-4 animate-spin" />
												) : null}
												<span>移除好友</span>
											</button>
											{friendActionError ? (
												<p className="px-3 pt-0.5 pb-1 text-xs text-red-400">{friendActionError}</p>
											) : null}
										</div>
									) : null}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);

	const renderDM = () => <></>;
	const renderGroupChat = () => <></>;

	return (
		<div className="flex h-dvh w-dvw overflow-hidden">
			<aside className="bg-surface border-border relative flex h-dvh w-20 flex-col overflow-hidden border-r p-3">
				<div className="w-full">
					<button
						type="button"
						aria-label="回到好友首頁"
						className="border-border hover:bg-surface-raised flex aspect-square h-auto w-full cursor-pointer items-center justify-center rounded-full border"
						onClick={() => setPageState('home')}
					>
						<House size={32} />
					</button>
				</div>

				<Separator />

				<div className="invisible-scroll-y flex h-full min-h-0 w-full grow flex-col items-center">
					<div className="flex flex-col gap-2">
						{friends.map((friend) => (
							<Avatar
								key={friend.id}
								name={friend.displayName}
								avatarUrl={friend.avatarUrl}
								size="lg"
							/>
						))}
					</div>
				</div>

				<div className="flex aspect-square w-full items-center justify-center">
					<Avatar name={user.displayName} avatarUrl={user.avatarUrl} size="lg" />
				</div>
			</aside>

			<main className="h-dvh grow">
				{pageState === 'home' ? renderHome() : pageState === 'dm' ? renderDM() : renderGroupChat()}
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
