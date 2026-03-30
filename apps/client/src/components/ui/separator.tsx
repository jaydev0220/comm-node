interface SeparatorProps {
	text?: string;
}

export function Separator({ text }: SeparatorProps) {
	return (
		<div className="relative flex items-center py-4">
			<div className="flex-grow border-t border-border" />
			{text && <span className="mx-4 flex-shrink text-sm text-text-muted">{text}</span>}
			<div className="flex-grow border-t border-border" />
		</div>
	);
}
