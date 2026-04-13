'use client';

import { Suspense, useEffect, useMemo, useState, type SubmitEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AtSign, User, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { SiGoogle } from '@icons-pack/react-simple-icons';
import { Button, Input, FormField } from '@/components/ui';
import { setAccessToken } from '@/lib/auth-session';
import { getApiUrl } from '@/lib/api';
import type { AuthResponse } from '@/lib/api-types';

type SetupFlow = 'email' | 'google';

interface FormErrors {
	username?: string;
	displayName?: string;
	avatar?: string;
	general?: string;
}

const AVATAR_ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const AVATAR_ACCEPT_ATTRIBUTE = 'image/jpeg,image/png,image/gif,image/webp';

const resolveFlow = (flowValue: string | null): SetupFlow | null => {
	if (flowValue === 'email' || flowValue === 'google') {
		return flowValue;
	}

	return null;
};

function ProfileSetupContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get('token');
	const flow = useMemo(() => resolveFlow(searchParams.get('flow')), [searchParams]);
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<FormErrors>({});
	const [isCompleted, setIsCompleted] = useState(false);
	const [countdown, setCountdown] = useState(5);

	useEffect(() => {
		if (token && flow) {
			return;
		}

		router.replace(flow === 'google' ? '/login' : '/register');
	}, [flow, token, router]);

	useEffect(() => {
		if (!isCompleted) {
			return;
		}

		if (countdown <= 0) {
			router.replace('/');
			return;
		}

		const timeout = setTimeout(() => {
			setCountdown((currentCount) => currentCount - 1);
		}, 1000);

		return () => clearTimeout(timeout);
	}, [countdown, isCompleted, router]);

	const validateForm = (formData: FormData): FormErrors => {
		const newErrors: FormErrors = {};

		const username = formData.get('username') as string;
		const displayName = formData.get('displayName') as string;
		const avatarFile = formData.get('avatar');

		if (!username) {
			newErrors.username = '請輸入使用者名稱';
		} else if (username.length < 3) {
			newErrors.username = '使用者名稱至少需要 3 個字元';
		} else if (username.length > 32) {
			newErrors.username = '使用者名稱不能超過 32 個字元';
		} else if (!/^[a-z0-9_]+$/.test(username)) {
			newErrors.username = '使用者名稱只能包含小寫字母、數字和底線';
		}

		if (!displayName) {
			newErrors.displayName = '請輸入顯示名稱';
		} else if (displayName.length > 64) {
			newErrors.displayName = '顯示名稱不能超過 64 個字元';
		}

		if (
			avatarFile instanceof File &&
			avatarFile.size > 0 &&
			!AVATAR_ACCEPTED_TYPES.has(avatarFile.type)
		) {
			newErrors.avatar = '頭像格式不支援，請上傳 JPG、PNG、GIF 或 WEBP';
		}

		return newErrors;
	};

	const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		setErrors({});
		setLoading(true);

		if (!token || !flow) {
			setErrors({ general: '連結已失效，請重新註冊或登入' });
			setLoading(false);
			return;
		}

		const formData = new FormData(e.currentTarget);
		const validationErrors = validateForm(formData);

		if (Object.keys(validationErrors).length > 0) {
			setErrors(validationErrors);
			setLoading(false);
			return;
		}

		const submitData = new FormData();
		submitData.set('token', token);
		submitData.set('username', (formData.get('username') as string) ?? '');
		submitData.set('displayName', (formData.get('displayName') as string) ?? '');

		const avatarFile = formData.get('avatar');
		if (avatarFile instanceof File && avatarFile.size > 0) {
			submitData.set('avatar', avatarFile);
		}

		const endpoint = flow === 'google' ? '/auth/google/complete' : '/auth/register/complete';

		try {
			const response = await fetch(getApiUrl(endpoint), {
				method: 'POST',
				body: submitData,
				credentials: 'include'
			});

			if (!response.ok) {
				const error: { message: string; status: number } = {
					message: '發生錯誤，請稍後再試',
					status: response.status
				};

				try {
					const data = (await response.json()) as { message?: string };
					if (data.message) {
						error.message = data.message;
					}
				} catch {
					// Use default error message
				}

				throw error;
			}

			const data = (await response.json()) as AuthResponse;
			setAccessToken(data.accessToken);
			setCountdown(5);
			setIsCompleted(true);
		} catch (err) {
			const error = err as { message?: string; status?: number };
			if (error.status === 401) {
				setErrors({ general: '連結已過期，請重新開始註冊流程' });
			} else if (error.status === 409 && flow === 'google') {
				setErrors({ username: '此使用者名稱已被使用' });
			} else {
				setErrors({ general: error.message ?? '設定失敗，請稍後再試' });
			}
		} finally {
			setLoading(false);
		}
	};

	if (!token || !flow) {
		return null;
	}

	if (isCompleted) {
		return (
			<div className="flex flex-col items-center justify-center py-8 text-center">
				<div className="size-16 rounded-full bg-success-subtle flex items-center justify-center mb-4">
					<CheckCircle className="size-8 text-success" />
				</div>
				<h1 className="text-xl font-bold text-text-primary mb-2">設定完成！</h1>
				<p className="text-sm text-text-secondary mb-6">
					您的帳號已建立完成，將在 {countdown} 秒後自動前往首頁
				</p>
				<Button type="button" size="lg" onClick={() => router.replace('/')}>
					立即前往首頁
				</Button>
			</div>
		);
	}

	return (
		<>
			{flow === 'google' && (
				<div className="flex items-center justify-center gap-2 mb-2">
					<SiGoogle size={24} className="text-text-secondary" />
				</div>
			)}
			<h1 className="text-2xl font-bold text-text-primary text-center mb-2">完成帳號設定</h1>
			<p className="text-sm text-text-secondary text-center mb-8">
				{flow === 'google'
					? '您已成功通過 Google 驗證，請完成以下資料設定'
					: '請完成個人資料設定，即可開始使用 CommNode'}
			</p>

			<form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-4">
				{errors.general && (
					<div className="p-3 rounded-lg bg-destructive-subtle text-destructive text-sm flex items-center gap-2">
						<AlertCircle className="size-4 shrink-0" />
						{errors.general}
					</div>
				)}

				<FormField
					label="使用者名稱"
					htmlFor="username"
					error={errors.username}
					description="3-32 個字元，只能使用小寫字母、數字和底線"
					required
				>
					<Input
						id="username"
						name="username"
						type="text"
						placeholder="your_username"
						autoComplete="username"
						error={!!errors.username}
						icon={<AtSign className="size-4" />}
					/>
				</FormField>

				<FormField
					label="顯示名稱"
					htmlFor="displayName"
					error={errors.displayName}
					description="其他使用者會看到的名稱"
					required
				>
					<Input
						id="displayName"
						name="displayName"
						type="text"
						placeholder="您的名稱"
						autoComplete="name"
						error={!!errors.displayName}
						icon={<User className="size-4" />}
					/>
				</FormField>

				<FormField
					label="頭像圖片"
					htmlFor="avatar"
					error={errors.avatar}
					description="選填，支援 JPG、PNG、GIF、WEBP 格式"
				>
					<Input
						id="avatar"
						name="avatar"
						type="file"
						accept={AVATAR_ACCEPT_ATTRIBUTE}
						error={!!errors.avatar}
					/>
				</FormField>

				<Button type="submit" size="lg" className="w-full mt-6" loading={loading}>
					完成註冊
				</Button>
			</form>
		</>
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

export default function ProfileSetupPage() {
	return (
		<Suspense fallback={<LoadingFallback />}>
			<ProfileSetupContent />
		</Suspense>
	);
}
