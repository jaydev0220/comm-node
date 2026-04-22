import { getAssetUrl } from '@/lib/api';
import Image from 'next/image';
import { useMemo, useState } from 'react';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
	name: string;
	avatarUrl?: string;
	size: AvatarSize;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
	sm: 'size-8 text-sm',
	md: 'size-10',
	lg: 'size-12 text-lg',
	xl: 'size-28 text-3xl'
};

const getInitials = (name: string): string => {
	const trimmedName = name.trim();

	if (!trimmedName) {
		return '?';
	}

	const words = trimmedName.split(/\s+/).filter(Boolean);
	const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '');

	return initials.join('').slice(0, 2) || trimmedName[0]?.toUpperCase() || '?';
};

export default function Avatar({ name, avatarUrl, size }: AvatarProps) {
	const [hasImageError, setHasImageError] = useState(false);
	const resolvedAvatarUrl = getAssetUrl(avatarUrl) ?? '';
	const initials = useMemo(() => getInitials(name), [name]);
	const shouldRenderImage = Boolean(resolvedAvatarUrl && !hasImageError);

	return (
		<div
			className={`border-border bg-surface hover:bg-surface-raised flex cursor-pointer items-center justify-center overflow-hidden rounded-full border ${SIZE_CLASSES[size]}`}
		>
			{shouldRenderImage ? (
				<Image
					src={resolvedAvatarUrl}
					alt={name}
					onError={() => setHasImageError(true)}
					width={48}
					height={48}
					className="size-full object-cover"
				/>
			) : (
				<span className="text-center select-none" aria-hidden={true}>
					{initials}
				</span>
			)}
		</div>
	);
}
