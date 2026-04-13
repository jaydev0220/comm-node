'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock } from 'lucide-react';
import { SiGoogle } from '@icons-pack/react-simple-icons';
import { Button, Input, FormField, Separator } from '@/components/ui';
import { api, getApiUrl } from '@/lib/api';

interface FormErrors {
	email?: string;
	password?: string;
	confirmPassword?: string;
	general?: string;
}

interface RegisterStartResponse {
	setupToken: string;
	setupUrl: string;
}

export default function RegisterPage() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<FormErrors>({});

	const handleGoogleRegister = () => {
		window.location.href = getApiUrl('/auth/google');
	};

	const validateForm = (formData: FormData): FormErrors => {
		const newErrors: FormErrors = {};

		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!email) {
			newErrors.email = '請輸入電子郵件';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			newErrors.email = '請輸入有效的電子郵件';
		}

		if (!password) {
			newErrors.password = '請輸入密碼';
		} else if (password.length < 8) {
			newErrors.password = '密碼至少需要 8 個字元';
		} else if (password.length > 128) {
			newErrors.password = '密碼不能超過 128 個字元';
		}

		if (!confirmPassword) {
			newErrors.confirmPassword = '請確認密碼';
		} else if (password !== confirmPassword) {
			newErrors.confirmPassword = '密碼不一致';
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

		const email = (formData.get('email') as string) ?? '';
		const password = (formData.get('password') as string) ?? '';

		try {
			const data = await api.post<RegisterStartResponse>('/auth/register/start', {
				email,
				password
			});
			const fallbackSetupUrl = `/register/setup?flow=email&token=${encodeURIComponent(data.setupToken)}`;

			router.push(data.setupUrl || fallbackSetupUrl);
		} catch (err) {
			const error = err as { message?: string; status?: number };
			if (error.status === 409) {
				setErrors({ general: '此電子郵件已被使用' });
			} else {
				setErrors({ general: error.message ?? '註冊失敗，請稍後再試' });
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<h1 className="text-2xl font-bold text-text-primary text-center mb-8">註冊 CommNode</h1>

			<Button
				type="button"
				variant="outline"
				size="lg"
				className="w-full"
				onClick={handleGoogleRegister}
				icon={<SiGoogle size={16} />}
			>
				使用 Google 註冊
			</Button>

			<Separator text="或使用電子郵件" />

			<form onSubmit={handleSubmit} className="space-y-4">
				{errors.general && (
					<div className="p-3 rounded-lg bg-destructive-subtle text-destructive text-sm">
						{errors.general}
					</div>
				)}

				<FormField label="電子郵件" htmlFor="email" error={errors.email} required>
					<Input
						id="email"
						name="email"
						type="email"
						placeholder="you@example.com"
						autoComplete="email"
						error={!!errors.email}
						icon={<Mail className="size-4" />}
					/>
				</FormField>

				<FormField
					label="密碼"
					htmlFor="password"
					error={errors.password}
					description="至少 8 個字元"
					required
				>
					<Input
						id="password"
						name="password"
						type="password"
						showPasswordToggle
						placeholder="••••••••"
						autoComplete="new-password"
						error={!!errors.password}
						icon={<Lock className="size-4" />}
					/>
				</FormField>

				<FormField
					label="確認密碼"
					htmlFor="confirmPassword"
					error={errors.confirmPassword}
					required
				>
					<Input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						showPasswordToggle
						placeholder="••••••••"
						autoComplete="new-password"
						error={!!errors.confirmPassword}
						icon={<Lock className="size-4" />}
					/>
				</FormField>

				<Button type="submit" size="lg" className="w-full mt-6" loading={loading}>
					下一步
				</Button>
			</form>

			<p className="text-center text-sm text-text-secondary mt-6">
				已經有帳號？{' '}
				<Link
					href="/login"
					className="text-action hover:text-action-hover font-medium transition-colors"
				>
					立即登入
				</Link>
			</p>
		</>
	);
}
