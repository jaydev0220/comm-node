'use client';

import { Copy, EllipsisVertical, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

export type MessageDeleteScope = 'none' | 'sender' | 'group-owner';

export interface MessageActionState {
	canEdit: boolean;
	deleteScope: MessageDeleteScope;
}

interface MessageActionsMenuProps {
	state: MessageActionState;
	isOpen: boolean;
	onToggle: () => void;
	onClose: () => void;
	onCopy: () => void | Promise<void>;
	onEdit: () => void;
	onDelete: () => void;
	copyDisabled?: boolean;
	editDisabled?: boolean;
	deleteDisabled?: boolean;
}

export function MessageActionsMenu({
	state,
	isOpen,
	onToggle,
	onClose,
	onCopy,
	onEdit,
	onDelete,
	copyDisabled = false,
	editDisabled = false,
	deleteDisabled = false
}: MessageActionsMenuProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const canDelete = state.deleteScope !== 'none';

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
				onClose();
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen, onClose]);

	return (
		<div
			className="pointer-events-none relative shrink-0 self-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
			ref={containerRef}
		>
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={isOpen}
				aria-label="訊息操作選單"
				className="hover:bg-surface-raised focus-visible:ring-border cursor-pointer rounded-full p-1.5 transition-all duration-200 ease-out hover:scale-105 focus-visible:ring-2 focus-visible:outline-none"
				onClick={onToggle}
			>
				<EllipsisVertical className="text-text-muted size-4" />
			</button>
			{isOpen ? (
				<div
					role="menu"
					aria-label="訊息操作"
					className="border-border bg-surface absolute top-full right-0 z-10 mt-2 flex w-40 flex-col gap-1 rounded-xl border p-1 shadow-lg"
				>
					<button
						type="button"
						role="menuitem"
						disabled={copyDisabled}
						className="hover:bg-surface-raised focus-visible:ring-border flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
						onClick={() => {
							void onCopy();
							onClose();
						}}
					>
						<Copy className="size-4" />
						<span>複製訊息</span>
					</button>
					{state.canEdit ? (
						<button
							type="button"
							role="menuitem"
							disabled={editDisabled}
							className="hover:bg-surface-raised focus-visible:ring-border flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => {
								onEdit();
								onClose();
							}}
						>
							<Pencil className="size-4" />
							<span>編輯訊息</span>
						</button>
					) : null}
					{canDelete ? (
						<button
							type="button"
							role="menuitem"
							disabled={deleteDisabled}
							aria-label={
								state.deleteScope === 'group-owner' ? '移除訊息（群組擁有者權限）' : '移除訊息'
							}
							className="focus-visible:ring-border flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors duration-200 ease-out hover:bg-red-500/10 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => {
								onDelete();
								onClose();
							}}
						>
							<Trash2 className="size-4" />
							<span>移除訊息</span>
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
