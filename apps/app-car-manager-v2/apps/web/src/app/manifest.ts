import type { MetadataRoute } from 'next';

/* Web App Manifest for installable PWA.
 *
 * Next.js Metadata API serves this file at `${basePath}/manifest.webmanifest`
 * and auto-prefixes the `<link rel="manifest" href="...">` in rendered HTML —
 * BUT the body of this manifest is emitted as-is. The browser resolves the
 * paths inside RELATIVE TO the manifest URL per W3C spec, and a bare `/`
 * resolves to the origin root (not to `${basePath}/`). On the staging Docker
 * deploy (basePath = `/app-car-manager-v2`) that lands the PWA at the wrong
 * place and 404s the icons.
 *
 * So we read BASE_PATH at build time and prefix every path manually.
 *   - Render / local:    BASE_PATH = "" → start_url "/", icons "/icons/..."
 *   - Staging Docker:    BASE_PATH = "/app-car-manager-v2"
 *                        → start_url "/app-car-manager-v2/", icons under prefix
 *
 * Brand colours mirror the Toss-style palette in globals.css:
 *   background_color = --bg dark base (#0a0d10)
 *   theme_color      = --accent (Toss blue #3182f6)
 */
export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.BASE_PATH ?? '';

  return {
    name: 'Fleet — Company Car Management',
    short_name: 'Fleet',
    description: 'Dispatch & cost control for company vehicles',
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0d10',
    theme_color: '#3182f6',
    lang: 'vi',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: `${basePath}/icons/icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icons/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icons/icon-maskable-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
