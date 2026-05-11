---
title: Design Tokens
description: Tailwind theme — color palette, spacing scale, typography, shadows. Single source for visual consistency.
load-when: Before adding any UI styling / extending Tailwind config / debating "what color/spacing should I use?"
status: skeleton
---

# Design Tokens

> Skeleton — fill exact hex/rem values khi extract từ prototype (Figma Make bundle).

## 1. Color palette (TODO from prototype)

```
TODO: extract từ prototype CSS
- Primary brand: ? (FIRGI brand color)
- Surface (background): light / dark
- Foreground (text): primary / secondary / muted
- Status: success (green), warning (orange), error (red), info (blue)
- Chart: 4-6 distinct colors cho Recharts
```

Tailwind config approach:
```ts
// tailwind.config.ts
TODO: extend theme.colors
```

## 2. Spacing scale

Theo Tailwind default (4px base): `0`, `0.5` (2px), `1` (4px), `2` (8px), ... `96` (24rem).

```
TODO: confirm prototype dùng default hay custom
```

## 3. Typography

```
TODO: từ prototype scan thấy "Geist Mono, monospace" + Plus Jakarta Sans
- font-display: Plus Jakarta Sans (heading)
- font-body: Plus Jakarta Sans (body)
- font-mono: Geist Mono (numbers, code, IDs)
```

Scale (Tailwind):
- `text-xs` (12px) — captions, helper text
- `text-sm` (14px) — body default
- `text-base` (16px) — emphasis
- `text-lg` (18px) — section header
- `text-xl` ~ `text-4xl` — page hero

## 4. Number formatting (critical for FIRGI)

Use `Intl.NumberFormat` không phải Tailwind:

```
TODO: code helpers
- formatVND(value): "1.234.567 ₫" (vi-VN locale)
- formatKRW(value): "₩123,456" (ko-KR locale)
- formatPercent(value): "30.25%" (2 decimal)
- formatRatio(value): "0.057" (3 decimal)
```

Display in `font-mono` cho alignment trong tables.

## 5. Spacing tokens (component-specific)

```
TODO: chốt sau khi xem prototype browser
- Page padding: ? 
- Card padding: ?
- Table cell padding: ?
- Form field gap: ?
```

## 6. Shadow / elevation

```
TODO:
- Card: shadow-sm
- Modal: shadow-lg
- Sticky header: shadow-md
```

## 7. Radius

```
TODO:
- Card: rounded-lg
- Button: rounded-md
- Input: rounded-md
- Avatar: rounded-full
```

## 8. Anti-patterns ❌

- ❌ Inline style (`style={{ color: ... }}`)
- ❌ Hard-code hex màu trong JSX (`text-[#1234ab]`) — extend theme
- ❌ Custom font import outside Geist Mono + Plus Jakarta Sans
- ❌ Format số bằng `.toLocaleString()` không có locale param — phải explicit

## See also

- [_INDEX.md](_INDEX.md)
- Prototype assets trong [FIRGI Sales Ops _standalone_.html](../../FIRGI%20Sales%20Ops%20_standalone_.html)
