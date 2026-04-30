import './globals.css';
import { AuthSessionProvider } from '@/components/auth-session-provider';

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="zh-Hant">
			<body className="bg-background text-text-primary min-h-screen antialiased">
				<AuthSessionProvider>{children}</AuthSessionProvider>
			</body>
		</html>
	);
}
