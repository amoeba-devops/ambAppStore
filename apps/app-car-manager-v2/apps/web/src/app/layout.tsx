import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Inter, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
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
  /* Read the sticky-workspace cookie server-side so the initial SSR HTML
   * already carries data-dept="truck" when the user last left the truck
   * workspace. DeptThemeEffect keeps it in sync on client navigations.
   * suppressHydrationWarning on <html> handles the case where cookie + client
   * state diverge (e.g. a different user logs in). */
  const jar = await cookies();
  const dataDept = jar.get('ccms.fleet.dept')?.value === 'TRUCK' ? 'truck' : undefined;

  return (
    /* suppressHydrationWarning trên <html> + <body> mute noise của browser
     * extension (Bitdefender, Grammarly, ...) chèn attributes như
     * `bis_skin_checked` / `__processed_*` post-SSR.
     *
     * Previous attempt: thêm inline cleanup <script> nhưng Bitdefender chính
     * nó REPLACE script content bằng chrome-extension URL → cleanup không
     * chạy + tạo thêm 1 hydration warning trên <script> tag → tệ hơn.
     *
     * Hydration warning về nested `<div hidden bis_skin_checked>` (trong
     * Next.js metadata boundary) là COSMETIC dev-only noise — không break
     * functionality. Production users không có extension này sẽ không thấy.
     * Tài liệu trong README §10 troubleshooting để dev local biết cách bỏ
     * qua (Bitdefender → Safe Browsing → whitelist localhost). */
    <html lang={locale} className={fontVariables} data-dept={dataDept} suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <SWRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
