'use client';

import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	error?: boolean;
	icon?: ReactNode;
	showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	({ error = false, icon, className = '', showPasswordToggle = false, type, ...props }, ref) => {
		const [isPasswordVisible, setIsPasswordVisible] = useState(false);
		const canTogglePassword = showPasswordToggle && type === 'password';
		const inputType = canTogglePassword && isPasswordVisible ? 'text' : type;

		return (
			<div className="relative">
				{icon && (
					<span
						aria-hidden="true"
						className="text-text-muted absolute top-1/2 left-3 size-4 -translate-y-1/2"
					>
						{icon}
					</span>
				)}
				<input
					ref={ref}
					type={inputType}
					className={`h-10 w-full px-3 ${icon ? 'pl-10' : ''} ${canTogglePassword ? 'pr-12' : ''} bg-surface text-text-primary placeholder:text-text-muted focus:ring-offset-background rounded-lg border text-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
						error
							? 'border-destructive focus:ring-destructive/50'
							: 'border-border focus:border-action focus:ring-action/50'
					} ${className} `}
					{...props}
				/>
				{canTogglePassword && (
					<button
						type="button"
						className="text-text-muted hover:text-action focus-visible:ring-action/50 focus-visible:ring-offset-background absolute top-1/2 right-0 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-r-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:[transition-property:color,transform] motion-safe:duration-200 motion-safe:hover:scale-105"
						aria-label={isPasswordVisible ? '隱藏密碼' : '顯示密碼'}
						aria-pressed={isPasswordVisible}
						onClick={() => setIsPasswordVisible((visible) => !visible)}
						disabled={props.disabled}
					>
						{isPasswordVisible ? (
							<EyeOff aria-hidden="true" className="size-4" />
						) : (
							<Eye aria-hidden="true" className="size-4" />
						)}
					</button>
				)}
			</div>
		);
	}
);

Input.displayName = 'Input';
