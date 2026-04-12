const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';

type AuthSessionListener = () => void;

const authSessionListeners = new Set<AuthSessionListener>();

const canUseSessionStorage = (): boolean => typeof window !== 'undefined';

const notifyAuthSessionListeners = (): void => {
	for (const listener of authSessionListeners) {
		listener();
	}
};

export const readAccessToken = (): string | null => {
	if (!canUseSessionStorage()) {
		return null;
	}

	try {
		return window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
	} catch {
		return null;
	}
};

export const writeAccessToken = (accessToken: string): void => {
	if (!canUseSessionStorage()) {
		return;
	}

	try {
		const currentAccessToken = window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);

		if (currentAccessToken === accessToken) {
			return;
		}

		window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
		notifyAuthSessionListeners();
	} catch {
		// Session storage is unavailable or full; ignore and keep the session unchanged.
	}
};

export const setAccessToken = writeAccessToken;

export const clearAccessToken = (): void => {
	if (!canUseSessionStorage()) {
		return;
	}

	try {
		if (window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) === null) {
			return;
		}

		window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
		notifyAuthSessionListeners();
	} catch {
		// Session storage is unavailable; ignore and keep the session unchanged.
	}
};

export const subscribeAuthSession = (listener: AuthSessionListener): (() => void) => {
	authSessionListeners.add(listener);

	return () => {
		authSessionListeners.delete(listener);
	};
};
