import { GroupAvatarStack } from '@/components/group-avatar-stack';
import type { Chat } from '@/lib/api-types';

interface GroupChatTopBarProps {
	group: Chat;
}

const getGroupName = (group: Chat): string => {
	const trimmedName = group.name?.trim();
	return trimmedName && trimmedName.length > 0 ? trimmedName : '未命名群組';
};

export function GroupChatTopBar({ group }: GroupChatTopBarProps) {
	return (
		<header className="border-border bg-surface sticky top-0 z-10 flex items-center gap-3 border-b px-4 py-3">
			<GroupAvatarStack participants={group.participants} size="sm" />
			<p className="text-text-primary min-w-0 truncate text-sm font-semibold">{getGroupName(group)}</p>
		</header>
	);
}
