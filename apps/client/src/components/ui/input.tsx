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
						className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted size-4"
					>
						{icon}
					</span>
				)}
				<input
					ref={ref}
					type={inputType}
					className={`
						w-full h-10 px-3 ${icon ? 'pl-10' : ''} ${canTogglePassword ? 'pr-12' : ''} text-sm
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
				{canTogglePassword && (
					<button
						type="button"
						className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-r-lg text-text-muted hover:text-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:[transition-property:color,transform] motion-safe:duration-200 motion-safe:hover:scale-105"
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
