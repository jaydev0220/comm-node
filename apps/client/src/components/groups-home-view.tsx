'use client';

import { Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GroupsGrid } from '@/components/groups-grid';
import { CreateGroupModal } from '@/components/modals/create-group-modal';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';
import type { Chat, CursorPage, FriendWithPresence } from '@/lib/api-types';

interface GroupsHomeViewProps {
	friends: FriendWithPresence[];
	onOpenGroup: (groupId: string) => void;
}

interface ChatsResponse {
	data: Chat[];
	pagination: CursorPage;
}

const GROUP_PAGE_LIMIT = 50;

const getErrorMessage = (error: unknown): string => {
	if (typeof error === 'object' && error && 'message' in error) {
		const message = (error as { message?: unknown }).message;

		if (typeof message === 'string' && message.length > 0) {
			return message;
		}
	}

	return '載入群組失敗，請稍後再試';
};

const sortGroupsByUpdatedAt = (groups: Chat[]): Chat[] =>
	[...groups].sort((firstGroup, secondGroup) => {
		const firstGroupTime = new Date(firstGroup.updatedAt).getTime();
		const secondGroupTime = new Date(secondGroup.updatedAt).getTime();

		if (Number.isNaN(firstGroupTime) || Number.isNaN(secondGroupTime)) {
			return 0;
		}

		return secondGroupTime - firstGroupTime;
	});

export function GroupsHomeView({ friends, onOpenGroup }: GroupsHomeViewProps) {
	const [groups, setGroups] = useState<Chat[]>([]);
	const [groupSearchInput, setGroupSearchInput] = useState('');
	const [isLoadingGroups, setIsLoadingGroups] = useState(true);
	const [groupsError, setGroupsError] = useState<string | null>(null);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

	const loadGroups = useCallback(async () => {
		setIsLoadingGroups(true);
		setGroupsError(null);

		try {
			const loadedGroups: Chat[] = [];
			let nextCursor: string | undefined;

			while (true) {
				const searchParams = new URLSearchParams({
					limit: String(GROUP_PAGE_LIMIT)
				});

				if (nextCursor) {
					searchParams.set('cursor', nextCursor);
				}

				const response = await api.get<ChatsResponse>(`/chats?${searchParams.toString()}`);
				loadedGroups.push(...response.data.filter((chat) => chat.type === 'GROUP'));

				if (!response.pagination.hasMore || !response.pagination.nextCursor) {
					break;
				}

				nextCursor = response.pagination.nextCursor;
			}

			setGroups(sortGroupsByUpdatedAt(loadedGroups));
		} catch (error) {
			setGroupsError(getErrorMessage(error));
		} finally {
			setIsLoadingGroups(false);
		}
	}, []);

	useEffect(() => {
		void loadGroups();
	}, [loadGroups]);

	const filteredGroups = useMemo(() => {
		const normalizedSearchInput = groupSearchInput.trim().toLowerCase();

		if (!normalizedSearchInput) {
			return groups;
		}

		return groups.filter((group) => (group.name ?? '').toLowerCase().includes(normalizedSearchInput));
	}, [groupSearchInput, groups]);

	const handleGroupCreated = useCallback((createdGroup: Chat) => {
		if (createdGroup.type !== 'GROUP') {
			return;
		}

		setGroups((currentGroups) =>
			sortGroupsByUpdatedAt([
				createdGroup,
				...currentGroups.filter((currentGroup) => currentGroup.id !== createdGroup.id)
			])
		);
	}, []);

	return (
		<div className="flex h-full w-full flex-col overflow-hidden px-8 py-6 md:px-10 md:py-8">
			<div className="mb-3 flex items-center gap-2">
				<div className="grow">
					<Input
						type="text"
						value={groupSearchInput}
						onChange={(event) => setGroupSearchInput(event.target.value)}
						placeholder="搜尋群組"
						icon={<Search className="size-4" />}
					/>
				</div>
				<Button type="button" icon={<Plus className="size-4" />} onClick={() => setIsCreateModalOpen(true)}>
					建立群組
				</Button>
			</div>

			{groupsError ? (
				<p className="mb-2 text-sm text-red-400" aria-live="polite">
					{groupsError}
				</p>
			) : null}

			<div className="invisible-scroll-y min-h-0 grow">
				{isLoadingGroups ? (
					<p className="text-text-muted py-8 text-center text-sm">載入群組中…</p>
				) : (
					<>
						{filteredGroups.length === 0 ? (
							<p className="text-text-muted mb-3 text-sm">尚未加入任何群組，先建立一個吧。</p>
						) : null}
						<GroupsGrid
							groups={filteredGroups}
							onOpenGroup={onOpenGroup}
							onCreateGroup={() => setIsCreateModalOpen(true)}
						/>
					</>
				)}
			</div>

			<CreateGroupModal
				isOpen={isCreateModalOpen}
				friends={friends}
				existingGroups={groups}
				onClose={() => setIsCreateModalOpen(false)}
				onCreated={handleGroupCreated}
			/>
		</div>
	);
}
