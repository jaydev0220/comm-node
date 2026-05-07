'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Avatar from '@/components/avatar';
import { Button, Input, Separator } from '@/components/ui';
import type { Chat, FriendWithPresence } from '@/lib/api-types';

interface AddGroupUsersModalProps {
	isOpen: boolean;
	group: Chat | null;
	friends: FriendWithPresence[];
	isSubmitting: boolean;
	submitError: string | null;
	onClose: () => void;
	onSubmit: (groupId: string, userIds: string[]) => void | Promise<void>;
}

const getGroupName = (group: Chat): string => {
	const trimmedName = group.name?.trim();
	return trimmedName && trimmedName.length > 0 ? trimmedName : '未命名群組';
};

export function AddGroupUsersModal({
	isOpen,
	group,
	friends,
	isSubmitting,
	submitError,
	onClose,
	onSubmit
}: AddGroupUsersModalProps) {
	const [searchInput, setSearchInput] = useState('');
	const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !isSubmitting) {
				onClose();
			}
		};

		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen, isSubmitting, onClose]);

	const eligibleFriends = useMemo(() => {
		if (!group) {
			return [];
		}

		const participantIds = new Set(group.participants.map((participant) => participant.user.id));
		const normalizedSearch = searchInput.trim().toLowerCase();

		return friends.filter((friend) => {
			if (participantIds.has(friend.id)) {
				return false;
			}

			if (!normalizedSearch) {
				return true;
			}

			return (
				friend.displayName.toLowerCase().includes(normalizedSearch) ||
				friend.username.toLowerCase().includes(normalizedSearch)
			);
		});
	}, [friends, group, searchInput]);

	const toggleSelection = (friendId: string) => {
		setSelectedFriendIds((currentSelectedFriendIds) => {
			const nextSelectedFriendIds = new Set(currentSelectedFriendIds);

			if (nextSelectedFriendIds.has(friendId)) {
				nextSelectedFriendIds.delete(friendId);
			} else {
				nextSelectedFriendIds.add(friendId);
			}

			return nextSelectedFriendIds;
		});
	};

	if (!isOpen || !group) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				aria-label="關閉加入群組成員視窗"
				onClick={() => {
					if (!isSubmitting) {
						onClose();
					}
				}}
				className="absolute inset-0 bg-black/45"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="加入群組成員"
				className="border-border bg-surface relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border p-4 shadow-2xl"
			>
				<div className="mb-2 flex items-center justify-between gap-3">
					<div className="min-w-0">
						<h2 className="text-text-primary text-lg font-semibold">Add User</h2>
						<p className="text-text-muted truncate text-sm">{getGroupName(group)}</p>
					</div>
					<button
						type="button"
						onClick={() => {
							if (!isSubmitting) {
								onClose();
							}
						}}
						aria-label="關閉"
						className="text-text-muted hover:bg-surface-raised rounded-md p-1 transition-colors"
					>
						<X className="size-5" />
					</button>
				</div>

				<Separator />

				<div className="mt-3 flex min-h-0 grow flex-col">
					<div className="mb-2 flex items-center justify-between gap-2">
						<h3 className="text-sm font-semibold">選擇好友</h3>
						<span className="text-text-muted text-xs">已選擇 {selectedFriendIds.size} 位</span>
					</div>
					<Input
						type="text"
						value={searchInput}
						onChange={(event) => setSearchInput(event.target.value)}
						placeholder="搜尋好友"
						icon={<Search className="size-4" />}
					/>
					<div className="invisible-scroll-y border-border bg-background mt-2 min-h-40 grow rounded-lg border p-2">
						{eligibleFriends.length === 0 ? (
							<p className="text-text-muted py-6 text-center text-sm">沒有可加入的好友</p>
						) : (
							<div className="flex flex-col gap-1">
								{eligibleFriends.map((friend) => {
									const isSelected = selectedFriendIds.has(friend.id);

									return (
										<button
											key={friend.id}
											type="button"
											onClick={() => toggleSelection(friend.id)}
											className={`hover:bg-surface-raised flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
												isSelected ? 'bg-action-subtle' : ''
											}`}
										>
											<Avatar name={friend.displayName} avatarUrl={friend.avatarUrl} size="sm" />
											<div className="min-w-0 grow">
												<p className="truncate text-sm font-medium">{friend.displayName}</p>
												<p className="text-text-muted truncate text-xs">@{friend.username}</p>
											</div>
										</button>
									);
								})}
							</div>
						)}
					</div>
					{submitError ? (
						<p className="mt-3 text-sm text-red-400" aria-live="polite">
							{submitError}
						</p>
					) : null}
				</div>

				<div className="mt-4 flex justify-end gap-2">
					<Button type="button" variant="ghost" disabled={isSubmitting} onClick={onClose}>
						取消
					</Button>
					<Button
						type="button"
						loading={isSubmitting}
						disabled={selectedFriendIds.size === 0}
						onClick={() => {
							void onSubmit(group.id, Array.from(selectedFriendIds));
						}}
					>
						加入群組
					</Button>
				</div>
			</div>
		</div>
	);
}
