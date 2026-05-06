import { Plus } from 'lucide-react';
import type { Chat } from '@/lib/api-types';
import { GroupCard } from '@/components/group-card';

interface GroupsGridProps {
	groups: Chat[];
	currentUserId: string;
	unreadGroupIds: ReadonlySet<string>;
	onOpenGroup: (groupId: string) => void;
	onCreateGroup: () => void;
	onAddUser: (group: Chat) => void;
	onLeaveGroup: (group: Chat) => void | Promise<void>;
	onDeleteGroup: (group: Chat) => void | Promise<void>;
}

export function GroupsGrid({
	groups,
	currentUserId,
	unreadGroupIds,
	onOpenGroup,
	onCreateGroup,
	onAddUser,
	onLeaveGroup,
	onDeleteGroup
}: GroupsGridProps) {
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{groups.map((group) => (
				<GroupCard
					key={group.id}
					group={group}
					currentUserId={currentUserId}
					hasUnread={unreadGroupIds.has(group.id)}
					onClick={() => onOpenGroup(group.id)}
					onAddUser={onAddUser}
					onLeaveGroup={onLeaveGroup}
					onDeleteGroup={onDeleteGroup}
				/>
			))}
			<button
				type="button"
				onClick={onCreateGroup}
				className="border-border text-text-muted bg-surface hover:bg-surface-raised mx-auto flex aspect-4/5 w-[88%] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed transition-colors"
			>
				<Plus className="mb-2 size-6" />
				<span className="text-sm font-medium">建立群組</span>
			</button>
		</div>
	);
}
