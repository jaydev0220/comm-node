'use client';

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode
} from 'react';
import { api } from '@/lib/api';
import { clearAccessToken, readAccessToken, subscribeAuthSession, writeAccessToken } from '@/lib/auth-session';
import type { User } from '@/lib/api-types';

type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface AuthSessionContextValue {
	status: AuthStatus;
	user: User | null;
	accessToken: string | null;
	isAuthenticated: boolean;
	setAccessToken: (accessToken: string) => void;
	clearAccessToken: () => void;
	reloadSession: () => void;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

interface AuthSessionState {
	status: AuthStatus;
	user: User | null;
	accessToken: string | null;
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<AuthSessionState>({
		status: 'loading',
		user: null,
		accessToken: null
	});
	const syncVersionRef = useRef(0);

	const syncSession = useCallback(async () => {
		const syncVersion = ++syncVersionRef.current;
		const accessToken = readAccessToken();

		if (!accessToken) {
			if (syncVersion === syncVersionRef.current) {
				setSession({
					status: 'anonymous',
					user: null,
					accessToken: null
				});
			}

			return;
		}

		if (syncVersion === syncVersionRef.current) {
			setSession({
				status: 'loading',
				user: null,
				accessToken
			});
		}

		try {
			const user = await api.get<User>('/users/me');

			if (syncVersion !== syncVersionRef.current) {
				return;
			}

			setSession({
				status: 'authenticated',
				user,
				accessToken
			});
		} catch {
			if (syncVersion !== syncVersionRef.current) {
				return;
			}

			setSession({
				status: 'anonymous',
				user: null,
				accessToken: null
			});
		}
	}, []);

	useEffect(() => {
		const bootstrapSession = window.setTimeout(() => {
			void syncSession();
		}, 0);

		const unsubscribe = subscribeAuthSession(() => {
			void syncSession();
		});

		return () => {
			window.clearTimeout(bootstrapSession);
			unsubscribe();
		};
	}, [syncSession]);

	const contextValue = useMemo<AuthSessionContextValue>(
		() => ({
			...session,
			isAuthenticated: session.status === 'authenticated',
			setAccessToken: writeAccessToken,
			clearAccessToken,
			reloadSession: () => {
				void syncSession();
			}
		}),
		[session, syncSession]
	);

	return <AuthSessionContext.Provider value={contextValue}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
	const context = useContext(AuthSessionContext);

	if (!context) {
		throw new Error('useAuthSession must be used within AuthSessionProvider');
	}

	return context;
}
