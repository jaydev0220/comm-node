'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';
import { setAccessToken } from '@/lib/auth-session';

function AuthSuccessContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const accessToken = searchParams.get('accessToken');

	useEffect(() => {
		if (accessToken) {
			setAccessToken(accessToken);

			// Redirect to home after a brief delay to show success message
			const timeout = setTimeout(() => {
				router.replace('/');
			}, 1500);

			return () => clearTimeout(timeout);
		} else {
			// No token, redirect to login
			router.replace('/login');
		}
	}, [accessToken, router]);

	if (!accessToken) {
		return (
			<div className="flex flex-col items-center justify-center py-8">
				<Loader2 className="text-action size-8 animate-spin" />
				<p className="text-text-secondary mt-4 text-sm">正在重新導向...</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center py-8">
			<div className="bg-success-subtle mb-4 flex size-16 items-center justify-center rounded-full">
				<CheckCircle className="text-success size-8" />
			</div>
			<h1 className="text-text-primary mb-2 text-xl font-bold">登入成功！</h1>
			<p className="text-text-secondary text-sm">正在為您跳轉...</p>
			<div className="mt-4">
				<Loader2 className="text-text-muted size-5 animate-spin" />
			</div>
		</div>
	);
}

function LoadingFallback() {
	return (
		<div className="flex flex-col items-center justify-center py-8">
			<Loader2 className="text-action size-8 animate-spin" />
			<p className="text-text-secondary mt-4 text-sm">載入中...</p>
		</div>
	);
}

export default function AuthSuccessPage() {
	return (
		<Suspense fallback={<LoadingFallback />}>
			<AuthSuccessContent />
		</Suspense>
	);
}
