import { clearAccessToken, readAccessToken, writeAccessToken } from './auth-session';

const DEFAULT_API_ORIGIN = 'http://localhost:3000';
const API_PATH_PREFIX = '/api';

const normalizedApiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_ORIGIN).replace(
	/\/+$/,
	''
);
const apiOrigin = normalizedApiOrigin.endsWith(API_PATH_PREFIX)
	? normalizedApiOrigin.slice(0, -API_PATH_PREFIX.length)
	: normalizedApiOrigin;

const normalizeEndpoint = (endpoint: string): string => {
	const withLeadingSlash = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

	if (withLeadingSlash === API_PATH_PREFIX || withLeadingSlash.startsWith(`${API_PATH_PREFIX}/`)) {
		return withLeadingSlash;
	}

	return `${API_PATH_PREFIX}${withLeadingSlash}`;
};

export const getApiUrl = (endpoint: string): string => `${apiOrigin}${normalizeEndpoint(endpoint)}`;

export const getAssetUrl = (assetPath: string | null | undefined): string | undefined => {
	if (!assetPath) {
		return undefined;
	}

	if (/^https?:\/\//i.test(assetPath)) {
		return assetPath;
	}

	const normalizedAssetPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;

	return `${apiOrigin}${normalizedAssetPath}`;
};

interface ApiError {
	message: string;
	status: number;
}

interface ErrorResponse {
	error?: {
		message?: string;
	};
	message?: string;
}

interface RefreshResponse {
	accessToken?: string;
}

const REFRESH_ENDPOINT = '/auth/refresh';

const buildApiError = (status: number, responseText: string): ApiError => {
	const error: ApiError = {
		message: '發生錯誤，請稍後再試',
		status
	};

	if (responseText) {
		try {
			const data = JSON.parse(responseText) as ErrorResponse;

			if (typeof data.error?.message === 'string' && data.error.message.length > 0) {
				error.message = data.error.message;
			} else if (typeof data.message === 'string' && data.message.length > 0) {
				error.message = data.message;
			}
		} catch {
			// Use default error message.
		}
	}

	return error;
};

export class ApiClient {
	private refreshRequest: Promise<string> | null = null;

	private isAuthEndpoint(endpoint: string): boolean {
		return normalizeEndpoint(endpoint).startsWith(`${API_PATH_PREFIX}/auth/`);
	}

	private async refreshAccessToken(): Promise<string> {
		if (!this.refreshRequest) {
			this.refreshRequest = (async () => {
				const response = await fetch(getApiUrl(REFRESH_ENDPOINT), {
					method: 'POST',
					credentials: 'include'
				});
				const responseText = await response.text();

				if (!response.ok) {
					throw buildApiError(response.status, responseText);
				}

				let data: RefreshResponse | string = {};

				if (responseText) {
					try {
						data = JSON.parse(responseText) as RefreshResponse;
					} catch {
						data = responseText;
					}
				}

				if (!data || typeof data !== 'object' || typeof data.accessToken !== 'string') {
					throw new Error('刷新權杖回傳格式錯誤');
				}

				writeAccessToken(data.accessToken);
				return data.accessToken;
			})().finally(() => {
				this.refreshRequest = null;
			});
		}

		return this.refreshRequest;
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
		retriedAfterRefresh = false
	): Promise<T> {
		const response = await this.requestRaw(endpoint, options, retriedAfterRefresh);
		const responseText = await response.text();

		if (response.status === 204 || !responseText) {
			return undefined as T;
		}

		try {
			return JSON.parse(responseText) as T;
		} catch {
			return responseText as T;
		}
	}

	async post<T>(endpoint: string, data: unknown): Promise<T> {
		return this.request<T>(endpoint, {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	async get<T>(endpoint: string): Promise<T> {
		return this.request<T>(endpoint, {
			method: 'GET'
		});
	}

	async delete<T>(endpoint: string): Promise<T> {
		return this.request<T>(endpoint, {
			method: 'DELETE'
		});
	}

	async patch<T>(endpoint: string, data: unknown): Promise<T> {
		return this.request<T>(endpoint, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
	}

	async requestRaw(
		endpoint: string,
		options: RequestInit = {},
		retriedAfterRefresh = false
	): Promise<Response> {
		const url = getApiUrl(endpoint);
		const headers = new Headers(options.headers);
		const accessToken = readAccessToken();

		if (
			!headers.has('Content-Type') &&
			options.body !== undefined &&
			!(options.body instanceof FormData)
		) {
			headers.set('Content-Type', 'application/json');
		}

		if (accessToken && !headers.has('Authorization')) {
			headers.set('Authorization', `Bearer ${accessToken}`);
		}

		const response = await fetch(url, {
			...options,
			headers,
			credentials: 'include'
		});

		if (!response.ok) {
			const canRetryWithRefresh =
				response.status === 401 && !retriedAfterRefresh && !this.isAuthEndpoint(endpoint);

			if (canRetryWithRefresh) {
				try {
					const nextAccessToken = await this.refreshAccessToken();
					const retryHeaders = new Headers(options.headers);

					retryHeaders.delete('Authorization');
					retryHeaders.set('Authorization', `Bearer ${nextAccessToken}`);

					if (
						!retryHeaders.has('Content-Type') &&
						options.body !== undefined &&
						!(options.body instanceof FormData)
					) {
						retryHeaders.set('Content-Type', 'application/json');
					}

					return this.requestRaw(
						endpoint,
						{
							...options,
							headers: retryHeaders
						},
						true
					);
				} catch {
					clearAccessToken();
				}
			} else if (response.status === 401) {
				clearAccessToken();
			}

			const responseText = await response.text();
			throw buildApiError(response.status, responseText);
		}

		return response;
	}
}

export const api = new ApiClient();
