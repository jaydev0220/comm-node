'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';

function AuthSuccessContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const accessToken = searchParams.get('accessToken');

	useEffect(() => {
		if (accessToken) {
			// Store the access token (in a real app, you'd use a proper auth context/store)
			// For now, we'll just store in sessionStorage and redirect
			sessionStorage.setItem('accessToken', accessToken);

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
				<Loader2 className="size-8 animate-spin text-action" />
				<p className="text-sm text-text-secondary mt-4">正在重新導向...</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center py-8">
			<div className="size-16 rounded-full bg-success-subtle flex items-center justify-center mb-4">
				<CheckCircle className="size-8 text-success" />
			</div>
			<h1 className="text-xl font-bold text-text-primary mb-2">登入成功！</h1>
			<p className="text-sm text-text-secondary">正在為您跳轉...</p>
			<div className="mt-4">
				<Loader2 className="size-5 animate-spin text-text-muted" />
			</div>
		</div>
	);
}

function LoadingFallback() {
	return (
		<div className="flex flex-col items-center justify-center py-8">
			<Loader2 className="size-8 animate-spin text-action" />
			<p className="text-sm text-text-secondary mt-4">載入中...</p>
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
