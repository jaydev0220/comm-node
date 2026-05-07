'use client';

import { EllipsisVertical } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chat } from '@/lib/api-types';

interface GroupActionsMenuProps {
	group: Chat;
	currentUserId: string;
	onAddUser: (group: Chat) => void;
	onLeaveGroup: (group: Chat) => void | Promise<void>;
	onDeleteGroup: (group: Chat) => void | Promise<void>;
	triggerClassName?: string;
	menuClassName?: string;
	buttonAriaLabel?: string;
	disabled?: boolean;
}

const getCurrentUserRole = (
	group: Chat,
	currentUserId: string
): 'OWNER' | 'ADMIN' | 'MEMBER' | null =>
	group.participants.find((participant) => participant.user.id === currentUserId)?.role ?? null;

export function GroupActionsMenu({
	group,
	currentUserId,
	onAddUser,
	onLeaveGroup,
	onDeleteGroup,
	triggerClassName = '',
	menuClassName = '',
	buttonAriaLabel = '開啟群組操作選單',
	disabled = false
}: GroupActionsMenuProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const currentUserRole = useMemo(
		() => getCurrentUserRole(group, currentUserId),
		[currentUserId, group]
	);
	const canAddUser = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
	const canLeaveGroup = currentUserRole === 'ADMIN' || currentUserRole === 'MEMBER';
	const canDeleteGroup = currentUserRole === 'OWNER';

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			if (
				event.target instanceof Node &&
				containerRef.current &&
				!containerRef.current.contains(event.target)
			) {
				setIsOpen(false);
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen]);

	if (!canAddUser && !canLeaveGroup && !canDeleteGroup) {
		return null;
	}

	return (
		<div
			ref={containerRef}
			className="relative"
			onClick={(event) => {
				event.stopPropagation();
			}}
		>
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={isOpen}
				aria-label={buttonAriaLabel}
				disabled={disabled}
				className={`text-text-muted hover:bg-surface-raised focus-visible:ring-border cursor-pointer rounded-full p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${triggerClassName}`}
				onClick={() => setIsOpen((currentIsOpen) => !currentIsOpen)}
			>
				<EllipsisVertical className="size-4" />
			</button>
			{isOpen ? (
				<div
					role="menu"
					aria-label="群組操作"
					className={`border-border bg-surface absolute top-full right-0 z-20 mt-2 flex w-36 flex-col gap-1 rounded-xl border p-1 shadow-lg ${menuClassName}`}
				>
					{canAddUser ? (
						<button
							type="button"
							role="menuitem"
							disabled={disabled}
							className="hover:bg-surface-raised focus-visible:ring-border cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => {
								onAddUser(group);
								setIsOpen(false);
							}}
						>
							Add User
						</button>
					) : null}
					{canLeaveGroup ? (
						<button
							type="button"
							role="menuitem"
							disabled={disabled}
							className="hover:bg-surface-raised focus-visible:ring-border cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => {
								void onLeaveGroup(group);
								setIsOpen(false);
							}}
						>
							Leave Group
						</button>
					) : null}
					{canDeleteGroup ? (
						<button
							type="button"
							role="menuitem"
							disabled={disabled}
							className="cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => {
								void onDeleteGroup(group);
								setIsOpen(false);
							}}
						>
							Delete Group
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
