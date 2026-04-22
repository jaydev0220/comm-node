'use client';

import { Camera, ImagePlus } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button, FormField, Input } from '@/components/ui';
import { api, getApiUrl, getAssetUrl } from '@/lib/api';
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
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [username, setUsername] = useState(user.username);
	const [displayName, setDisplayName] = useState(user.displayName);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
	const [errors, setErrors] = useState<ValidationErrors>({});
	const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		setUsername(user.username);
		setDisplayName(user.displayName);
		setAvatarFile(null);
		setSaveSuccess(null);
		setErrors({});
		setAvatarPreviewUrl((currentPreviewUrl) => {
			if (currentPreviewUrl?.startsWith('blob:')) {
				URL.revokeObjectURL(currentPreviewUrl);
			}

			return null;
		});
	}, [user.displayName, user.username]);

	useEffect(
		() => () => {
			if (avatarPreviewUrl?.startsWith('blob:')) {
				URL.revokeObjectURL(avatarPreviewUrl);
			}
		},
		[avatarPreviewUrl]
	);

	const resolvedCurrentAvatarUrl = useMemo(() => getAssetUrl(user.avatarUrl) ?? null, [user.avatarUrl]);
	const avatarImageUrl = avatarPreviewUrl ?? resolvedCurrentAvatarUrl;
	const isPreviewBlob = avatarImageUrl?.startsWith('blob:') ?? false;
	const normalizedUsername = username.trim();
	const normalizedDisplayName = displayName.trim();
	const hasTextChanges =
		normalizedUsername !== user.username || normalizedDisplayName !== user.displayName;
	const hasUnsavedChanges = hasTextChanges || avatarFile !== null;

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
					await api.patch<User>('/users/me', updatePayload);
				}
			}

			if (avatarFile) {
				const formData = new FormData();
				formData.set('avatar', avatarFile);

				const headers = new Headers();
				if (accessToken) {
					headers.set('Authorization', `Bearer ${accessToken}`);
				}

				const response = await fetch(getApiUrl('/users/me/avatar'), {
					method: 'POST',
					headers,
					body: formData,
					credentials: 'include'
				});

				if (!response.ok) {
					throw new Error(await getResponseErrorMessage(response, '頭像上傳失敗，請稍後再試'));
				}
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

	return (
		<div className="flex h-full w-full overflow-hidden">
			<aside className="border-border bg-surface flex h-full w-80 shrink-0 flex-col border-r px-8 py-8">
				<button
					type="button"
					onClick={handleAvatarPickerOpen}
					disabled={isSaving}
					className="border-border bg-surface-raised group relative mx-auto mb-5 flex size-44 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition-colors hover:bg-border-subtle disabled:cursor-not-allowed"
				>
					{avatarImageUrl ? (
						<Image
							src={avatarImageUrl}
							alt="個人頭像"
							fill
							sizes="176px"
							unoptimized={isPreviewBlob}
							className="object-cover"
						/>
					) : (
						<span className="text-text-primary text-5xl font-semibold select-none" aria-hidden={true}>
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
					支援 JPG、PNG、GIF、WEBP。
					<br />
					建議使用 512x512，檔案需小於 10MB。
				</p>
				{errors.avatar ? <p className="text-destructive mt-3 text-center text-xs">{errors.avatar}</p> : null}
			</aside>

			<section className="relative min-h-0 grow bg-background">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void handleSave();
					}}
					className="h-full"
				>
					<div className="invisible-scroll-y h-full overflow-y-auto px-8 pt-8 pb-28 md:px-10">
						<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
							<div>
								<h1 className="text-text-primary text-2xl font-semibold">Profile Settings</h1>
								<p className="text-text-muted mt-2 text-sm">
									Manage your account profile and avatar.
								</p>
							</div>

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
								label="Username"
								htmlFor="profile-username"
								error={errors.username}
								description="3-32 characters. Lowercase letters, numbers, and underscore only."
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
								label="Display name"
								htmlFor="profile-display-name"
								error={errors.displayName}
								description="Visible name shown to other users."
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

							<div className="text-text-muted flex items-center gap-2 text-sm">
								<ImagePlus className="size-4" />
								<span>Avatar updates are applied after pressing Save.</span>
							</div>
						</div>
					</div>

					<div className="border-border bg-surface absolute right-0 bottom-0 left-0 border-t px-8 py-4 md:px-10">
						<div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-3">
							<Button
								type="button"
								variant="secondary"
								onClick={handleDiscard}
								disabled={!hasUnsavedChanges || isSaving}
							>
								Discard
							</Button>
							<Button type="submit" loading={isSaving} disabled={!hasUnsavedChanges}>
								Save
							</Button>
						</div>
					</div>
				</form>
			</section>
		</div>
	);
}
