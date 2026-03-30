import type { ReactNode } from 'react';

interface AuthLayoutProps {
	children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<div className="w-full max-w-md">
				<div className="bg-surface rounded-2xl border border-border shadow-sm p-8">{children}</div>
				<p className="text-center text-xs text-text-muted mt-6">© 2026 CommNode. 保留所有權利。</p>
			</div>
		</div>
	);
}
