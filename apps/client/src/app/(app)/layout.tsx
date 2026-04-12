import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/auth-guards';

interface AppLayoutProps {
	children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
	return (
		<RequireAuth>
			<div className="min-h-screen bg-background text-text-primary">{children}</div>
		</RequireAuth>
	);
}
