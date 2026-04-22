import { Plus } from 'lucide-react';
import type { Chat } from '@/lib/api-types';
import { GroupCard } from '@/components/group-card';

interface GroupsGridProps {
	groups: Chat[];
	onOpenGroup: (groupId: string) => void;
	onCreateGroup: () => void;
}

export function GroupsGrid({ groups, onOpenGroup, onCreateGroup }: GroupsGridProps) {
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{groups.map((group) => (
				<GroupCard key={group.id} group={group} onClick={() => onOpenGroup(group.id)} />
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
