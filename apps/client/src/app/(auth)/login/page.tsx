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
	general?: string;
}

export default function LoginPage() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<FormErrors>({});

	const handleGoogleLogin = () => {
		window.location.href = getApiUrl('/auth/google');
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setErrors({});
		setLoading(true);

		const formData = new FormData(e.currentTarget);
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		// Client-side validation
		const newErrors: FormErrors = {};
		if (!email) {
			newErrors.email = '請輸入電子郵件';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			newErrors.email = '請輸入有效的電子郵件';
		}
		if (!password) {
			newErrors.password = '請輸入密碼';
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			setLoading(false);
			return;
		}

		try {
			await api.post('/auth/login', { email, password });
			router.push('/');
		} catch (err) {
			const error = err as { message?: string; status?: number };
			if (error.status === 401) {
				setErrors({ general: '電子郵件或密碼錯誤' });
			} else {
				setErrors({ general: error.message ?? '登入失敗，請稍後再試' });
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<h1 className="text-2xl font-bold text-text-primary text-center mb-8">登入 CommNode</h1>

			<Button
				type="button"
				variant="outline"
				size="lg"
				className="w-full"
				onClick={handleGoogleLogin}
				icon={<SiGoogle size={16} />}
			>
				使用 Google 登入
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

				<FormField label="密碼" htmlFor="password" error={errors.password} required>
					<Input
						id="password"
						name="password"
						type="password"
						placeholder="••••••••"
						autoComplete="current-password"
						error={!!errors.password}
						icon={<Lock className="size-4" />}
					/>
				</FormField>

				<Button type="submit" size="lg" className="w-full mt-6" loading={loading}>
					登入
				</Button>
			</form>

			<p className="text-center text-sm text-text-secondary mt-6">
				還沒有帳號？{' '}
				<Link
					href="/register"
					className="text-action hover:text-action-hover font-medium transition-colors"
				>
					立即註冊
				</Link>
			</p>
		</>
	);
}
