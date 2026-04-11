'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';

function GoogleSetupRedirectContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get('token');

	useEffect(() => {
		if (!token) {
			return;
		}

		const setupUrl = `/register/setup?flow=google&token=${encodeURIComponent(token)}`;

		router.replace(setupUrl);
	}, [token, router]);

	if (!token) {
		return (
			<div className="space-y-4">
				<div className="p-3 rounded-lg bg-destructive-subtle text-destructive text-sm flex items-center gap-2">
					<AlertCircle className="size-4 shrink-0" />
					連結已過期，請重新使用 Google 登入
				</div>
				<Button type="button" size="lg" className="w-full" onClick={() => router.replace('/login')}>
					返回登入
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center py-8">
			<Loader2 className="size-8 animate-spin text-action" />
			<p className="text-sm text-text-secondary mt-4">正在前往帳號設定頁...</p>
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

export default function GoogleSetupPage() {
	return (
		<Suspense fallback={<LoadingFallback />}>
			<GoogleSetupRedirectContent />
		</Suspense>
	);
}
