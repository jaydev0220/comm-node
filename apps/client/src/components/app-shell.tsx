'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
	ArrowRight,
	Home,
	LayoutGrid,
	LogOut,
	MessagesSquare,
	MoreHorizontal,
	PanelLeft,
	RefreshCcw,
	Search,
	Send,
	ShieldBan,
	Sparkles,
	Trash2,
	UserPlus,
	UsersRound
} from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { Button, FormField, Input } from '@/components/ui';
import { useAuthSession } from '@/components/auth-session-provider';
import { api } from '@/lib/api';
import { clearAccessToken } from '@/lib/auth-session';
import type { Chat, CursorPage, FriendWithPresence, FriendsResponse, OffsetPage, User } from '@/lib/api-types';

type WorkspaceView = 'friends' | 'directs' | 'groups';
type FriendStatusFilter = 'all' | 'online' | 'offline';
type WorkspaceState = 'loading' | 'ready' | 'error';

interface ChatsResponse {
	data: Chat[];
	pagination: CursorPage;
}

interface SearchUsersResponse {
	data: User[];
	pagination: OffsetPage;
}

const FRIEND_STATUS_OPTIONS: Array<{
	value: FriendStatusFilter;
	label: string;
}> = [
	{ value: 'all', label: '全部' },
	{ value: 'online', label: '線上' },
	{ value: 'offline', label: '離線' }
];

const formatPreview = (chat: Chat, currentUserId: string): string => {
	const lastMessage = chat.lastMessage;

	if (!lastMessage) {
		return '尚未有訊息';
	}

	const authorPrefix =
		lastMessage.sender.id === currentUserId ? '你：' : `${lastMessage.sender.displayName}：`;
	const body =
		lastMessage.content?.trim() ||
		(lastMessage.attachments.length > 0 ? `附件 ${lastMessage.attachments[0]?.name ?? ''}`.trim() : '') ||
		'系統訊息';

	return `${authorPrefix}${body}`;
};

const getDirectPartner = (chat: Chat, currentUserId: string): User | null =>
	chat.participants.find((participant) => participant.user.id !== currentUserId)?.user ?? null;

const getChatTitle = (chat: Chat, currentUserId: string): string => {
	if (chat.type === 'GROUP') {
		return chat.name ?? '未命名群組';
	}

	return getDirectPartner(chat, currentUserId)?.displayName ?? '直接訊息';
};

const getChatSubtitle = (chat: Chat, currentUserId: string): string => {
	if (chat.type === 'GROUP') {
		return `${chat.participants.length} 位成員`;
	}

	const partner = getDirectPartner(chat, currentUserId);
	return partner ? `@${partner.username}` : '個人聊天室';
};

const isFriendChat = (chat: Chat, friendId: string, currentUserId: string): boolean => {
	if (chat.type !== 'DIRECT') {
		return false;
	}

	const partner = getDirectPartner(chat, currentUserId);
	return partner?.id === friendId;
};

function ViewIcon({ view, className = 'size-4' }: { view: WorkspaceView; className?: string }) {
	if (view === 'friends') {
		return <UsersRound className={className} />;
	}

	if (view === 'directs') {
		return <MessagesSquare className={className} />;
	}

	return <LayoutGrid className={className} />;
}

function SectionTitle({
	title,
	description,
	action
}: {
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h2 className="text-lg font-semibold text-text-primary">{title}</h2>
				{description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
			</div>
			{action}
		</div>
	);
}

function SummaryCard({
	label,
	value,
	description,
	icon
}: {
	label: string;
	value: string | number;
	description: string;
	icon: ReactNode;
}) {
	return (
		<div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">{label}</p>
					<p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
				</div>
				<div className="flex size-11 items-center justify-center rounded-2xl bg-action-subtle text-action">
					{icon}
				</div>
			</div>
			<p className="mt-3 text-sm text-text-secondary">{description}</p>
		</div>
	);
}

function EmptyState({
	title,
	description,
	icon,
	action
}: {
	title: string;
	description: string;
	icon: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface px-6 py-10 text-center">
			<div className="flex size-14 items-center justify-center rounded-2xl bg-action-subtle text-action">
				{icon}
			</div>
			<h3 className="mt-4 text-lg font-semibold text-text-primary">{title}</h3>
			<p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">{description}</p>
			{action && <div className="mt-6">{action}</div>}
		</div>
	);
}

function WorkspaceSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-3">
				{Array.from({ length: 3 }).map((_, index) => (
					<div key={`summary-skeleton-${index}`} className="animate-pulse rounded-3xl border border-border bg-surface p-4">
						<div className="h-3 w-24 rounded-full bg-border-subtle" />
						<div className="mt-4 h-8 w-16 rounded-full bg-border-subtle" />
						<div className="mt-4 h-3 w-36 rounded-full bg-border-subtle" />
					</div>
				))}
			</div>

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
				<div className="space-y-6">
					<div className="animate-pulse rounded-3xl border border-border bg-surface p-5">
						<div className="h-4 w-40 rounded-full bg-border-subtle" />
						<div className="mt-4 h-10 rounded-2xl bg-border-subtle" />
						<div className="mt-3 h-10 rounded-2xl bg-border-subtle" />
					</div>
					<div className="animate-pulse rounded-3xl border border-border bg-surface p-5">
						<div className="h-4 w-36 rounded-full bg-border-subtle" />
						<div className="mt-4 space-y-3">
							{Array.from({ length: 4 }).map((_, index) => (
								<div key={`friend-skeleton-${index}`} className="h-20 rounded-2xl bg-border-subtle" />
							))}
						</div>
					</div>
				</div>

				<div className="animate-pulse rounded-3xl border border-border bg-surface p-5">
					<div className="h-4 w-32 rounded-full bg-border-subtle" />
					<div className="mt-4 space-y-4">
						{Array.from({ length: 3 }).map((_, index) => (
							<div key={`detail-skeleton-${index}`} className="h-24 rounded-2xl bg-border-subtle" />
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

function FriendMenu({
	open,
	onToggle,
	onOpenDirectMessage,
	onRemoveFriend,
	onBlockFriend,
	disabled
}: {
	open: boolean;
	onToggle: () => void;
	onOpenDirectMessage: () => void;
	onRemoveFriend: () => void;
	onBlockFriend: () => void;
	disabled?: boolean;
}) {
	return (
		<div className="relative" data-friend-menu>
			<button
				type="button"
				className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-border-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="好友選單"
				aria-expanded={open}
				disabled={disabled}
				onClick={(event) => {
					event.stopPropagation();
					onToggle();
				}}
			>
				<MoreHorizontal className="size-4" />
			</button>

			{open && (
				<div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-border bg-surface p-2 shadow-lg">
					<button
						type="button"
						className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-border-subtle"
						onClick={onOpenDirectMessage}
					>
						<Send className="size-4 text-text-secondary" />
						開啟私訊
					</button>
					<button
						type="button"
						className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-border-subtle"
						onClick={onRemoveFriend}
					>
						<Trash2 className="size-4 text-text-secondary" />
						移除好友
					</button>
					<button
						type="button"
						className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive-subtle"
						onClick={onBlockFriend}
					>
						<ShieldBan className="size-4" />
						封鎖使用者
					</button>
				</div>
			)}
		</div>
	);
}

export function AppShell() {
	const { user } = useAuthSession();
	const router = useRouter();
	const [activeView, setActiveView] = useState<WorkspaceView>('friends');
	const [friends, setFriends] = useState<FriendWithPresence[]>([]);
	const [chats, setChats] = useState<Chat[]>([]);
	const [workspaceState, setWorkspaceState] = useState<WorkspaceState>('loading');
	const [workspaceError, setWorkspaceError] = useState<string | null>(null);
	const [friendSearchQuery, setFriendSearchQuery] = useState('');
	const [friendStatusFilter, setFriendStatusFilter] = useState<FriendStatusFilter>('all');
	const [inviteQuery, setInviteQuery] = useState('');
	const [inviteResults, setInviteResults] = useState<User[]>([]);
	const [inviteLoading, setInviteLoading] = useState(false);
	const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
	const [requestedFriendIds, setRequestedFriendIds] = useState<string[]>([]);
	const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
	const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
	const [openFriendMenuId, setOpenFriendMenuId] = useState<string | null>(null);
	const [openingFriendId, setOpeningFriendId] = useState<string | null>(null);
	const [busyFriendId, setBusyFriendId] = useState<string | null>(null);

	const currentUserId = user?.id ?? '';

	const fetchWorkspace = useCallback(async (): Promise<{ friends: FriendWithPresence[]; chats: Chat[] }> => {
		const [friendsResponse, chatsResponse] = await Promise.all([
			api.get<FriendsResponse>('/friends'),
			api.get<ChatsResponse>('/chats')
		]);

		return {
			friends: friendsResponse.data,
			chats: chatsResponse.data
		};
	}, []);

	const refreshWorkspace = useCallback(async (): Promise<{ friends: FriendWithPresence[]; chats: Chat[] }> => {
		setWorkspaceError(null);
		const data = await fetchWorkspace();
		setFriends(data.friends);
		setChats(data.chats);
		return data;
	}, [fetchWorkspace]);

	const loadWorkspace = useCallback(async () => {
		setWorkspaceState('loading');
		setWorkspaceError(null);

		try {
			const data = await fetchWorkspace();
			setFriends(data.friends);
			setChats(data.chats);
			setWorkspaceState('ready');
		} catch (error) {
			if ((error as { status?: number }).status === 401) {
				return;
			}

			setWorkspaceError((error as { message?: string }).message ?? '載入好友與聊天室失敗');
			setWorkspaceState('error');
		}
	}, [fetchWorkspace]);

	useEffect(() => {
		if (!user) {
			return;
		}

		let isActive = true;

		const run = async () => {
			setWorkspaceState('loading');
			setWorkspaceError(null);

			try {
				const data = await fetchWorkspace();

				if (!isActive) {
					return;
				}

				setFriends(data.friends);
				setChats(data.chats);
				setWorkspaceState('ready');
			} catch (error) {
				if (!isActive) {
					return;
				}

				if ((error as { status?: number }).status === 401) {
					return;
				}

				setWorkspaceError((error as { message?: string }).message ?? '載入好友與聊天室失敗');
				setWorkspaceState('error');
			}
		};

		void run();

		return () => {
			isActive = false;
		};
	}, [fetchWorkspace, user]);

	const directChats = useMemo(() => chats.filter((chat) => chat.type === 'DIRECT'), [chats]);
	const groupChats = useMemo(() => chats.filter((chat) => chat.type === 'GROUP'), [chats]);

	const directChatByFriendId = useMemo(() => {
		const map = new Map<string, Chat>();

		for (const chat of directChats) {
			const partner = getDirectPartner(chat, currentUserId);

			if (partner) {
				map.set(partner.id, chat);
			}
		}

		return map;
	}, [currentUserId, directChats]);

	const filteredFriends = useMemo(() => {
		const query = friendSearchQuery.trim().toLowerCase();

		return friends.filter((friend) => {
			const matchesSearch =
				query.length === 0 ||
				friend.displayName.toLowerCase().includes(query) ||
				friend.username.toLowerCase().includes(query);
			const matchesStatus =
				friendStatusFilter === 'all' ||
				(friendStatusFilter === 'online' ? friend.isOnline : !friend.isOnline);

			return matchesSearch && matchesStatus;
		});
	}, [friendSearchQuery, friendStatusFilter, friends]);

	const selectedFriend = useMemo(
		() => friends.find((friend) => friend.id === selectedFriendId) ?? filteredFriends[0] ?? null,
		[filteredFriends, friends, selectedFriendId]
	);
	const selectedFriendChat = selectedFriend ? directChatByFriendId.get(selectedFriend.id) ?? null : null;
	const activeChats = activeView === 'groups' ? groupChats : directChats;
	const selectedChat = useMemo(
		() => activeChats.find((chat) => chat.id === selectedChatId) ?? activeChats[0] ?? null,
		[activeChats, selectedChatId]
	);

	const totalFriendCount = friends.length;
	const totalDirectCount = directChats.length;
	const totalGroupCount = groupChats.length;
	const sidebarFriends = friends.slice(0, 5);
	const extraSidebarFriendCount = Math.max(0, friends.length - sidebarFriends.length);

	useEffect(() => {
		if (activeView !== 'friends') {
			return;
		}

		if (selectedFriendId && filteredFriends.some((friend) => friend.id === selectedFriendId)) {
			return;
		}

		setSelectedFriendId(filteredFriends[0]?.id ?? null);
	}, [activeView, filteredFriends, selectedFriendId]);

	useEffect(() => {
		if (activeView === 'friends') {
			return;
		}

		if (selectedChatId && activeChats.some((chat) => chat.id === selectedChatId)) {
			return;
		}

		setSelectedChatId(activeChats[0]?.id ?? null);
	}, [activeChats, activeView, selectedChatId]);

	useEffect(() => {
		setOpenFriendMenuId(null);
	}, [activeView]);

	useEffect(() => {
		if (!openFriendMenuId) {
			return;
		}

		const handleOutsideClick = (event: MouseEvent) => {
			const target = event.target as HTMLElement | null;

			if (!target?.closest('[data-friend-menu]')) {
				setOpenFriendMenuId(null);
			}
		};

		document.addEventListener('mousedown', handleOutsideClick);

		return () => {
			document.removeEventListener('mousedown', handleOutsideClick);
		};
	}, [openFriendMenuId]);

	useEffect(() => {
		if (!inviteQuery.trim()) {
			setInviteResults([]);
			setInviteFeedback(null);
		}
	}, [inviteQuery]);

	useEffect(() => {
		if (!user) {
			return;
		}

		const interval = window.setInterval(() => {
			void refreshWorkspace().catch((error) => {
				if ((error as { status?: number }).status === 401) {
					return;
				}

				setWorkspaceError((error as { message?: string }).message ?? '載入好友與聊天室失敗');
			});
		}, 15_000);

		return () => window.clearInterval(interval);
	}, [refreshWorkspace, user]);

	const handleViewChange = (view: WorkspaceView) => {
		setActiveView(view);
		setOpenFriendMenuId(null);
	};

	const handleLogout = async () => {
		try {
			await api.post('/auth/logout', undefined);
		} catch {
			// Ignore logout failures; the local session will still be cleared.
		} finally {
			clearAccessToken();
			router.replace('/login');
		}
	};

	const openDirectChat = useCallback(
		async (friend: User) => {
			const existingChat = directChatByFriendId.get(friend.id);

			setOpeningFriendId(friend.id);
			setWorkspaceError(null);

			try {
				let chat = existingChat;

				if (!chat) {
					const createdChat = await api.post<Chat>('/chats', {
						type: 'DIRECT',
						participantId: friend.id
					});
					chat = createdChat;
					setChats((currentChats) => [
						createdChat,
						...currentChats.filter((item) => item.id !== createdChat.id)
					]);
				}

				if (!chat) {
					return;
				}

				setActiveView('directs');
				setSelectedChatId(chat.id);
				setOpenFriendMenuId(null);
			} catch (error) {
				if ((error as { status?: number }).status === 409) {
					const latestData = await refreshWorkspace();
					const latestChat = latestData.chats.find((chat) =>
						isFriendChat(chat, friend.id, currentUserId)
					);

					if (latestChat) {
						setActiveView('directs');
						setSelectedChatId(latestChat.id);
						setOpenFriendMenuId(null);
						return;
					}
				}

				setWorkspaceError((error as { message?: string }).message ?? '無法開啟私訊');
			} finally {
				setOpeningFriendId(null);
			}
		},
		[currentUserId, directChatByFriendId, refreshWorkspace]
	);

	const handleRemoveFriend = useCallback(
		async (friend: User) => {
			setBusyFriendId(friend.id);
			setWorkspaceError(null);

			try {
				await api.delete<void>(`/friends/${friend.id}`);
				setSelectedFriendId((currentSelectedFriendId) =>
					currentSelectedFriendId === friend.id ? null : currentSelectedFriendId
				);
				await refreshWorkspace();
			} catch (error) {
				setWorkspaceError((error as { message?: string }).message ?? '無法移除好友');
			} finally {
				setBusyFriendId(null);
				setOpenFriendMenuId(null);
			}
		},
		[refreshWorkspace]
	);

	const handleBlockFriend = useCallback(
		async (friend: User) => {
			setBusyFriendId(friend.id);
			setWorkspaceError(null);

			try {
				await api.post('/friends/blocks', {
					targetId: friend.id
				});
				setSelectedFriendId((currentSelectedFriendId) =>
					currentSelectedFriendId === friend.id ? null : currentSelectedFriendId
				);
				await refreshWorkspace();
			} catch (error) {
				setWorkspaceError((error as { message?: string }).message ?? '無法封鎖使用者');
			} finally {
				setBusyFriendId(null);
				setOpenFriendMenuId(null);
			}
		},
		[refreshWorkspace]
	);

	const handleInviteSearch = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const query = inviteQuery.trim();

		if (query.length < 2) {
			setInviteFeedback('請輸入至少 2 個字元');
			setInviteResults([]);
			return;
		}

		setInviteLoading(true);
		setInviteFeedback(null);

		try {
			const result = await api.get<SearchUsersResponse>(
				`/users/search?q=${encodeURIComponent(query)}&page=1&limit=5`
			);
			setInviteResults(result.data);

			if (result.data.length === 0) {
				setInviteFeedback('找不到符合的使用者');
			}
		} catch (error) {
			if ((error as { status?: number }).status === 401) {
				return;
			}

			setInviteFeedback((error as { message?: string }).message ?? '搜尋使用者失敗');
		} finally {
			setInviteLoading(false);
		}
	};

	const handleInviteUser = async (targetUser: User) => {
		if (friends.some((friend) => friend.id === targetUser.id) || requestedFriendIds.includes(targetUser.id)) {
			return;
		}

		setInviteLoading(true);
		setInviteFeedback(null);

		try {
			await api.post('/friends/requests', {
				addresseeId: targetUser.id
			});
			setRequestedFriendIds((currentIds) =>
				currentIds.includes(targetUser.id) ? currentIds : [...currentIds, targetUser.id]
			);
			setInviteFeedback(`已向 ${targetUser.displayName} 送出好友邀請`);
		} catch (error) {
			if ((error as { status?: number }).status === 409) {
				setRequestedFriendIds((currentIds) =>
					currentIds.includes(targetUser.id) ? currentIds : [...currentIds, targetUser.id]
				);
				setInviteFeedback('邀請已存在或對方已是好友');
			} else {
				setInviteFeedback((error as { message?: string }).message ?? '無法送出好友邀請');
			}
		} finally {
			setInviteLoading(false);
		}
	};

	const activeViewLabel = activeView === 'friends' ? '好友' : activeView === 'directs' ? '私訊' : '群組';

	const renderTab = (view: WorkspaceView, count: number) => {
		const isActive = activeView === view;

		return (
			<button
				type="button"
				onClick={() => handleViewChange(view)}
				className={`
					inline-flex min-w-0 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-colors
					${isActive ? 'border-action bg-action text-action-fg' : 'border-border bg-surface text-text-secondary hover:bg-border-subtle hover:text-text-primary'}
				`}
			>
				<ViewIcon view={view} />
				<span>{view === 'friends' ? '好友' : view === 'directs' ? '私訊' : '群組'}</span>
				<span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-white/15' : 'bg-border-subtle'}`}>
					{count}
				</span>
			</button>
		);
	};

	const renderFriendRow = (friend: FriendWithPresence) => {
		const isSelected = selectedFriend?.id === friend.id;
		const isMenuOpen = openFriendMenuId === friend.id;
		const isBusy = busyFriendId === friend.id || openingFriendId === friend.id;
		const statusText = friend.isOnline ? '線上' : '離線';

		return (
			<div
				key={friend.id}
				className={`
					flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between
					${isSelected ? 'border-action bg-action-subtle/70' : 'border-border bg-surface hover:bg-border-subtle/60'}
				`}
			>
				<button
					type="button"
					className="flex min-w-0 flex-1 items-center gap-3 text-left"
					onClick={() => {
						setActiveView('friends');
						setSelectedFriendId(friend.id);
					}}
				>
					<Avatar name={friend.displayName} avatarUrl={friend.avatarUrl} size="md" />
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<p className="truncate text-sm font-semibold text-text-primary">{friend.displayName}</p>
							<span
								className={`
									rounded-full px-2 py-0.5 text-[11px] font-medium
								${friend.isOnline ? 'bg-success-subtle text-success' : 'bg-border-subtle text-text-secondary'}
								`}
							>
								{statusText}
							</span>
						</div>
						<p className="mt-1 truncate text-xs text-text-secondary">@{friend.username}</p>
						<p className="mt-1 truncate text-xs text-text-muted">
							{friend.isOnline ? '目前在線' : '目前離線'}
						</p>
					</div>
				</button>

				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						loading={isBusy && openingFriendId === friend.id}
						disabled={isBusy}
						className="shrink-0"
						onClick={() => {
							void openDirectChat(friend);
						}}
					>
						<Send className="size-4" />
						私訊
					</Button>

					<FriendMenu
						open={isMenuOpen}
						disabled={isBusy}
						onToggle={() =>
							setOpenFriendMenuId((currentOpenFriendId) =>
								currentOpenFriendId === friend.id ? null : friend.id
							)
						}
						onOpenDirectMessage={() => {
							void openDirectChat(friend);
						}}
						onRemoveFriend={() => {
							void handleRemoveFriend(friend);
						}}
						onBlockFriend={() => {
							void handleBlockFriend(friend);
						}}
					/>
				</div>
			</div>
		);
	};

	const renderChatRow = (chat: Chat) => {
		const isSelected = selectedChat?.id === chat.id;
		const title = getChatTitle(chat, currentUserId);
		const subtitle = getChatSubtitle(chat, currentUserId);
		const preview = formatPreview(chat, currentUserId);
		const partner = chat.type === 'DIRECT' ? getDirectPartner(chat, currentUserId) : null;
		const avatarName = partner?.displayName ?? chat.name ?? '聊天室';
		const avatarUrl = partner?.avatarUrl ?? chat.avatarUrl;

		return (
			<div
				key={chat.id}
				className={`
					flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between
					${isSelected ? 'border-action bg-action-subtle/70' : 'border-border bg-surface hover:bg-border-subtle/60'}
				`}
			>
				<button
					type="button"
					className="flex min-w-0 flex-1 items-center gap-3 text-left"
					onClick={() => {
						setSelectedChatId(chat.id);
					}}
				>
					<Avatar name={avatarName} avatarUrl={avatarUrl} size="md" />
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<p className="truncate text-sm font-semibold text-text-primary">{title}</p>
							<span className="rounded-full bg-border-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary">
								{chat.type === 'DIRECT' ? '私訊' : '群組'}
							</span>
						</div>
						<p className="mt-1 truncate text-xs text-text-secondary">{subtitle}</p>
						<p className="mt-1 truncate text-xs text-text-muted">{preview}</p>
					</div>
				</button>

				<Button
					type="button"
					variant="outline"
					size="sm"
					className="shrink-0"
					onClick={() => {
						setSelectedChatId(chat.id);
					}}
				>
					<ArrowRight className="size-4" />
					開啟
				</Button>
			</div>
		);
	};

	const renderFriendsPanel = () => (
		<div className="space-y-6">
			<div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
				<SectionTitle
					title="新增好友"
					description="搜尋 username 或顯示名稱，然後送出好友邀請。"
				/>

				<form onSubmit={handleInviteSearch} className="mt-4 space-y-4">
					<FormField label="好友搜尋" htmlFor="invite-query">
						<Input
							id="invite-query"
							name="invite-query"
							value={inviteQuery}
							onChange={(event) => setInviteQuery(event.target.value)}
							placeholder="輸入 username 或顯示名稱"
							icon={<UserPlus className="size-4" />}
						/>
					</FormField>

					<div className="flex flex-wrap items-center gap-3">
						<Button type="submit" size="md" loading={inviteLoading}>
							搜尋使用者
						</Button>
						<p className="text-xs text-text-muted">支援模糊搜尋，邀請會以使用者 ID 送出。</p>
					</div>
				</form>

				{inviteFeedback && (
					<div className="mt-4 rounded-2xl border border-border bg-border-subtle/50 px-4 py-3 text-sm text-text-secondary">
						{inviteFeedback}
					</div>
				)}

				{inviteResults.length > 0 && (
					<div className="mt-4 space-y-3">
						{inviteResults.map((targetUser) => {
							const isAlreadyFriend = friends.some((friend) => friend.id === targetUser.id);
							const hasRequested = requestedFriendIds.includes(targetUser.id);

							return (
								<div
									key={targetUser.id}
									className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="flex min-w-0 items-center gap-3">
										<Avatar name={targetUser.displayName} avatarUrl={targetUser.avatarUrl} size="sm" />
										<div className="min-w-0">
											<p className="truncate text-sm font-medium text-text-primary">{targetUser.displayName}</p>
											<p className="truncate text-xs text-text-secondary">@{targetUser.username}</p>
										</div>
									</div>

									<Button
										type="button"
										variant={isAlreadyFriend || hasRequested ? 'secondary' : 'outline'}
										size="sm"
										disabled={inviteLoading || isAlreadyFriend || hasRequested}
										onClick={() => {
											void handleInviteUser(targetUser);
										}}
									>
										{isAlreadyFriend ? '已是好友' : hasRequested ? '已送出' : '送出邀請'}
									</Button>
								</div>
							);
						})}
					</div>
				)}
			</div>

			<div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
				<SectionTitle
					title="好友列表"
					description="使用搜尋和線上狀態篩選器快速找到好友。"
					action={
						<div className="flex flex-wrap gap-3">
							<div className="min-w-[220px] flex-1">
								<FormField label="搜尋好友" htmlFor="friend-search">
									<Input
										id="friend-search"
										value={friendSearchQuery}
										onChange={(event) => setFriendSearchQuery(event.target.value)}
										placeholder="搜尋姓名或 username"
										icon={<Search className="size-4" />}
									/>
								</FormField>
							</div>
							<div className="min-w-[180px]">
								<label htmlFor="friend-status" className="mb-1.5 block text-sm font-medium text-text-primary">
									線上狀態
								</label>
								<select
									id="friend-status"
									value={friendStatusFilter}
									onChange={(event) => setFriendStatusFilter(event.target.value as FriendStatusFilter)}
									className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-action focus:ring-2 focus:ring-action/50"
								>
									{FRIEND_STATUS_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>
						</div>
					}
				/>

				<div className="mt-5 space-y-3">
					{workspaceState === 'loading' ? (
						<WorkspaceSkeleton />
					) : filteredFriends.length > 0 ? (
						filteredFriends.map(renderFriendRow)
					) : (
						<EmptyState
							title="目前沒有符合條件的好友"
							description={
								friendSearchQuery.trim().length > 0 || friendStatusFilter !== 'all'
									? '請調整搜尋或篩選條件。'
									: '先透過上方搜尋框邀請第一位好友。'
							}
							icon={<UsersRound className="size-6" />}
						/>
					)}
				</div>
			</div>

			<div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
				<SectionTitle
					title="好友摘要"
					description="查看目前選取好友的資料與私訊狀態。"
				/>

				{selectedFriend ? (
					<div className="mt-5 space-y-4">
						<div className="flex items-center gap-4">
							<Avatar name={selectedFriend.displayName} avatarUrl={selectedFriend.avatarUrl} size="lg" />
							<div className="min-w-0">
								<p className="truncate text-lg font-semibold text-text-primary">{selectedFriend.displayName}</p>
								<p className="truncate text-sm text-text-secondary">@{selectedFriend.username}</p>
								<p className="truncate text-xs text-text-muted">{selectedFriend.email}</p>
							</div>
						</div>

						<div className="rounded-2xl border border-border bg-background p-4">
							<p className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">好友狀態</p>
							<p className="mt-2 text-sm text-text-secondary">
								{selectedFriend.isOnline ? '目前在線。' : '目前離線。'}
							</p>
							<p className="mt-2 text-sm text-text-secondary">
								{selectedFriendChat ? '已建立直接聊天室。' : '尚未建立直接聊天室。'}
							</p>
							{selectedFriendChat && (
								<p className="mt-2 text-sm text-text-secondary">{formatPreview(selectedFriendChat, currentUserId)}</p>
							)}
						</div>

						<div className="flex flex-wrap gap-3">
							<Button
								type="button"
								variant="outline"
								size="sm"
								loading={openingFriendId === selectedFriend.id}
								disabled={busyFriendId === selectedFriend.id}
								onClick={() => {
									void openDirectChat(selectedFriend);
								}}
							>
								<Send className="size-4" />
								{selectedFriendChat ? '打開私訊' : '建立私訊'}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-destructive hover:bg-destructive-subtle hover:text-destructive"
								disabled={busyFriendId === selectedFriend.id}
								onClick={() => {
									void handleBlockFriend(selectedFriend);
								}}
							>
								<ShieldBan className="size-4" />
								封鎖
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-destructive hover:bg-destructive-subtle hover:text-destructive"
								disabled={busyFriendId === selectedFriend.id}
								onClick={() => {
									void handleRemoveFriend(selectedFriend);
								}}
							>
								<Trash2 className="size-4" />
								移除
							</Button>
						</div>
					</div>
				) : (
					<EmptyState
						title="尚未選擇好友"
						description="點選任一好友以查看摘要與快速操作。"
						icon={<UsersRound className="size-6" />}
					/>
				)}
			</div>
		</div>
	);

	const renderChatsPanel = (view: Exclude<WorkspaceView, 'friends'>) => {
		const chatsForView = view === 'directs' ? directChats : groupChats;
		const selectedVisibleChat = chatsForView.find((chat) => chat.id === selectedChat?.id) ?? chatsForView[0] ?? null;

		return (
			<div className="space-y-6">
				<div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
					<SectionTitle
						title={view === 'directs' ? '直接訊息' : '群組聊天'}
						description={
							view === 'directs'
								? '列出與好友的一對一聊天室。'
								: '查看你目前參與的群組聊天室。'
						}
					/>

					<div className="mt-5 space-y-3">
						{chatsForView.length > 0 ? (
							chatsForView.map(renderChatRow)
						) : (
							<EmptyState
								title={view === 'directs' ? '還沒有直接訊息' : '還沒有群組'}
								description={
									view === 'directs'
										? '從好友列表按下私訊即可建立第一個直接聊天室。'
										: '建立群組聊天後，這裡就會顯示所有群組。'
								}
								icon={view === 'directs' ? <MessagesSquare className="size-6" /> : <LayoutGrid className="size-6" />}
								action={
									view === 'directs' ? (
										<Button type="button" variant="outline" size="sm" onClick={() => handleViewChange('friends')}>
											前往好友列表
										</Button>
									) : undefined
								}
							/>
						)}
					</div>
				</div>

				<div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
					<SectionTitle
						title={view === 'directs' ? '聊天室摘要' : '群組摘要'}
						description="在這裡查看聊天室細節和最新訊息。"
					/>

					<div className="mt-5">
						{selectedVisibleChat ? (
							<div className="space-y-4">
								<div className="flex items-center gap-4">
									<Avatar
										name={getChatTitle(selectedVisibleChat, currentUserId)}
										avatarUrl={
											selectedVisibleChat.type === 'DIRECT'
												? getDirectPartner(selectedVisibleChat, currentUserId)?.avatarUrl
												: selectedVisibleChat.avatarUrl
										}
										size="lg"
									/>
									<div className="min-w-0">
										<p className="truncate text-lg font-semibold text-text-primary">
											{getChatTitle(selectedVisibleChat, currentUserId)}
										</p>
										<p className="truncate text-sm text-text-secondary">
											{getChatSubtitle(selectedVisibleChat, currentUserId)}
										</p>
									</div>
								</div>

								<div className="rounded-2xl border border-border bg-background p-4">
									<p className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">最新訊息</p>
									<p className="mt-2 text-sm leading-6 text-text-secondary">
										{formatPreview(selectedVisibleChat, currentUserId)}
									</p>
								</div>

								<div className="flex flex-wrap gap-3">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => setSelectedChatId(selectedVisibleChat.id)}
									>
										<RefreshCcw className="size-4" />
										重新聚焦
									</Button>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onClick={() => handleViewChange('friends')}
									>
										<PanelLeft className="size-4" />
										返回好友
									</Button>
								</div>
							</div>
						) : (
							<EmptyState
								title="尚未選擇聊天室"
								description={
									view === 'directs'
										? '從列表中選擇一個直接聊天室以查看摘要。'
										: '從列表中選擇一個群組聊天室以查看摘要。'
								}
								icon={view === 'directs' ? <MessagesSquare className="size-6" /> : <LayoutGrid className="size-6" />}
							/>
						)}
					</div>
				</div>
			</div>
		);
	};

	if (!user) {
		return null;
	}

	return (
		<div className="flex min-h-screen overflow-hidden bg-background text-text-primary">
			<aside className="group/sidebar flex h-screen w-16 shrink-0 flex-col border-r border-border bg-surface/95 px-3 py-4 shadow-sm transition-[width] duration-300 ease-out hover:w-72">
				<div className="flex items-center gap-3 rounded-2xl bg-action-subtle px-3 py-3 text-left">
					<div className="flex size-10 items-center justify-center rounded-2xl bg-action text-action-fg">
						<Sparkles className="size-5" />
					</div>
					<div className="min-w-0 overflow-hidden opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
						<p className="truncate text-sm font-semibold text-text-primary">CommNode</p>
						<p className="truncate text-xs text-text-secondary">協作與聊天工作區</p>
					</div>
				</div>

				<div className="mt-4 space-y-2">
					<button
						type="button"
						onClick={() => handleViewChange('friends')}
						className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-border-subtle"
					>
						<div className="flex size-10 items-center justify-center rounded-2xl bg-surface-raised text-action">
							<Home className="size-5" />
						</div>
						<div className="min-w-0 overflow-hidden opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
							<p className="truncate text-sm font-medium text-text-primary">首頁</p>
							<p className="truncate text-xs text-text-secondary">好友與聊天室</p>
						</div>
					</button>

					<button
						type="button"
						onClick={() => handleViewChange('directs')}
						className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-border-subtle"
					>
						<div className="flex size-10 items-center justify-center rounded-2xl bg-surface-raised text-action">
							<MessagesSquare className="size-5" />
						</div>
						<div className="min-w-0 overflow-hidden opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
							<p className="truncate text-sm font-medium text-text-primary">私訊</p>
							<p className="truncate text-xs text-text-secondary">{totalDirectCount} 個對話</p>
						</div>
					</button>

					<button
						type="button"
						onClick={() => handleViewChange('groups')}
						className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-border-subtle"
					>
						<div className="flex size-10 items-center justify-center rounded-2xl bg-surface-raised text-action">
							<LayoutGrid className="size-5" />
						</div>
						<div className="min-w-0 overflow-hidden opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
							<p className="truncate text-sm font-medium text-text-primary">群組</p>
							<p className="truncate text-xs text-text-secondary">{totalGroupCount} 個群組</p>
						</div>
					</button>
				</div>

				<div className="mt-6 border-t border-border pt-4">
					<div className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.25em] text-text-muted opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
						好友快速切換
					</div>
					<div className="space-y-2">
						{sidebarFriends.map((friend) => (
							<button
								key={friend.id}
								type="button"
								className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-border-subtle"
								onClick={() => {
									setActiveView('friends');
									setSelectedFriendId(friend.id);
								}}
								title={friend.displayName}
							>
								<Avatar name={friend.displayName} avatarUrl={friend.avatarUrl} size="sm" />
								<div className="min-w-0 overflow-hidden opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
									<p className="truncate text-sm font-medium text-text-primary">{friend.displayName}</p>
									<p className="truncate text-xs text-text-secondary">@{friend.username}</p>
								</div>
							</button>
						))}
						{extraSidebarFriendCount > 0 && (
							<div className="px-3 text-xs text-text-muted opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
								還有 {extraSidebarFriendCount} 位好友
							</div>
						)}
						{friends.length === 0 && (
							<div className="px-3 text-xs text-text-muted opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
								目前尚無好友
							</div>
						)}
					</div>
				</div>

				<div className="mt-auto border-t border-border pt-4">
					<div className="flex items-center gap-3 rounded-2xl bg-border-subtle/60 px-3 py-3">
						<Avatar name={user.displayName} avatarUrl={user.avatarUrl} size="sm" />
						<div className="min-w-0 overflow-hidden opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
							<p className="truncate text-sm font-medium text-text-primary">{user.displayName}</p>
							<p className="truncate text-xs text-text-secondary">@{user.username}</p>
						</div>
						<button
							type="button"
							className="ml-auto flex size-9 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-destructive-subtle hover:text-destructive opacity-0 duration-200 group-hover/sidebar:opacity-100"
							onClick={() => {
								void handleLogout();
							}}
							aria-label="登出"
						>
							<LogOut className="size-4" />
						</button>
					</div>
				</div>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				<header className="border-b border-border bg-surface/80 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
					<div className="mx-auto flex max-w-7xl flex-col gap-4">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<div className="min-w-0">
								<p className="text-xs font-medium uppercase tracking-[0.28em] text-text-muted">Authenticated workspace</p>
								<h1 className="mt-2 text-2xl font-semibold text-text-primary">
									{user.displayName}，歡迎回來
								</h1>
								<p className="mt-1 text-sm text-text-secondary">
									從好友、私訊與群組之間快速切換，管理你的社交工作區。
								</p>
								<p className="mt-3 inline-flex rounded-full bg-action-subtle px-3 py-1 text-xs font-medium text-action">
									目前視圖：{activeViewLabel}
								</p>
							</div>

							<div className="flex flex-wrap gap-2">
								{renderTab('friends', totalFriendCount)}
								{renderTab('directs', totalDirectCount)}
								{renderTab('groups', totalGroupCount)}
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-3">
							<SummaryCard
								label="好友"
								value={totalFriendCount}
								description="已加入的朋友數量"
								icon={<UsersRound className="size-5" />}
							/>
							<SummaryCard
								label="私訊"
								value={totalDirectCount}
								description="已建立的直接聊天室"
								icon={<MessagesSquare className="size-5" />}
							/>
							<SummaryCard
								label="群組"
								value={totalGroupCount}
								description="正在參與的群組聊天室"
								icon={<LayoutGrid className="size-5" />}
							/>
						</div>
					</div>
				</header>

				<main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
					<div className="mx-auto flex max-w-7xl flex-col gap-6">
						{workspaceError && (
							<div className="rounded-2xl border border-destructive/30 bg-destructive-subtle px-4 py-3 text-sm text-destructive">
								<div className="flex items-center justify-between gap-4">
									<p>{workspaceError}</p>
									<Button type="button" variant="ghost" size="sm" onClick={() => void loadWorkspace()}>
										重試
									</Button>
								</div>
							</div>
						)}

						{workspaceState === 'loading' ? (
							<WorkspaceSkeleton />
						) : activeView === 'friends' ? (
							renderFriendsPanel()
						) : (
							renderChatsPanel(activeView)
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
