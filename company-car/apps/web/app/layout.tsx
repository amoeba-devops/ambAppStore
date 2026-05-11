import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Company Car',
  description: 'Company Car Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
