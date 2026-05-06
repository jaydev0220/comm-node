'use client';

import { Camera, ImagePlus } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button, FormField, Input, Separator } from '@/components/ui';
import { api, getAssetUrl } from '@/lib/api';
import type { User } from '@/lib/api-types';

interface ProfileViewProps {
	user: User;
	accessToken: string | null;
	onProfileSaved: () => void;
}

interface ValidationErrors {
	username?: string;
	displayName?: string;
	avatar?: string;
	general?: string;
}

interface PasswordErrors {
	current?: string;
	new?: string;
	confirm?: string;
	general?: string;
}

const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const AVATAR_ACCEPT_ATTRIBUTE = 'image/jpeg,image/png,image/gif,image/webp';
const MAX_AVATAR_SIZE_BYTES = 10 * 1024 * 1024;

const getInitials = (name: string): string => {
	const trimmedName = name.trim();

	if (!trimmedName) {
		return '?';
	}

	const words = trimmedName.split(/\s+/).filter(Boolean);
	const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '');

	return initials.join('').slice(0, 2) || trimmedName[0]?.toUpperCase() || '?';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const getErrorMessage = (error: unknown, fallback: string): string => {
	if (isRecord(error) && typeof error.message === 'string' && error.message.length > 0) {
		return error.message;
	}

	return fallback;
};

const getResponseErrorMessage = async (response: Response, fallback: string): Promise<string> => {
	const responseText = await response.text();

	if (!responseText) {
		return fallback;
	}

	try {
		const parsedResponse = JSON.parse(responseText) as {
			error?: {
				message?: string;
			};
			message?: string;
		};

		if (
			typeof parsedResponse.error?.message === 'string' &&
			parsedResponse.error.message.length > 0
		) {
			return parsedResponse.error.message;
		}

		if (typeof parsedResponse.message === 'string' && parsedResponse.message.length > 0) {
			return parsedResponse.message;
		}
	} catch {
		return fallback;
	}

	return fallback;
};

export function ProfileView({ user, accessToken, onProfileSaved }: ProfileViewProps) {
	void accessToken;
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [username, setUsername] = useState(user.username);
	const [displayName, setDisplayName] = useState(user.displayName);
	const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
	const [errors, setErrors] = useState<ValidationErrors>({});
	const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
	const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
	const [isChangingPassword, setIsChangingPassword] = useState(false);

	useEffect(() => {
		setUsername(user.username);
		setDisplayName(user.displayName);
		setCurrentAvatarUrl(user.avatarUrl ?? null);
		setAvatarFile(null);
		setSaveSuccess(null);
		setErrors({});
		setCurrentPassword('');
		setNewPassword('');
		setConfirmPassword('');
		setPasswordErrors({});
		setPasswordSuccess(null);
		setAvatarPreviewUrl((currentPreviewUrl) => {
			if (currentPreviewUrl?.startsWith('blob:')) {
				URL.revokeObjectURL(currentPreviewUrl);
			}

			return null;
		});
	}, [user.avatarUrl, user.displayName, user.username, user.authMethods]);

	useEffect(
		() => () => {
			if (avatarPreviewUrl?.startsWith('blob:')) {
				URL.revokeObjectURL(avatarPreviewUrl);
			}
		},
		[avatarPreviewUrl]
	);

	const resolvedCurrentAvatarUrl = useMemo(
		() => getAssetUrl(currentAvatarUrl) ?? null,
		[currentAvatarUrl]
	);
	const avatarImageUrl = avatarPreviewUrl ?? resolvedCurrentAvatarUrl;
	const normalizedUsername = username.trim();
	const normalizedDisplayName = displayName.trim();
	const hasTextChanges =
		normalizedUsername !== user.username || normalizedDisplayName !== user.displayName;
	const hasUnsavedProfileChanges = hasTextChanges || avatarFile !== null;
	const hasPasswordAuth = user.authMethods?.includes('password') === true;
	const passwordFormDirty =
		currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;

	const handleAvatarPickerOpen = () => {
		if (isSaving) {
			return;
		}

		fileInputRef.current?.click();
	};

	const handleAvatarSelected = (event: ChangeEvent<HTMLInputElement>) => {
		const selectedFile = event.target.files?.[0];

		if (!selectedFile) {
			return;
		}

		if (!ALLOWED_AVATAR_TYPES.has(selectedFile.type)) {
			setErrors((currentErrors) => ({
				...currentErrors,
				avatar: '頭像格式不支援，請選擇 JPG、PNG、GIF 或 WEBP'
			}));
			event.target.value = '';
			return;
		}

		if (selectedFile.size > MAX_AVATAR_SIZE_BYTES) {
			setErrors((currentErrors) => ({
				...currentErrors,
				avatar: '頭像檔案過大，請選擇 10MB 以下檔案'
			}));
			event.target.value = '';
			return;
		}

		const nextPreviewUrl = URL.createObjectURL(selectedFile);

		setAvatarPreviewUrl((currentPreviewUrl) => {
			if (currentPreviewUrl?.startsWith('blob:')) {
				URL.revokeObjectURL(currentPreviewUrl);
			}

			return nextPreviewUrl;
		});
		setAvatarFile(selectedFile);
		setSaveSuccess(null);
		setErrors((currentErrors) => ({
			...currentErrors,
			avatar: undefined,
			general: undefined
		}));
		event.target.value = '';
	};

	const validateForm = (): ValidationErrors => {
		const validationErrors: ValidationErrors = {};

		if (!normalizedUsername) {
			validationErrors.username = '請輸入使用者名稱';
		} else if (normalizedUsername.length < 3) {
			validationErrors.username = '使用者名稱至少需要 3 個字元';
		} else if (normalizedUsername.length > 32) {
			validationErrors.username = '使用者名稱不能超過 32 個字元';
		} else if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
			validationErrors.username = '使用者名稱只能包含小寫字母、數字和底線';
		}

		if (!normalizedDisplayName) {
			validationErrors.displayName = '請輸入顯示名稱';
		} else if (normalizedDisplayName.length > 64) {
			validationErrors.displayName = '顯示名稱不能超過 64 個字元';
		}

		return validationErrors;
	};

	const handleDiscard = () => {
		if (isSaving) {
			return;
		}

		setUsername(user.username);
		setDisplayName(user.displayName);
		setAvatarFile(null);
		setCurrentPassword('');
		setNewPassword('');
		setConfirmPassword('');
		setPasswordErrors({});
		setPasswordSuccess(null);
		setSaveSuccess(null);
		setErrors({});
		setAvatarPreviewUrl((currentPreviewUrl) => {
			if (currentPreviewUrl?.startsWith('blob:')) {
				URL.revokeObjectURL(currentPreviewUrl);
			}

			return null;
		});
	};

	const handleSave = async () => {
		const validationErrors = validateForm();

		if (Object.keys(validationErrors).length > 0) {
			setErrors(validationErrors);
			setSaveSuccess(null);
			return;
		}

		setIsSaving(true);
		setErrors({});
		setSaveSuccess(null);

		try {
			if (hasTextChanges) {
				const updatePayload: {
					username?: string;
					displayName?: string;
				} = {};

				if (normalizedUsername !== user.username) {
					updatePayload.username = normalizedUsername;
				}

				if (normalizedDisplayName !== user.displayName) {
					updatePayload.displayName = normalizedDisplayName;
				}

				if (Object.keys(updatePayload).length > 0) {
					const updatedUser = await api.patch<User>('/users/me', updatePayload);
					setCurrentAvatarUrl(updatedUser.avatarUrl ?? null);
				}
			}

			if (avatarFile) {
				const formData = new FormData();
				formData.set('avatar', avatarFile);
				const response = await api.requestRaw('/users/me/avatar', {
					method: 'POST',
					body: formData
				});

				if (!response.ok) {
					throw new Error(await getResponseErrorMessage(response, '頭像上傳失敗，請稍後再試'));
				}

				const updatedUser = (await response.json()) as User;
				setCurrentAvatarUrl(updatedUser.avatarUrl ?? null);
			}

			setAvatarFile(null);
			setAvatarPreviewUrl((currentPreviewUrl) => {
				if (currentPreviewUrl?.startsWith('blob:')) {
					URL.revokeObjectURL(currentPreviewUrl);
				}

				return null;
			});
			setSaveSuccess('個人資料已儲存');
			onProfileSaved();
		} catch (error) {
			setErrors({
				general: getErrorMessage(error, '儲存設定失敗，請稍後再試')
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleChangePassword = async () => {
		const errs: PasswordErrors = {};

		if (!currentPassword) errs.current = '請輸入目前密碼';
		if (!newPassword) errs.new = '請輸入新密碼';
		else if (newPassword.length < 8) errs.new = '新密碼至少需要 8 個字元';
		else if (newPassword.length > 128) errs.new = '新密碼不能超過 128 個字元';
		if (newPassword !== confirmPassword) errs.confirm = '確認密碼與新密碼不符';
		if (Object.keys(errs).length > 0) {
			setPasswordErrors(errs);
			return;
		}

		setIsChangingPassword(true);
		setPasswordErrors({});
		setPasswordSuccess(null);

		try {
			const response = await api.requestRaw('/users/me/password', {
				method: 'PATCH',
				body: JSON.stringify({ currentPassword, newPassword })
			});

			if (!response.ok) {
				const msg = await getResponseErrorMessage(response, '密碼變更失敗，請稍後再試');
				setPasswordErrors({ general: msg });
				return;
			}

			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
			setPasswordSuccess('密碼已成功變更');
		} catch (err) {
			setPasswordErrors({ general: getErrorMessage(err, '密碼變更失敗，請稍後再試') });
		} finally {
			setIsChangingPassword(false);
		}
	};

	return (
		<div className="flex h-full w-full justify-center overflow-hidden">
			<div className="flex h-full w-full max-w-5xl p-8">
				<div className="flex h-full w-80 shrink-0 flex-col items-center gap-4">
					<button
						type="button"
						onClick={handleAvatarPickerOpen}
						disabled={isSaving}
						className="border-border bg-surface-raised group hover:bg-border-subtle relative flex size-44 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition-colors disabled:cursor-not-allowed"
					>
						{avatarImageUrl ? (
							<Image
								src={avatarImageUrl}
								alt="個人頭像"
								fill
								sizes="176px"
								unoptimized
								className="object-cover"
							/>
						) : (
							<span
								className="text-text-primary text-5xl font-semibold select-none"
								aria-hidden={true}
							>
								{getInitials(normalizedDisplayName || user.displayName || user.username)}
							</span>
						)}
						<span className="bg-surface/80 text-text-secondary absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
							<Camera className="size-5" />
							<span className="text-xs font-medium">更換頭像</span>
						</span>
					</button>

					<input
						ref={fileInputRef}
						type="file"
						accept={AVATAR_ACCEPT_ATTRIBUTE}
						onChange={handleAvatarSelected}
						className="hidden"
						disabled={isSaving}
					/>

					<p className="text-text-muted text-center text-xs leading-5">
						點擊頭像即可上傳新圖片。
						<br />
						支援 JPG, PNG, GIF, WEBP。
						<br />
						建議使用 512x512，檔案需小於 10MB。
					</p>

					<div className="text-text-muted flex items-center gap-2 text-sm">
						<ImagePlus className="size-4" />
						<span>頭像將於點擊保存後更新。</span>
					</div>
					{errors.avatar ? (
						<p className="text-destructive mt-3 text-center text-xs">{errors.avatar}</p>
					) : null}
				</div>

				<section className="invisible-scroll-y relative min-h-0 max-w-3xl grow px-4 pb-12">
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void handleSave();
						}}
					>
						<div className="mx-auto flex w-full flex-col gap-6">
							<h1 className="text-text-primary text-xl font-semibold">個人檔案設定</h1>

							{errors.general ? (
								<div className="bg-destructive-subtle text-destructive rounded-lg px-4 py-3 text-sm">
									{errors.general}
								</div>
							) : null}

							{saveSuccess ? (
								<div className="bg-success-subtle text-success rounded-lg px-4 py-3 text-sm">
									{saveSuccess}
								</div>
							) : null}

							<FormField
								label="使用者名稱"
								htmlFor="profile-username"
								error={errors.username}
								description="長度 3~32 個字。僅接受小寫字母、數字、底線的組合。"
								required
							>
								<Input
									id="profile-username"
									type="text"
									value={username}
									onChange={(event) => setUsername(event.target.value)}
									autoComplete="username"
									error={Boolean(errors.username)}
									disabled={isSaving}
								/>
							</FormField>

							<FormField
								label="顯示名稱"
								htmlFor="profile-display-name"
								error={errors.displayName}
								description="其他使用者看見的名稱。"
								required
							>
								<Input
									id="profile-display-name"
									type="text"
									value={displayName}
									onChange={(event) => setDisplayName(event.target.value)}
									autoComplete="name"
									error={Boolean(errors.displayName)}
									disabled={isSaving}
								/>
							</FormField>
						</div>

						<div className="mx-auto mt-2 flex w-full items-center justify-end gap-3">
							<Button
								type="button"
								variant="secondary"
								onClick={handleDiscard}
								disabled={!hasUnsavedProfileChanges || isSaving}
							>
								捨棄
							</Button>
							<Button type="submit" loading={isSaving} disabled={!hasUnsavedProfileChanges}>
								保存
							</Button>
						</div>
					</form>

					{hasPasswordAuth && (
						<>
							<Separator />

							<form
								onSubmit={(event) => {
									event.preventDefault();
									void handleChangePassword();
								}}
							>
								<div className="mx-auto flex w-full flex-col gap-6">
									<h1 className="text-text-primary text-xl font-semibold">修改密碼</h1>

									<FormField
										label="目前密碼"
										htmlFor="current-password"
										error={passwordErrors.current}
										description="輸入目前的密碼"
										required
									>
										<Input
											id="current-password"
											type="password"
											showPasswordToggle
											value={currentPassword}
											onChange={(e) => setCurrentPassword(e.target.value)}
											autoComplete="current-password"
											disabled={isChangingPassword}
										/>
									</FormField>

									<FormField
										label="新密碼"
										htmlFor="new-password"
										error={passwordErrors.new}
										description="長度 8~128 個字元"
										required
									>
										<Input
											id="new-password"
											type="password"
											showPasswordToggle
											value={newPassword}
											onChange={(e) => setNewPassword(e.target.value)}
											autoComplete="new-password"
											disabled={isChangingPassword}
										/>
									</FormField>

									<FormField
										label="確認新密碼"
										htmlFor="confirm-password"
										error={passwordErrors.confirm}
										description="重新輸入一次新密碼"
										required
									>
										<Input
											id="confirm-password"
											type="password"
											showPasswordToggle
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											autoComplete="new-password"
											disabled={isChangingPassword}
										/>
									</FormField>

									{passwordErrors.general ? (
										<p className="text-destructive text-sm">{passwordErrors.general}</p>
									) : null}
									{passwordSuccess ? (
										<p className="text-success text-sm">{passwordSuccess}</p>
									) : null}
								</div>

								<div className="mx-auto mt-2 flex w-full items-center justify-end">
									<Button type="submit" loading={isChangingPassword} disabled={!passwordFormDirty}>
										確認變更
									</Button>
								</div>
							</form>
						</>
					)}
				</section>
			</div>
		</div>
	);
}
