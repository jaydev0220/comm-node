'use client';

import { type ReactNode } from 'react';

interface FormFieldProps {
	label: string;
	htmlFor: string;
	error?: string;
	description?: string;
	required?: boolean;
	children: ReactNode;
}

export function FormField({
	label,
	htmlFor,
	error,
	description,
	required,
	children
}: FormFieldProps) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={htmlFor} className="text-sm font-medium text-text-primary">
				{label}
				{required && <span className="text-destructive ml-0.5">*</span>}
			</label>
			{children}
			{description && !error && <p className="text-xs text-text-muted">{description}</p>}
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}
