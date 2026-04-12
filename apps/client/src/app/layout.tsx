import './globals.css';
import { AuthSessionProvider } from '@/components/auth-session-provider';

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="zh-Hant">
			<body className="min-h-screen bg-background text-text-primary antialiased">
				<AuthSessionProvider>{children}</AuthSessionProvider>
			</body>
		</html>
	);
}
