# Shorter — Design System

> Get a hair cut, wherever, whenever.

Source of truth for Shorter's visual identity. Derived from `Shorter_BRANDKIT.pdf`.
Contact: Armen@getshorter.app

## Brand

- **Name:** Shorter
- **Tagline:** Get a hair cut, wherever, whenever
- **Mark:** two crossed clipper loops (`public/brand/shorter-lockup.png`, React: `src/components/ShorterLogo.tsx`)
- **Lockup:** mark + wordmark, left-aligned, gap = 0.25× mark height
- **Surfaces:** app store, website, advertising, flyers, content

## Color

The palette is deliberately monochrome. Do not introduce a hue accent — contrast and
typography carry the hierarchy.

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#000000` | logo, primary buttons, active states, headings |
| `--color-on-primary` | `#FFFFFF` | content on black |
| `--color-ink` | `#1C1B1F` | body text |
| `--color-muted` | `#A09CAB` | secondary text, placeholders |
| `--color-surface` | `#F2F1FA` | app background |
| `--color-surface-2` | `#FAFAFF` | raised cards |
| `--color-border` | `#D4D2E3` | hairlines, input borders |

Black on white and white on black both clear WCAG AAA. Never place `--color-muted` on
`--color-surface-2` for body copy — reserve it for ≥14px secondary labels.

Tokens live in `src/index.css` under `@theme` (Tailwind v4) and are mirrored in
`tailwind.config.js`.

## Typography

- **Header:** Canva Sans (brand kit). Web/app substitute in use: **Plus Jakarta Sans**
  (700/800) — closest available geometric sans with the same open counters.
- **Body:** Plus Jakarta Sans 400/500.
- Scale (px / line-height): 10/14, 12/16, 14/20, 16/24, 18/28, 20/28, 24/32.
- Headings use `tracking-tight`; body uses default tracking.

## Shape & depth

- Radius: `card` 12px, `pill` 999px, hero cards 2.5rem.
- Shadows are soft and neutral (`0 2px 8px rgba(0,0,0,.04)` → `0 12px 32px rgba(0,0,0,.16)`);
  never colored.

## Logo usage

- Minimum clear space around the mark = 0.5× mark height.
- Only black on light or white on dark. No gradients, outlines, or recolors.
- Minimum mark size: 20px. Below that, use the mark alone (drop the wordmark).
- Pick the `tone` that matches the surface (`light` on black, `dark` on white) — never recolor the artwork in CSS.

## Assets

All artwork is the original brand-kit files (trimmed to content, white made
transparent) — never a redraw. Each ships black (for light surfaces) and white
(for black surfaces).

| File | Use |
|---|---|
| `public/brand/shorter-mark.png` / `-white.png` | motif only — app tiles, avatars |
| `public/brand/shorter-lockup.png` / `-white.png` | motif + wordmark — primary logo |
| `public/brand/shorter-wordmark.png` / `-white.png` | wordmark only |
| `public/brand/shorter-icon-512.png` | favicon, apple-touch-icon, app icon |
| `public/brand/shorter-mark-1080.png` | untouched 1080×1080 original |

React: `ShorterMark`, `ShorterLogo`, `ShorterWordmark` in
`src/components/ShorterLogo.tsx`, each taking `tone="dark" | "light"`.
