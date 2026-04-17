import { RequireAuth } from '@/components/auth-guards';

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return <RequireAuth>{children}</RequireAuth>;
}
