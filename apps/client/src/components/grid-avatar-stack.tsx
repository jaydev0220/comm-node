import { UserPlus } from 'lucide-react';
import Avatar from '@/components/avatar';
import type { ChatParticipant } from '@/lib/api-types';

interface GridAvatarStackProps {
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

export function GridAvatarStack({
	participants,
	size = 'sm',
	maxVisible = MAX_VISIBLE_AVATARS,
	className = ''
}: GridAvatarStackProps) {
	const hasOverflow = participants.length > maxVisible;
	const visibleParticipants = hasOverflow
		? participants.slice(0, Math.max(0, maxVisible - 1))
		: participants.slice(0, maxVisible);

	return (
		<div className={`grid grid-cols-2 gap-1.5 ${className}`}>
			{visibleParticipants.map((participant) => (
				<div key={participant.user.id}>
					<Avatar
						name={participant.user.displayName}
						avatarUrl={participant.user.avatarUrl}
						size={size}
					/>
				</div>
			))}
			{hasOverflow ? (
				<div
					className={`border-border bg-surface-raised text-text-muted flex items-center justify-center rounded-full border ${overflowContainerBySize[size]}`}
				>
					<UserPlus className={`${overflowIconBySize[size]} grayscale`} />
				</div>
			) : null}
		</div>
	);
}
