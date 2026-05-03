'use client';

import { LogOut, Settings } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import Avatar from '@/components/avatar';

interface AccountActionsMenuProps {
	displayName: string;
	avatarUrl?: string;
	isLogoutPending: boolean;
	onOpenSettings: () => void;
	onLogout: () => void | Promise<void>;
}

export function AccountActionsMenu({
	displayName,
	avatarUrl,
	isLogoutPending,
	onOpenSettings,
	onLogout
}: AccountActionsMenuProps) {
	const menuId = useId();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [isOpen, setIsOpen] = useState(false);

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

	return (
		<div className="relative" ref={containerRef}>
			<button
				type="button"
				aria-controls={isOpen ? menuId : undefined}
				aria-expanded={isOpen}
				aria-haspopup="menu"
				aria-label="開啟帳號操作選單"
				className="focus-visible:ring-border rounded-full focus-visible:ring-2 focus-visible:outline-none"
				onClick={() => setIsOpen((currentIsOpen) => !currentIsOpen)}
			>
				<Avatar name={displayName} avatarUrl={avatarUrl} size="lg" />
			</button>
			{isOpen ? (
				<div
					id={menuId}
					role="menu"
					aria-label="帳號操作"
					className="border-border bg-surface absolute bottom-0 left-full z-50 ml-3 flex w-40 flex-col gap-1 rounded-xl border p-1 shadow-lg"
				>
					<button
						type="button"
						role="menuitem"
						className="hover:bg-surface-raised focus-visible:ring-border flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:outline-none"
						onClick={() => {
							onOpenSettings();
							setIsOpen(false);
						}}
					>
						<Settings className="size-4" />
						<span>設定</span>
					</button>
					<button
						type="button"
						role="menuitem"
						disabled={isLogoutPending}
						className="focus-visible:ring-border flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors duration-200 ease-out hover:bg-red-500/10 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
						onClick={() => {
							void onLogout();
							setIsOpen(false);
						}}
					>
						<LogOut className="size-4" />
						<span>登出</span>
					</button>
				</div>
			) : null}
		</div>
	);
}
