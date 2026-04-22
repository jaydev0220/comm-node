import type { Chat } from '@/lib/api-types';
import { GridAvatarStack } from '@/components/grid-avatar-stack';

interface GroupCardProps {
	group: Chat;
	onClick: () => void;
}

const getGroupName = (group: Chat): string => {
	const trimmedName = group.name?.trim();
	return trimmedName && trimmedName.length > 0 ? trimmedName : '未命名群組';
};

export function GroupCard({ group, onClick }: GroupCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="border-border bg-surface hover:bg-surface-raised mx-auto flex aspect-4/5 w-[88%] cursor-pointer flex-col overflow-hidden rounded-2xl border text-left transition-colors"
		>
			<div className="flex min-h-0 grow items-center justify-center px-3 py-3">
				<GridAvatarStack participants={group.participants} size="md" className="place-items-center" />
			</div>
			<div className="border-border bg-surface-raised flex shrink-0 flex-col border-t px-3 py-2">
				<p className="text-text-primary truncate text-sm font-semibold">{getGroupName(group)}</p>
				<p className="text-text-muted text-xs">{group.participants.length} 位成員</p>
			</div>
		</button>
	);
}
