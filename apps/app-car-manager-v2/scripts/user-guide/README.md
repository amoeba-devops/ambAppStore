# User Guide Screenshot Pipeline

Auto-captures annotated screenshots for the bilingual (vi / ko) user guide HTML
site published at `apps/web/public/docs/user-guide/`.

## Quick start

```powershell
# from apps/app-car-manager-v2/
cd scripts/user-guide

# one-time
npm install
npm run install:browsers

# every time UI changes
# (1) ensure dev server is running on localhost:3001 with DEMO_AUTO_LOGIN=true
# (2) ensure DB seed has been applied (cd ../.. && node scripts/db-seed.mjs dev)
npm run shots          # both locales, both devices
npm run shots:vi       # only vi
npm run shots:ko       # only ko
```

## How it works

```
Playwright (vi-desktop project) ─┐
                                 ├─► shots-output/raw/{vi,ko}/{section}/{slug}.png
Playwright (ko-desktop project) ─┘
                                                ↓
                                  annotate.ts (sharp + SVG overlay)
                                  reads shots/annotations/{slug}.shot.yml
                                                ↓
                  apps/web/public/docs/user-guide/assets/img/screenshots/
                                  {vi,ko}/{section}/{slug}.png   ← committed
```

- **One annotation spec covers both locales.** Layout is identical between
  `vi` and `ko` so the same arrow/number/box coordinates apply. Only the text
  baked into the screenshot changes.
- **Auth via `/dev-login`.** No mocking — Playwright drives the real route
  with `DEMO_AUTO_LOGIN=true`, which mints an HS256 JWT and sets the session
  cookie just like AMA SSO does in production.
- **Locale via cookie.** `NEXT_LOCALE` is set on the browser context *before*
  navigation so `next-intl` picks it up on the first server render.

## Adding a new shot

1. Pick a slug (kebab-case, prefix with step number): `05-tao-chuyen-di-buoc-2`.
2. Add a test in `shots/<section>.spec.ts`:
   ```ts
   await loginAs(page, { role: 'OWNER', next: '/trips/new' });
   await waitForReady(page);
   const rawPath = shotPath(RAW_OUT, locale, 'admin', '05-tao-chuyen-di-buoc-2');
   const published = shotPath(PUBLISHED_OUT, locale, 'admin', '05-tao-chuyen-di-buoc-2');
   await captureRaw(page, rawPath);
   const spec = await loadSpec(resolve(import.meta.dirname, 'annotations/05-tao-chuyen-di-buoc-2.shot.yml'));
   await applyAnnotations(rawPath, spec, published);
   ```
3. (Optional) Create `shots/annotations/<slug>.shot.yml` with arrows/numbers.
   If absent, the raw screenshot is published as-is.
4. Run `npm run shots`.
5. Commit the new files under `apps/web/public/docs/user-guide/assets/img/screenshots/`.

## Annotation primitives

```yaml
annotations:
  - { type: arrow,  from: [x1, y1], to: [x2, y2], color: '#FF3B30', width: 4 }
  - { type: number, at: [x, y], label: '1', color: '#3182F6', radius: 18 }
  - { type: box,    rect: [x, y, w, h], color: '#FF3B30', width: 3 }
  - { type: label,  at: [x, y], text: 'Bấm đây', color: '#FF3B30', size: 16 }
```

Coordinates are pixels from top-left of the viewport (1440×900 desktop,
390×844 mobile).
