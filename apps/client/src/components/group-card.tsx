import { GroupActionsMenu } from '@/components/group-actions-menu';
import { GridAvatarStack } from '@/components/grid-avatar-stack';
import type { Chat } from '@/lib/api-types';

interface GroupCardProps {
	group: Chat;
	currentUserId: string;
	hasUnread?: boolean;
	onClick: () => void;
	onAddUser: (group: Chat) => void;
	onLeaveGroup: (group: Chat) => void | Promise<void>;
	onDeleteGroup: (group: Chat) => void | Promise<void>;
}

const getGroupName = (group: Chat): string => {
	const trimmedName = group.name?.trim();
	return trimmedName && trimmedName.length > 0 ? trimmedName : '未命名群組';
};

export function GroupCard({
	group,
	currentUserId,
	hasUnread = false,
	onClick,
	onAddUser,
	onLeaveGroup,
	onDeleteGroup
}: GroupCardProps) {
	return (
		<div className="relative mx-auto aspect-4/5 w-[88%]">
			{hasUnread ? (
				<span
					aria-hidden="true"
					className="ring-surface absolute top-2 left-2 z-10 size-3 rounded-full bg-red-500 ring-2"
				/>
			) : null}
			<div className="absolute top-2 right-2 z-20">
				<GroupActionsMenu
					group={group}
					currentUserId={currentUserId}
					onAddUser={onAddUser}
					onLeaveGroup={onLeaveGroup}
					onDeleteGroup={onDeleteGroup}
					triggerClassName="bg-surface/90 backdrop-blur-sm"
				/>
			</div>
			<button
				type="button"
				onClick={onClick}
				className="border-border bg-surface hover:bg-surface-raised flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border text-left transition-colors"
			>
				<div className="flex min-h-0 grow items-center justify-center px-3 py-3">
					<GridAvatarStack
						participants={group.participants}
						size="md"
						className="place-items-center"
					/>
				</div>
				<div className="border-border bg-surface-raised flex shrink-0 flex-col border-t px-3 py-2">
					<p className="text-text-primary truncate text-sm font-semibold">{getGroupName(group)}</p>
					<p className="text-text-muted text-xs">{group.participants.length} 位成員</p>
				</div>
			</button>
		</div>
	);
}
