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

interface ApiError {
	message: string;
	status: number;
}

export class ApiClient {
	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const url = getApiUrl(endpoint);

		const response = await fetch(url, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			},
			credentials: 'include'
		});

		if (!response.ok) {
			const error: ApiError = {
				message: '發生錯誤，請稍後再試',
				status: response.status
			};

			try {
				const data = await response.json();
				if (data.message) {
					error.message = data.message;
				}
			} catch {
				// Use default error message
			}

			throw error;
		}

		return response.json();
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
}

export const api = new ApiClient();
