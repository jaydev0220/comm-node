import { clearAccessToken, readAccessToken } from './auth-session';

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

	if (
		withLeadingSlash === API_PATH_PREFIX ||
		withLeadingSlash.startsWith(`${API_PATH_PREFIX}/`)
	) {
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

export class ApiClient {
	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const url = getApiUrl(endpoint);
		const headers = new Headers(options.headers);
		const accessToken = readAccessToken();

		headers.set('Content-Type', 'application/json');

		if (accessToken && !headers.has('Authorization')) {
			headers.set('Authorization', `Bearer ${accessToken}`);
		}

		const response = await fetch(url, {
			...options,
			headers,
			credentials: 'include'
		});

		const responseText = await response.text();

		if (!response.ok) {
			const error: ApiError = {
				message: '發生錯誤，請稍後再試',
				status: response.status
			};

			if (response.status === 401) {
				clearAccessToken();
			}

			if (responseText) {
				try {
					const data = JSON.parse(responseText) as Partial<{ message?: string }>;

					if (typeof data.message === 'string' && data.message.length > 0) {
						error.message = data.message;
					}
				} catch {
					// Use default error message.
				}
			}

			throw error;
		}

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
}

export const api = new ApiClient();
