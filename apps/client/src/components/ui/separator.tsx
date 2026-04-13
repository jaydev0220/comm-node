interface SeparatorProps {
	text?: string;
}

export function Separator({ text }: SeparatorProps) {
	return (
		<div className="relative flex items-center py-4">
			<div className="grow border-t border-border" />
			{text && <span className="mx-4 shrink text-sm text-text-muted">{text}</span>}
			<div className="grow border-t border-border" />
		</div>
	);
}
