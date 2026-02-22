# Dark Mode Design — DiveStreams v2

## Overview

Add system-preference-driven dark mode support across all 4 layouts (tenant dashboard, admin dashboard, public site, account) using a CSS-only approach with semantic design tokens. No JavaScript toggle — the OS `prefers-color-scheme` media query handles everything.

## Approach & Architecture

### CSS-Only, Three Layers

1. **Foundation** — Semantic CSS custom properties defined once in `app.css`, toggled via `@media (prefers-color-scheme: dark)`
2. **Layouts & Components** — All 4 layouts and 12 UI components reference tokens instead of hardcoded Tailwind colors
3. **Public Site Themes** — Each of the 5 existing presets (Ocean, Tropical, Minimal, Dark, Classic) gains a dark variant through CSS variable overrides

### Why CSS-Only

- Zero JS bundle impact
- No flash of wrong theme (variables resolve before paint)
- No hydration mismatch in SSR
- Works with Tailwind v4's native `@media` support
- Simpler than maintaining a toggle + localStorage + cookie sync

## Semantic Token System

All tokens defined in `:root` with dark overrides in `@media (prefers-color-scheme: dark)`.

### Surface Tokens (Backgrounds)

| Token | Light | Dark |
|---|---|---|
| `--surface` | `#ffffff` (white) | `#030712` (gray-950) |
| `--surface-raised` | `#ffffff` (white + shadow) | `#111827` (gray-900) |
| `--surface-inset` | `#f9fafb` (gray-50) | `#1f2937` (gray-800) |
| `--surface-overlay` | `#f3f4f6` (gray-100) | `#1f2937` (gray-800) |

### Foreground Tokens (Text)

| Token | Light | Dark |
|---|---|---|
| `--foreground` | `#111827` (gray-900) | `#f3f4f6` (gray-100) |
| `--foreground-muted` | `#6b7280` (gray-500) | `#9ca3af` (gray-400) |
| `--foreground-subtle` | `#9ca3af` (gray-400) | `#4b5563` (gray-600) |

### Border Tokens

| Token | Light | Dark |
|---|---|---|
| `--border` | `#e5e7eb` (gray-200) | `#374151` (gray-700) |
| `--border-strong` | `#d1d5db` (gray-300) | `#4b5563` (gray-600) |

### Brand Tokens

| Token | Light | Dark |
|---|---|---|
| `--brand` | `#2563eb` (blue-600) | `#3b82f6` (blue-500) |
| `--brand-hover` | `#1d4ed8` (blue-700) | `#2563eb` (blue-600) |
| `--brand-muted` | `#eff6ff` (blue-50) | `#172554` (blue-950) |

### Semantic Tokens

| Token | Light | Dark |
|---|---|---|
| `--danger` | `#dc2626` (red-600) | `#ef4444` (red-500) |
| `--danger-muted` | `#fef2f2` (red-50) | `#450a0a` (red-950) |
| `--success` | `#16a34a` (green-600) | `#22c55e` (green-500) |
| `--success-muted` | `#f0fdf4` (green-50) | `#052e16` (green-950) |
| `--warning` | `#d97706` (amber-600) | `#f59e0b` (amber-500) |
| `--warning-muted` | `#fffbeb` (amber-50) | `#451a03` (amber-950) |

## Layout Changes

### Tenant Dashboard (`routes/tenant/layout.tsx`)

- Sidebar: `bg-white` → `bg-[var(--surface)]`, `border-gray-200` → `border-[var(--border)]`
- Active nav: `bg-blue-50 text-blue-600` → `bg-[var(--brand-muted)] text-[var(--brand)]`
- Inactive nav: `text-gray-600` → `text-[var(--foreground-muted)]`
- Content area: `bg-gray-100` → `bg-[var(--surface-inset)]`
- Cards: `bg-white` → `bg-[var(--surface-raised)]`

### Admin Dashboard (`routes/admin/layout.tsx`)

Same token swaps as tenant. The dark header bar (`bg-gray-900`) remains unchanged — it already works in both modes. Only the content area below it changes.

### Public Site (`routes/site/_layout.tsx`)

Already uses CSS variables for theming. Extended with dark-mode counterparts per theme preset via `@media (prefers-color-scheme: dark)` blocks. No structural changes.

### Account Layout (`routes/site/account/_layout.tsx`)

Inherits from public site layout. Inner sidebar nav needs token swaps: `bg-gray-50` → `bg-[var(--surface-inset)]`, `text-gray-700` → `text-[var(--foreground)]`.

## UI Component Updates

All 12 components in `app/components/ui/` follow the same mechanical substitution:

| Hardcoded Class | Token Class |
|---|---|
| `bg-white` | `bg-[var(--surface)]` or `bg-[var(--surface-raised)]` |
| `bg-gray-50` | `bg-[var(--surface-inset)]` |
| `bg-gray-100` | `bg-[var(--surface-overlay)]` |
| `text-gray-900` | `text-[var(--foreground)]` |
| `text-gray-500`, `text-gray-600` | `text-[var(--foreground-muted)]` |
| `text-gray-400` | `text-[var(--foreground-subtle)]` |
| `border-gray-200` | `border-[var(--border)]` |
| `border-gray-300` | `border-[var(--border-strong)]` |
| `bg-blue-600` | `bg-[var(--brand)]` |
| `hover:bg-blue-700` | `hover:bg-[var(--brand-hover)]` |
| `bg-red-50 text-red-600` | `bg-[var(--danger-muted)] text-[var(--danger)]` |
| `bg-green-50 text-green-600` | `bg-[var(--success-muted)] text-[var(--success)]` |
| `focus:ring-blue-500` | `focus:ring-[var(--brand)]` |

No logic changes in any component.

## Public Site Theme Dark Variants

Each of the 5 presets gains `darkOverrides` in `lib/themes/public-site-themes.ts`:

| Theme | Light BG | Dark BG | Primary | Dark Card BG |
|---|---|---|---|---|
| **Ocean** | white | gray-950 | blue-600 (both) | gray-900 |
| **Tropical** | white | gray-950 | emerald-600 (both) | gray-900 |
| **Minimal** | gray-50 | gray-950 | gray-800 / gray-200 | gray-900 |
| **Dark** | gray-900 | gray-950 | cyan-400 (both) | gray-800 |
| **Classic** | white | gray-950 | indigo-600 (both) | gray-900 |

The `getThemeStyles()` function gains a `darkOverrides` object per preset. The site layout renders both inline light variables and a `<style>` block with `@media (prefers-color-scheme: dark)` overrides.

## Implementation Steps

1. **Foundation tokens in `app.css`** — Define all semantic CSS custom properties in `:root` + dark media query overrides (~40 lines)
2. **Register tokens with Tailwind v4** — Add to `@theme` block for utility class access
3. **Update 4 layouts** — Swap hardcoded colors for token references
4. **Update 12 UI components** — Mechanical class substitution using mapping table
5. **Public site theme dark variants** — Add `darkOverrides` to 5 presets, update site layout rendering
6. **Verify** — Toggle macOS system appearance to confirm all layouts respond correctly

## Visual References

- Token palette preview: `docs/dark-mode-tokens-preview.html`
- Theme dark variants preview: `docs/dark-mode-themes-preview.html`
