'use client';

import {
	CircleAlert,
	CircleCheck,
	CircleX,
	Search,
	X,
	type LucideIcon
} from 'lucide-react';
import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type FormEvent
} from 'react';
import Avatar from '@/components/avatar';
import { Button, Input, Separator } from '@/components/ui';
import { api } from '@/lib/api';
import type { Chat, FriendWithPresence } from '@/lib/api-types';

interface CreateGroupModalProps {
	isOpen: boolean;
	friends: FriendWithPresence[];
	existingGroups: Chat[];
	onClose: () => void;
	onCreated: (group: Chat) => void;
}

type NameValidationState = 'empty' | 'too-long' | 'duplicate' | 'valid';

interface ValidationMeta {
	state: NameValidationState;
	icon: LucideIcon;
	iconClassName: string;
	helperText: string;
}

const GROUP_NAME_MAX_LENGTH = 100;

const getErrorMessage = (error: unknown): string => {
	if (typeof error === 'object' && error && 'message' in error) {
		const message = (error as { message?: unknown }).message;

		if (typeof message === 'string' && message.length > 0) {
			return message;
		}
	}

	return '建立群組失敗，請稍後再試';
};

const normalizeGroupName = (name: string): string => name.trim().toLowerCase();

const resolveNameValidationState = (name: string, existingGroups: Chat[]): NameValidationState => {
	const trimmedName = name.trim();

	if (!trimmedName) {
		return 'empty';
	}

	if (trimmedName.length > GROUP_NAME_MAX_LENGTH) {
		return 'too-long';
	}

	const normalizedName = normalizeGroupName(trimmedName);
	const hasDuplicate = existingGroups.some(
		(group) => normalizeGroupName(group.name ?? '') === normalizedName
	);

	if (hasDuplicate) {
		return 'duplicate';
	}

	return 'valid';
};

const validationMetaMap: Record<NameValidationState, ValidationMeta> = {
	empty: {
		state: 'empty',
		icon: CircleX,
		iconClassName: 'text-red-400',
		helperText: '群組名稱不可為空'
	},
	'too-long': {
		state: 'too-long',
		icon: CircleX,
		iconClassName: 'text-red-400',
		helperText: `群組名稱不可超過 ${GROUP_NAME_MAX_LENGTH} 字元`
	},
	duplicate: {
		state: 'duplicate',
		icon: CircleAlert,
		iconClassName: 'text-amber-500',
		helperText: '已存在同名群組，仍可建立'
	},
	valid: {
		state: 'valid',
		icon: CircleCheck,
		iconClassName: 'text-green-500',
		helperText: '群組名稱可用'
	}
};

export function CreateGroupModal({
	isOpen,
	friends,
	existingGroups,
	onClose,
	onCreated
}: CreateGroupModalProps) {
	const [groupName, setGroupName] = useState('');
	const [friendSearchInput, setFriendSearchInput] = useState('');
	const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const resetForm = useCallback(() => {
		setGroupName('');
		setFriendSearchInput('');
		setSelectedFriendIds(new Set());
		setSubmitError(null);
		setIsSubmitting(false);
	}, []);

	const handleClose = useCallback(() => {
		if (isSubmitting) {
			return;
		}

		resetForm();
		onClose();
	}, [isSubmitting, onClose, resetForm]);

	useEffect(() => {
		if (isOpen) {
			return;
		}

		resetForm();
	}, [isOpen, resetForm]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				handleClose();
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
	}, [handleClose, isOpen]);

	const nameValidation = useMemo<NameValidationState>(
		() => resolveNameValidationState(groupName, existingGroups),
		[existingGroups, groupName]
	);

	const validationMeta = validationMetaMap[nameValidation];

	const filteredFriends = useMemo(() => {
		const normalizedQuery = friendSearchInput.trim().toLowerCase();

		if (!normalizedQuery) {
			return friends;
		}

		return friends.filter(
			(friend) =>
				friend.displayName.toLowerCase().includes(normalizedQuery) ||
				friend.username.toLowerCase().includes(normalizedQuery)
		);
	}, [friendSearchInput, friends]);

	const canSubmitName = nameValidation === 'valid' || nameValidation === 'duplicate';
	const canSubmit = canSubmitName && selectedFriendIds.size > 0 && !isSubmitting;

	const toggleFriendSelection = (friendId: string) => {
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

	const handleCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!canSubmit) {
			return;
		}

		setIsSubmitting(true);
		setSubmitError(null);

		try {
			const createdGroup = await api.post<Chat>('/chats', {
				type: 'GROUP',
				name: groupName.trim(),
				memberIds: Array.from(selectedFriendIds)
			});

			onCreated(createdGroup);
			resetForm();
			onClose();
		} catch (error) {
			setSubmitError(getErrorMessage(error));
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen) {
		return null;
	}

	const ValidationIcon = validationMeta.icon;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				aria-label="關閉建立群組視窗"
				onClick={handleClose}
				className="absolute inset-0 bg-black/45"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="建立群組"
				className="border-border bg-surface relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border p-4 shadow-2xl"
			>
				<div className="mb-2 flex items-center justify-between gap-2">
					<h2 className="text-text-primary text-lg font-semibold">建立群組</h2>
					<button
						type="button"
						onClick={handleClose}
						aria-label="關閉"
						className="text-text-muted hover:bg-surface-raised rounded-md p-1 transition-colors"
					>
						<X className="size-5" />
					</button>
				</div>

				<form className="flex min-h-0 grow flex-col" onSubmit={handleCreateGroup}>
					<div className="mb-2">
						<label htmlFor="group-name" className="mb-1 block text-sm font-medium">
							群組名稱
						</label>
						<div className="relative">
							<Input
								id="group-name"
								type="text"
								value={groupName}
								onChange={(event) => setGroupName(event.target.value)}
								placeholder="輸入群組名稱"
								maxLength={140}
								className="pr-10"
							/>
							<span
								aria-hidden="true"
								className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 ${validationMeta.iconClassName}`}
							>
								<ValidationIcon className="size-5" />
							</span>
						</div>
						<p className={`mt-1 text-xs ${validationMeta.iconClassName}`} aria-live="polite">
							{validationMeta.helperText}
						</p>
					</div>

					<Separator />

					<div className="flex min-h-0 grow flex-col">
						<div className="mb-2 flex items-center justify-between">
							<h3 className="text-sm font-semibold">選擇好友</h3>
							<span className="text-text-muted text-xs">已選擇 {selectedFriendIds.size} 位</span>
						</div>
						<Input
							type="text"
							value={friendSearchInput}
							onChange={(event) => setFriendSearchInput(event.target.value)}
							placeholder="搜尋好友"
							icon={<Search className="size-4" />}
						/>
						<div className="invisible-scroll-y border-border bg-background mt-2 max-h-72 min-h-40 rounded-lg border p-2">
							{filteredFriends.length === 0 ? (
								<p className="text-text-muted py-6 text-center text-sm">找不到符合條件的好友</p>
							) : (
								<div className="flex flex-col gap-1">
									{filteredFriends.map((friend) => {
										const isSelected = selectedFriendIds.has(friend.id);

										return (
											<button
												key={friend.id}
												type="button"
												onClick={() => toggleFriendSelection(friend.id)}
												className={`hover:bg-surface-raised flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
													isSelected ? 'bg-action-subtle' : ''
												}`}
											>
												<Avatar
													name={friend.displayName}
													avatarUrl={friend.avatarUrl}
													size="sm"
												/>
												<div className="min-w-0 grow">
													<p className="truncate text-sm font-medium">{friend.displayName}</p>
													<p className="text-text-muted truncate text-xs">@{friend.username}</p>
												</div>
												<span
													className={`border-border flex size-5 shrink-0 items-center justify-center rounded-full border ${
														isSelected ? 'border-action bg-action text-action-fg' : ''
													}`}
												>
													{isSelected ? <CircleCheck className="size-3" /> : null}
												</span>
											</button>
										);
									})}
								</div>
							)}
						</div>
					</div>

					{submitError ? (
						<p className="mt-2 text-sm text-red-400" aria-live="polite">
							{submitError}
						</p>
					) : null}

					<div className="mt-4 flex justify-end gap-2">
						<Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
							取消
						</Button>
						<Button type="submit" loading={isSubmitting} disabled={!canSubmit}>
							建立群組
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
