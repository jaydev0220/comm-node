'use client';

import { type ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthSession } from '@/components/auth-session-provider';

const FULL_SCREEN_BASE = 'min-h-screen bg-background text-text-primary';
const AUTH_PAGES_TO_REDIRECT = new Set(['/login', '/register']);

function AuthStateScreen({ message }: { message: string }) {
	return (
		<div className={`flex items-center justify-center ${FULL_SCREEN_BASE}`}>
			<div className="flex flex-col items-center gap-4 text-center">
				<Loader2 className="size-8 animate-spin text-action" />
				<p className="text-sm text-text-secondary">{message}</p>
			</div>
		</div>
	);
}

export function RequireAuth({ children }: { children: ReactNode }) {
	const { status } = useAuthSession();
	const router = useRouter();

	useEffect(() => {
		if (status === 'anonymous') {
			router.replace('/login');
		}
	}, [router, status]);

	if (status !== 'authenticated') {
		return <AuthStateScreen message="正在驗證登入狀態..." />;
	}

	return <>{children}</>;
}

export function PublicAuthOnly({ children }: { children: ReactNode }) {
	const { status } = useAuthSession();
	const pathname = usePathname();
	const router = useRouter();
	const shouldRedirect = AUTH_PAGES_TO_REDIRECT.has(pathname);

	useEffect(() => {
		if (shouldRedirect && status === 'authenticated') {
			router.replace('/');
		}
	}, [router, shouldRedirect, status]);

	if (shouldRedirect && status === 'authenticated') {
		return <AuthStateScreen message="您已登入，正在前往首頁..." />;
	}

	if (shouldRedirect && status === 'loading') {
		return <AuthStateScreen message="正在檢查登入狀態..." />;
	}

	return (
		<div className="min-h-screen bg-background p-4 text-text-primary">
			<div className="flex min-h-[calc(100vh-2rem)] items-center justify-center">
				<div className="w-full max-w-md rounded-3xl border border-border bg-surface/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
					{children}
				</div>
			</div>
		</div>
	);
}
