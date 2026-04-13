'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	icon?: ReactNode;
	children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
	primary: 'bg-action text-action-fg hover:bg-action-hover focus-visible:ring-action/50',
	secondary: 'bg-surface-raised text-text-primary hover:bg-border-subtle focus-visible:ring-border',
	outline:
		'border border-border bg-transparent text-text-primary hover:bg-surface-raised focus-visible:ring-border',
	ghost: 'bg-transparent text-text-primary hover:bg-surface-raised focus-visible:ring-border'
};

const sizeStyles: Record<ButtonSize, string> = {
	sm: 'h-8 px-3 text-sm gap-1.5',
	md: 'h-10 px-4 text-sm gap-2',
	lg: 'h-12 px-6 text-base gap-2.5'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			variant = 'primary',
			size = 'md',
			loading = false,
			icon,
			children,
			disabled,
			className = '',
			...props
		},
		ref
	) => {
		const isDisabled = disabled || loading;

		return (
			<button
				ref={ref}
				disabled={isDisabled}
				className={`
					inline-flex items-center justify-center font-medium rounded-lg transition-colors
					focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background
					disabled:opacity-50 disabled:cursor-not-allowed
					${variantStyles[variant]}
					${sizeStyles[size]}
					${className}
				`}
				{...props}
			>
				{loading ? (
					<Loader2 className="size-4 animate-spin" />
				) : icon ? (
					<span className="size-4 shrink-0">{icon}</span>
				) : null}
				{children}
			</button>
		);
	}
);

Button.displayName = 'Button';
