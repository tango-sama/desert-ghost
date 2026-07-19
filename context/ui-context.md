# UI Context

## Theme

Two distinct themes, deliberately different:

- **Storefront — light only.** "Blush Rose & Gold": a warm, feminine wellness look — cream backgrounds, rose and gold accents, soft rose-tinted shadows. No dark mode.
- **Admin panel (`amelhadj.html`) — dark by default**, with an optional light mode toggled by the owner (`ds_theme` in localStorage adds `html.light`). Deep plum-brown surfaces with the same rose/gold accents.

Everything is RTL Arabic (`<html lang="ar" dir="rtl">`). All colors are CSS custom properties — storefront tokens in `css/theme.css` `:root`, admin tokens in the `<style>` block of `amelhadj.html`. Components must use the tokens; no new hardcoded hex values for anything that has one.

## Storefront Colors (`css/theme.css`)

| Role              | CSS Variable  | Value                                     |
| ----------------- | ------------- | ----------------------------------------- |
| Page background   | `--bg`        | `#FFF7F4` (warm cream)                    |
| Card surface      | `--bg-2`      | `#FFFFFF`                                 |
| Soft surface      | `--bg-3`      | `#FBEEEA` (soft beige)                    |
| Primary text      | `--ink`       | `#3A2A30` (near-black plum)               |
| Muted text        | `--ink-2`     | `#6E5B61`                                 |
| Faint text        | `--ink-3`     | `#A18C92`                                 |
| Hairline border   | `--line`      | `#F0DBE0`                                 |
| Tinted border     | `--line-2`    | `rgba(200,84,111,.12)`                    |
| Brand rose        | `--rose`      | `#E0728C`                                 |
| Deep rose         | `--rose-deep` | `#C8546F`                                 |
| Light rose        | `--rose-soft` | `#F3B4C2`                                 |
| Rose tint bg      | `--rose-tint` | `#FCE9EE`                                 |
| Warm gold         | `--gold`      | `#D9A86C`                                 |
| Gold light        | `--gold-light`| `#E8C79A`                                 |
| Gold tint bg      | `--gold-soft` | `#F7EDDD`                                 |
| Card shadow       | `--shadow`    | rose-tinted, soft (`rgba(224,114,140,…)`) |
| Large shadow      | `--shadow-lg` | `0 22px 50px rgba(224,114,140,.20)`       |
| WhatsApp green    | (literal)     | `#25D366` — only allowed brand literal    |

Signature gradients: brand name and section accents run `linear-gradient(135deg, var(--rose-deep), var(--gold))`; underlines run gold→rose. The page body carries a fixed radial blush gradient; `.bg-glow` adds fixed rose/gold radial glows behind content.

## Admin Panel Colors (`amelhadj.html`)

| Role            | CSS Variable | Value                       |
| --------------- | ------------ | --------------------------- |
| Page background | `--bg`       | `#1B1419`                   |
| Card surface    | `--card`     | `#241A20`                   |
| Elevated / input| `--card-2`   | `#2E222A`                   |
| Border          | `--border`   | `#3A2C34`                   |
| Primary text    | `--ink`      | `#F5EDF0`                   |
| Secondary text  | `--ink-2`    | `#C9B6BF`                   |
| Muted text      | `--ink-3`    | `#9A8590`                   |
| Brand rose/gold | `--rose` / `--rose-deep` / `--gold` | same hues as storefront |
| Success         | `--green`    | `#22c55e`                   |
| Danger          | `--danger`   | `#E5484D`                   |
| Info            | `--blue`     | `#5B8DEF`                   |

Toggle buttons (carriers, WhatsApp) are green when enabled, `--card-2`/muted when disabled. Status banners use translucent state colors (e.g. `rgba(34,197,94,.12)` background with a light green text).

## Typography

| Role         | Font                        | Notes                                  |
| ------------ | --------------------------- | -------------------------------------- |
| All text     | Cairo (Tajawal fallback)    | `--sans`, Google Fonts, weights 400–900 |
| Serif slot   | Tajawal                     | `--serif` (rarely used)                |

- Arabic-first: generous `line-height: 1.7`, heavy weights (700–900) for headings and buttons.
- Numbers, phones, and prices must stay LTR inside RTL text: wrap with `.ltr` or `.num` (`.num` also sets tabular figures). Use `<bdi>` for mixed-direction fragments.
- Small labels use uppercase Latin with wide `letter-spacing` (e.g. `.brand-sub`, badges).

## Border Radius

Radius scale — pills for interactive elements, generous rounding that shrinks with depth:

| Context                          | Radius          |
| -------------------------------- | --------------- |
| Buttons, badges, chips, toasts   | `100px` (pill)  |
| Cards, product cards, cat tiles  | `18px–20px`     |
| Cart items, feature icons        | `12px–14px`     |
| Inner thumbnails, qty buttons    | `8px–10px`      |
| Floating WhatsApp button, dots   | `50%` (circle)  |

## Buttons

All buttons are pills with `translateY(-3px)` lift + stronger tinted shadow on hover:

- `.btn-primary` — rose gradient, white text (primary CTA).
- `.btn-gold` — gold gradient, for secondary CTAs.
- `.btn-ghost` — outlined on `--bg-2`, rose on hover.
- `.btn-whatsapp` — WhatsApp green `#25D366`. Hidden site-wide when `html.no-wa` is set (settings toggle).
- `.btn-block` — full-width modifier (checkout).

## Motion

- Single easing token: `--ease: cubic-bezier(.16,1,.3,1)` — use it for all transitions.
- `.reveal` / `.reveal.in` — scroll-reveal (fade + 30px rise, wired by `SiteUI.observeReveals`). New sections should participate.
- Nav gains `.scrolled` (blur + background + shadow) past 30px scroll.
- Pulsing effects: `.wa-float::after` green pulse, TikTok-live button pulse.
- `prefers-reduced-motion: reduce` is honored — animations off, reveals shown immediately. Keep it working.

## Component Patterns

- **Product card `.pcard`** — white card, image link on top (badge overlay optional), category label, name, subtitle, footer with price + circular `[data-add]` add-to-cart button. Always built through `SiteUI.productCardHTML` — never hand-rolled.
- **Category tile `.cat-tile`** — square image tile with per-category accent color (`SiteUI.catColor`: admin-set or stable hash fallback palette) and a color dot.
- **`.luxury-card` / `.feature`** — white surfaces with `--line-2` tinted borders and `--shadow`.
- **Floating elements** — `.wa-float` (bottom-left circle, hidden under `html.no-wa`) and `.tiktok-live` (pill, shown only during a live window).
- **Cart** — slide-over drawer with `.cart-item` rows (64px thumb, qty steppers); toasts are dark pills.
- **Images** — always `loading="lazy"`, `onerror` fallback to the shared flower `PLACEHOLDER` SVG (`#FBEEEA` background).

## Layout Patterns

- Fixed top nav (`nav.site-nav`) with brand gradient logo text; burger menu below 768px.
- Content sections sit in `.wrap` above the fixed `.bg-glow` backdrop.
- Admin: sidebar + content shell; sidebar becomes an overlay on mobile (`#menuBtn`).
- Breakpoints: `1024px`, `768px`, `560px`, `440px` — mobile-first adjustments at each; most customers are on phones.

## Icons

- No icon library. Inline stroke-based SVGs (`stroke="currentColor"`, round caps, stroke width ≈ 2–2.4) for UI glyphs; PNG assets in `assets/` for social icons (WhatsApp, Instagram, Facebook, TikTok).
- The admin panel uses emoji as icons (💾 save, 🔄 sync, 💬 WhatsApp, 🚚 delivery) — keep that convention there, but do not use emoji as UI icons on the storefront.

## Component Library

None. No framework, no Tailwind, no shadcn — every component is hand-written plain CSS in `css/theme.css` (storefront) or the `amelhadj.html` style block (admin). Reuse existing classes before inventing new ones, and add new shared styles to `theme.css`, not inline `<style>` blocks.
