interface SeparatorProps {
	text?: string;
}

export function Separator({ text }: SeparatorProps) {
	return (
		<div className="relative flex items-center py-4">
			<div className="border-border grow border-t" />
			{text && <span className="text-text-muted mx-4 shrink text-sm">{text}</span>}
			<div className="border-border grow border-t" />
		</div>
	);
}
