'use client';

import { Check, Ellipsis, Loader2, MessageSquare, Plus, Search, X } from 'lucide-react';
import type { RefObject, SubmitEvent } from 'react';
import Avatar from '@/components/avatar';
import type { FriendWithPresence, Friendship } from '@/lib/api-types';
import { Button, FormField, Input, Separator } from '@/components/ui';

type FriendStatusFilter = 'all' | 'online' | 'offline';
type FriendAction = 'block' | 'remove';
type RequestAction = 'accept' | 'reject';

interface HomeViewProps {
	addFriendInput: string;
	addFriendError: string | null;
	addFriendSuccess: string | null;
	pendingRequests: Friendship[];
	pendingRequestError: string | null;
	requestActionState: {
		requestId: string;
		action: RequestAction;
	} | null;
	isSendingFriendRequest: boolean;
	friendStatusFilter: FriendStatusFilter;
	listError: string | null;
	filteredFriends: FriendWithPresence[];
	openFriendMenuId: string | null;
	friendActionState: {
		friendId: string;
		action: FriendAction;
	} | null;
	friendActionError: string | null;
	openMenuContainerRef: RefObject<HTMLDivElement | null>;
	onAddFriendInputChange: (value: string) => void;
	onSendFriendRequest: (event: SubmitEvent<HTMLFormElement>) => void;
	onRespondToRequest: (requestId: string, action: RequestAction) => void;
	onFriendSearchInputChange: (value: string) => void;
	onFriendStatusFilterChange: (value: FriendStatusFilter) => void;
	onOpenDm: (friendId: string) => void;
	onToggleFriendMenu: (friendId: string) => void;
	onFriendAction: (friendId: string, action: FriendAction) => void;
}

const FRIEND_STATUS_OPTIONS: {
	value: FriendStatusFilter;
	label: string;
}[] = [
	{ value: 'all', label: '全部' },
	{ value: 'online', label: '線上' },
	{ value: 'offline', label: '離線' }
];

export function HomeView({
	addFriendInput,
	addFriendError,
	addFriendSuccess,
	pendingRequests,
	pendingRequestError,
	requestActionState,
	isSendingFriendRequest,
	friendStatusFilter,
	listError,
	filteredFriends,
	openFriendMenuId,
	friendActionState,
	friendActionError,
	openMenuContainerRef,
	onAddFriendInputChange,
	onSendFriendRequest,
	onRespondToRequest,
	onFriendSearchInputChange,
	onFriendStatusFilterChange,
	onOpenDm,
	onToggleFriendMenu,
	onFriendAction
}: HomeViewProps) {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden px-12 py-8">
			{/* Add Friends Section */}
			<div className="flex w-full flex-col gap-2">
				<form className="flex w-full items-end gap-2 text-xl" onSubmit={onSendFriendRequest}>
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
								onChange={(event) => onAddFriendInputChange(event.target.value)}
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
										onClick={() => onRespondToRequest(request.id, 'accept')}
									>
										<Check size={14} />
										接受
									</Button>
									<Button
										size="sm"
										variant="outline"
										loading={isProcessing && requestActionState?.action === 'reject'}
										onClick={() => onRespondToRequest(request.id, 'reject')}
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

			{/* Friends List Section */}
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
							onChange={(event) => onFriendSearchInputChange(event.target.value)}
						/>
					</div>
					<select
						id="filter-status"
						aria-label="好友狀態篩選"
						value={friendStatusFilter}
						onChange={(event) =>
							onFriendStatusFilterChange(event.target.value as FriendStatusFilter)
						}
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
									onClick={() => onOpenDm(friend.id)}
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
										onClick={() => onToggleFriendMenu(friend.id)}
									>
										<Ellipsis size={20} />
									</button>
									{isMenuOpen ? (
										<div className="border-border bg-surface absolute top-full right-0 z-10 mt-2 flex w-36 flex-col gap-1 rounded-lg border p-1 shadow-lg">
											<button
												type="button"
												disabled={Boolean(isActionLoading)}
												className="hover:bg-surface-raised focus-visible:ring-border flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
												onClick={() => onFriendAction(friend.id, 'block')}
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
												onClick={() => onFriendAction(friend.id, 'remove')}
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
}
