'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	error?: boolean;
	icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	({ error = false, icon, className = '', ...props }, ref) => {
		return (
			<div className="relative">
				{icon && (
					<span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted size-4">
						{icon}
					</span>
				)}
				<input
					ref={ref}
					className={`
						w-full h-10 px-3 ${icon ? 'pl-10' : ''} text-sm
						bg-surface border rounded-lg
						text-text-primary placeholder:text-text-muted
						transition-colors
						focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background
						disabled:opacity-50 disabled:cursor-not-allowed
						${
							error
								? 'border-destructive focus:ring-destructive/50'
								: 'border-border focus:border-action focus:ring-action/50'
						}
						${className}
					`}
					{...props}
				/>
			</div>
		);
	}
);

Input.displayName = 'Input';
