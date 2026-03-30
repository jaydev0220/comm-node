'use client';

import { Suspense, useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, AtSign, ImageIcon, AlertCircle, Loader2 } from 'lucide-react';
import { SiGoogle } from '@icons-pack/react-simple-icons';
import { Button, Input, FormField } from '@/components/ui';
import { api } from '@/lib/api';

interface FormErrors {
	username?: string;
	displayName?: string;
	avatarUrl?: string;
	general?: string;
}

function GoogleSetupContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get('token');

	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<FormErrors>({});

	useEffect(() => {
		if (!token) {
			router.replace('/login');
		}
	}, [token, router]);

	const validateForm = (formData: FormData): FormErrors => {
		const newErrors: FormErrors = {};

		const username = formData.get('username') as string;
		const displayName = formData.get('displayName') as string;
		const avatarUrl = formData.get('avatarUrl') as string;

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

		if (avatarUrl && !/^https?:\/\/.+/.test(avatarUrl)) {
			newErrors.avatarUrl = '請輸入有效的網址';
		}

		return newErrors;
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setErrors({});
		setLoading(true);

		const formData = new FormData(e.currentTarget);
		const validationErrors = validateForm(formData);

		if (Object.keys(validationErrors).length > 0) {
			setErrors(validationErrors);
			setLoading(false);
			return;
		}

		const avatarUrl = formData.get('avatarUrl') as string;

		try {
			await api.post('/auth/google/complete', {
				token,
				username: formData.get('username'),
				displayName: formData.get('displayName'),
				...(avatarUrl ? { avatarUrl } : {})
			});
			router.push('/');
		} catch (err) {
			const error = err as { message?: string; status?: number };
			if (error.status === 401) {
				setErrors({ general: '連結已過期，請重新使用 Google 登入' });
			} else if (error.status === 409) {
				setErrors({ username: '此使用者名稱已被使用' });
			} else {
				setErrors({ general: error.message ?? '設定失敗，請稍後再試' });
			}
		} finally {
			setLoading(false);
		}
	};

	if (!token) {
		return null;
	}

	return (
		<>
			<div className="flex items-center justify-center gap-2 mb-2">
				<SiGoogle size={24} className="text-text-secondary" />
			</div>
			<h1 className="text-2xl font-bold text-text-primary text-center mb-2">完成帳號設定</h1>
			<p className="text-sm text-text-secondary text-center mb-8">
				您已成功通過 Google 驗證，請完成以下資料設定
			</p>

			<form onSubmit={handleSubmit} className="space-y-4">
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
					label="頭像網址"
					htmlFor="avatarUrl"
					error={errors.avatarUrl}
					description="選填，輸入圖片網址作為您的頭像"
				>
					<Input
						id="avatarUrl"
						name="avatarUrl"
						type="url"
						placeholder="https://example.com/avatar.jpg"
						error={!!errors.avatarUrl}
						icon={<ImageIcon className="size-4" />}
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

export default function GoogleSetupPage() {
	return (
		<Suspense fallback={<LoadingFallback />}>
			<GoogleSetupContent />
		</Suspense>
	);
}
