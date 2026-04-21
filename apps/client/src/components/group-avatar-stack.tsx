import { UserPlus } from 'lucide-react';
import Avatar from '@/components/avatar';
import type { ChatParticipant } from '@/lib/api-types';

interface GroupAvatarStackProps {
	participants: ChatParticipant[];
	size?: 'sm' | 'md' | 'lg';
	maxVisible?: number;
	className?: string;
}

const MAX_VISIBLE_AVATARS = 4;

const overflowContainerBySize: Record<'sm' | 'md' | 'lg', string> = {
	sm: 'size-8',
	md: 'size-10',
	lg: 'size-12'
};

const overflowIconBySize: Record<'sm' | 'md' | 'lg', string> = {
	sm: 'size-3.5',
	md: 'size-4',
	lg: 'size-5'
};

export function GroupAvatarStack({
	participants,
	size = 'sm',
	maxVisible = MAX_VISIBLE_AVATARS,
	className = ''
}: GroupAvatarStackProps) {
	const hasOverflow = participants.length > maxVisible;
	const visibleParticipants = hasOverflow
		? participants.slice(0, Math.max(0, maxVisible - 1))
		: participants.slice(0, maxVisible);

	return (
		<div className={`flex items-center ${className}`}>
			{visibleParticipants.map((participant) => (
				<div key={participant.user.id} className="-ml-2 first:ml-0">
					<Avatar
						name={participant.user.displayName}
						avatarUrl={participant.user.avatarUrl}
						size={size}
					/>
				</div>
			))}
			{hasOverflow ? (
				<div
					className={`border-border bg-surface-raised text-text-muted -ml-2 flex items-center justify-center rounded-full border ${overflowContainerBySize[size]}`}
				>
					<UserPlus className={`${overflowIconBySize[size]} grayscale`} />
				</div>
			) : null}
		</div>
	);
}
