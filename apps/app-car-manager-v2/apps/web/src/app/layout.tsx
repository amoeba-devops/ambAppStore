import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Inter, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { SWRegister } from '@/components/pwa/sw-register';
import './globals.css';

/* Self-hosted via next/font (no CDN at runtime).
 * Pretendard is loaded via the `pretendard` npm package in globals.css. */
const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});
const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

/* The Tailwind `font-sans` stack reads `--font-sans` first. We let Pretendard
 * (loaded from CSS) own that variable for Korean rendering, but fall back to
 * Inter / Be Vietnam Pro through next/font for Latin/VN. */
const fontVariables = `${inter.variable} ${beVietnam.variable} ${jetbrainsMono.variable}`;

/* basePath handling: Next.js auto-prefixes the `manifest` href when rendering
 * `<link rel="manifest" ...>`, but does NOT prefix `icons.icon` / `icons.apple`.
 * Without the manual prefix below the `<link rel="icon">` tags 404 on the
 * staging Docker deploy (basePath = `/app-car-manager-v2`). */
const basePath = process.env.BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'Fleet — Company Car Management',
  description: 'Dispatch & cost control for company vehicles',
  applicationName: 'Fleet',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fleet',
  },
  icons: {
    icon: `${basePath}/icons/icon-192.png`,
    apple: `${basePath}/icons/apple-touch-icon-180.png`,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#3182f6',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    /* suppressHydrationWarning here mutes the noise from browser extensions
     * (Bitdefender, Grammarly, password managers) that inject attributes like
     * `bis_skin_checked` / `__processed_*` post-SSR. It does NOT mask real
     * hydration bugs deeper in the tree. */
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <SWRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
