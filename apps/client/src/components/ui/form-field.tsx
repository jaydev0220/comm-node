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
			<label htmlFor={htmlFor} className="text-text-primary text-sm font-medium">
				{label}
				{required && <span className="text-destructive ml-0.5">*</span>}
			</label>
			{children}
			{description && !error && <p className="text-text-muted text-xs">{description}</p>}
			{error && <p className="text-destructive text-xs">{error}</p>}
		</div>
	);
}
