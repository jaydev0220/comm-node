import type { ReactNode } from 'react';
import { PublicAuthOnly } from '@/components/auth-guards';

interface AuthLayoutProps {
	children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
	return <PublicAuthOnly>{children}</PublicAuthOnly>;
}
