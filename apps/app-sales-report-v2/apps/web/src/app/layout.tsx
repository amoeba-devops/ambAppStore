import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FIRGI Sales Report',
  description: 'Sales Performance & Prime Cost Management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
