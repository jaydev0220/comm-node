'use client';

import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GroupsGrid } from '@/components/groups-grid';
import { CreateGroupModal } from '@/components/modals/create-group-modal';
import { Button, Input } from '@/components/ui';
import type { Chat, FriendWithPresence } from '@/lib/api-types';

interface GroupsHomeViewProps {
	currentUserId: string;
	friends: FriendWithPresence[];
	groups: Chat[];
	isLoadingGroups: boolean;
	groupsError: string | null;
	unreadGroupIds: ReadonlySet<string>;
	onOpenGroup: (groupId: string) => void;
	onGroupCreated: (group: Chat) => void;
	onOpenAddUserModal: (group: Chat) => void;
	onLeaveGroup: (group: Chat) => void | Promise<void>;
	onDeleteGroup: (group: Chat) => void | Promise<void>;
}

export function GroupsHomeView({
	currentUserId,
	friends,
	groups,
	isLoadingGroups,
	groupsError,
	unreadGroupIds,
	onOpenGroup,
	onGroupCreated,
	onOpenAddUserModal,
	onLeaveGroup,
	onDeleteGroup
}: GroupsHomeViewProps) {
	const [groupSearchInput, setGroupSearchInput] = useState('');
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [groupActionError, setGroupActionError] = useState<string | null>(null);
	const [activeGroupActionId, setActiveGroupActionId] = useState<string | null>(null);

	const filteredGroups = useMemo(() => {
		const normalizedSearchInput = groupSearchInput.trim().toLowerCase();

		if (!normalizedSearchInput) {
			return groups;
		}

		return groups.filter((group) =>
			(group.name ?? '').toLowerCase().includes(normalizedSearchInput)
		);
	}, [groupSearchInput, groups]);

	const handleOpenAddUserModal = (group: Chat) => {
		setGroupActionError(null);
		onOpenAddUserModal(group);
	};

	const handleLeaveGroup = async (group: Chat) => {
		if (activeGroupActionId) {
			return;
		}

		setActiveGroupActionId(group.id);
		setGroupActionError(null);

		try {
			await onLeaveGroup(group);
		} catch (error) {
			if (typeof error === 'object' && error && 'message' in error) {
				const message = (error as { message?: unknown }).message;

				setGroupActionError(
					typeof message === 'string' && message.length > 0
						? message
						: '離開群組失敗，請稍後再試'
				);
			} else {
				setGroupActionError('離開群組失敗，請稍後再試');
			}
		} finally {
			setActiveGroupActionId(null);
		}
	};

	const handleDeleteGroup = async (group: Chat) => {
		if (activeGroupActionId) {
			return;
		}

		setActiveGroupActionId(group.id);
		setGroupActionError(null);

		try {
			await onDeleteGroup(group);
		} catch (error) {
			if (typeof error === 'object' && error && 'message' in error) {
				const message = (error as { message?: unknown }).message;

				setGroupActionError(
					typeof message === 'string' && message.length > 0
						? message
						: '刪除群組失敗，請稍後再試'
				);
			} else {
				setGroupActionError('刪除群組失敗，請稍後再試');
			}
		} finally {
			setActiveGroupActionId(null);
		}
	};

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
				<Button
					type="button"
					icon={<Plus className="size-4" />}
					onClick={() => setIsCreateModalOpen(true)}
				>
					建立群組
				</Button>
			</div>

			{groupsError ? (
				<p className="mb-2 text-sm text-red-400" aria-live="polite">
					{groupsError}
				</p>
			) : null}
			{groupActionError ? (
				<p className="mb-2 text-sm text-red-400" aria-live="polite">
					{groupActionError}
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
							currentUserId={currentUserId}
							unreadGroupIds={unreadGroupIds}
							onOpenGroup={onOpenGroup}
							onCreateGroup={() => setIsCreateModalOpen(true)}
							onAddUser={handleOpenAddUserModal}
							onLeaveGroup={handleLeaveGroup}
							onDeleteGroup={handleDeleteGroup}
						/>
					</>
				)}
			</div>

			<CreateGroupModal
				isOpen={isCreateModalOpen}
				friends={friends}
				existingGroups={groups}
				onClose={() => setIsCreateModalOpen(false)}
				onCreated={onGroupCreated}
			/>
		</div>
	);
}
