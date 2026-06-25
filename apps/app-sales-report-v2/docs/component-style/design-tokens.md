---
title: Design Tokens
description: Tailwind theme — color palette, spacing, typography, shadows. Extracted từ FIRGI prototype.
load-when: Before adding any UI styling / extending Tailwind config / debating "what color/spacing should I use?"
status: ready
---

# Design Tokens

> Extracted từ `FIRGI Sales Ops _standalone_.html` prototype (Figma Make bundle, decoded gzip+base64).
> Aesthetic: warm-cream Notion/Anthropic-style + monospace numbers cho financial tables.

## 1. Color palette

### 1.1 Neutrals (warm-tinted, KHÔNG dùng cool gray)

| Token | Hex | Usage |
|---|---|---|
| `neutral-50` | `#fafaf8` | App background (lightest) |
| `neutral-100` | `#f6f4ef` | Page background ⭐ primary canvas |
| `neutral-150` | `#f0efec` | Card background / hover state |
| `neutral-200` | `#ececea` | Divider / inactive border |
| `neutral-300` | `#dcdad5` | Border default |
| `neutral-400` | `#a8a6a0` | Placeholder text |
| `neutral-500` | `#87867f` | Muted text ⭐ |
| `neutral-600` | `#5c5b58` | Secondary text |
| `neutral-700` | `#3d3c3a` | Body text default |
| `neutral-800` | `#29261b` | Heading dark ⭐ |
| `neutral-900` | `#131313` | Primary text/heading ⭐ |
| `neutral-950` | `#0e0e0c` | Maximum contrast |

### 1.2 Brand accent (warm orange)

| Token | Hex | Usage |
|---|---|---|
| `accent-50` | `#fdf5ee` | Accent background tint |
| `accent-100` | `#f9e3ce` | Hover tint |
| `accent-500` | `#d97757` | Primary accent ⭐ (buttons, focus ring, brand) |
| `accent-600` | `#c5634a` | Hover state |
| `accent-700` | `#a85540` | Active state |

### 1.3 Semantic status

| Token | Hex | Usage |
|---|---|---|
| `success-500` | `#15803d` | Positive WoW indicator ▲ |
| `success-50` | `#dcfce7` | Success bg tint |
| `error-500` | `#b91c1c` | Negative WoW indicator ▼ |
| `error-50` | `#fee2e2` | Error bg tint |
| `warning-500` | `#b45309` | Warning (loss alert) |
| `warning-50` | `#fef3c7` | Warning bg tint |
| `info-500` | `#2a6fdb` | Info badge |
| `info-50` | `#dbeafe` | Info bg tint |

### 1.4 Platform brand (badges only, không dùng làm UI)

| Token | Hex | Source |
|---|---|---|
| `shopee` | `#ee4d2d` | Shopee brand orange |
| `tiktok` | `#fe2c55` | TikTok brand pink |

### 1.5 CTA / link (secondary)

| Token | Hex | Usage |
|---|---|---|
| `indigo-500` | `#4f46e5` | Link / interactive secondary |

## 2. Typography

### 2.1 Fonts

| Token | Family | Usage |
|---|---|---|
| `font-sans` | Plus Jakarta Sans | Body, heading, UI text default |
| `font-mono` | Geist Mono | Numbers (VND/KRW), SKU codes, IDs ⭐ |

CSS load qua `@next/font/google` hoặc `<link>` trong `layout.tsx`.

### 2.2 Scale

| Token | Size | Line | Usage |
|---|---|---|---|
| `text-xs` | 12px | 16px | Caption, helper, badge |
| `text-sm` | 14px | 20px | Body default ⭐ |
| `text-base` | 16px | 24px | Emphasis body |
| `text-lg` | 18px | 28px | Card title |
| `text-xl` | 20px | 28px | Section heading |
| `text-2xl` | 24px | 32px | Page heading |
| `text-3xl` | 30px | 36px | KPI value |
| `text-4xl` | 36px | 40px | Hero stat |

### 2.3 Weight

| Token | Weight | Usage |
|---|---|---|
| `font-normal` | 400 | Body |
| `font-medium` | 500 | Labels, emphasis |
| `font-semibold` | 600 | Headings ⭐ |
| `font-bold` | 700 | Strong emphasis only |

## 3. Spacing scale (Tailwind default)

4px base. Use sparingly:
- `1` = 4px (icon gap)
- `2` = 8px (compact)
- `3` = 12px (form field gap)
- `4` = 16px (card padding default ⭐)
- `6` = 24px (section gap)
- `8` = 32px (page section gap)
- `12` = 48px (hero spacing)

## 4. Border radius

| Token | Value | Usage |
|---|---|---|
| `rounded-sm` | 2px | Inline tags |
| `rounded` | 4px | Inputs, small buttons |
| `rounded-md` | 6px | Buttons ⭐, inputs |
| `rounded-lg` | 8px | Cards ⭐, modals |
| `rounded-xl` | 12px | Featured cards, hero |
| `rounded-full` | 9999px | Avatars, badges |

## 5. Shadow

| Token | Usage |
|---|---|
| `shadow-sm` | Inactive cards, subtle elevation |
| `shadow` | Default cards ⭐ |
| `shadow-md` | Sticky header, dropdown |
| `shadow-lg` | Modals, popovers |
| `shadow-none` | Flat (inside cards) |

Custom in prototype:
- `rgba(0,0,0,0.06)` — subtle
- `rgba(0,0,0,0.12)` — default
- `rgba(41,38,27,0.45)` — warm-tinted strong

## 6. Number formatting (financial — critical for FIRGI)

```ts
// In packages/ui/src/format.ts (or inline in @v2/web/src/lib/format.ts)
export const fmtVND = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
export const fmtKRW = (n: number) => '₩' + new Intl.NumberFormat('ko-KR').format(Math.round(n));
export const fmtPct = (n: number) => (n * 100).toFixed(2) + '%';
export const fmtRatio = (n: number) => n.toFixed(4);
```

UI render: `<span className="font-mono tabular-nums">{fmtVND(value)}</span>` (`tabular-nums` để align trong tables).

## 7. WoW/MoM indicator

| State | Display | Class |
|---|---|---|
| Positive (current > prev) | `▲ +12.34%` | `text-success-500` |
| Negative | `▼ -8.12%` | `text-error-500` |
| Zero | `─ 0.00%` | `text-neutral-500` |
| First period (no prev) | `----` | `text-neutral-400` |
| Prev was zero | `N/A` | `text-neutral-400` |

## 8. Sidebar / Header layout (extracted from prototype)

### Sidebar
- Width: `w-60` (240px) desktop, hidden under sm breakpoint (mobile drawer)
- Background: `bg-neutral-100` (#f6f4ef warm cream)
- Border: `border-r border-neutral-200`
- Padding: `p-4`
- Logo top: `font-mono text-sm font-semibold tracking-tight`
- Nav items: `text-sm py-1.5 px-2 rounded hover:bg-neutral-150`
- Active item: `bg-neutral-200 font-medium text-neutral-900`
- Section labels: `text-xs uppercase tracking-wider text-neutral-500 mt-6 mb-2`

### Header
- Height: `h-14` (56px)
- Background: `bg-white border-b border-neutral-200`
- Padding: `px-6`
- Layout: `flex items-center justify-between`
- Left: breadcrumb or page title `text-base font-semibold`
- Right: user menu + period picker slot

## 9. Anti-patterns ❌

- ❌ Cool gray (`gray-*` / `slate-*`) — dùng `neutral-*` warm-tinted
- ❌ `text-[#1234ab]` inline arbitrary — phải qua theme tokens
- ❌ Number trong `font-sans` không có `tabular-nums` — bị misalign trong tables
- ❌ `.toLocaleString()` không locale arg — không consistent
- ❌ Mix Shopee/TikTok brand colors trong UI thường — chỉ dùng cho channel badge

## 10. Tailwind config implementation

Xem [apps/web/tailwind.config.ts](../../apps/web/tailwind.config.ts) — extend theme với tokens ở §1-2.

## See also

- [_INDEX.md](_INDEX.md)
- Prototype browser: [FIRGI Sales Ops _standalone_.html](../../FIRGI%20Sales%20Ops%20_standalone_.html)
- [page-template.md](page-template.md)
