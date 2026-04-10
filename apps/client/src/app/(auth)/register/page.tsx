'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, AtSign } from 'lucide-react';
import { SiGoogle } from '@icons-pack/react-simple-icons';
import { Button, Input, FormField, Separator } from '@/components/ui';
import { api, getApiUrl } from '@/lib/api';

interface FormErrors {
	email?: string;
	username?: string;
	displayName?: string;
	password?: string;
	confirmPassword?: string;
	general?: string;
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
		const username = formData.get('username') as string;
		const displayName = formData.get('displayName') as string;
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!email) {
			newErrors.email = '請輸入電子郵件';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			newErrors.email = '請輸入有效的電子郵件';
		}

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

		try {
			await api.post('/auth/register', {
				email: formData.get('email'),
				username: formData.get('username'),
				displayName: formData.get('displayName'),
				password: formData.get('password')
			});
			router.push('/');
		} catch (err) {
			const error = err as { message?: string; status?: number };
			if (error.status === 409) {
				setErrors({ general: '此電子郵件或使用者名稱已被使用' });
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
						placeholder="••••••••"
						autoComplete="new-password"
						error={!!errors.confirmPassword}
						icon={<Lock className="size-4" />}
					/>
				</FormField>

				<Button type="submit" size="lg" className="w-full mt-6" loading={loading}>
					註冊
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
