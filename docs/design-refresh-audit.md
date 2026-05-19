# Design Refresh Audit — Lee & Associates Brand Pass

This document records the application of the official Lee & Associates Brand
Standards (Feb 2021) to the broker tool. It supersedes the prior pass that
retargeted brand variables to Nexus teal — Lee's brand is red, and this audit
restores that while applying the full official palette and typography.

## Strategy

The brand variable surface (e.g. `--lee-red`, `--lee-crimson`, legacy `--red`)
stayed stable; the values themselves now resolve to the official PMS 202 brand
red `#98002E`. A full Lee palette was layered on top so secondary surfaces,
status pills, and accents pull from the brand book rather than ad-hoc tones.

## Role → hex mapping

### Primary

| Role                 | Hex       | PMS       | Use                                          |
| -------------------- | --------- | --------- | -------------------------------------------- |
| `--lee-red`          | `#98002E` | PMS 202   | Primary CTA, logo accent, hero accent strip  |
| `--lee-red-hover`    | `#7A0024` | —         | Hover / pressed state of primary             |
| `--lee-slate`        | `#7E8083` | PMS 424   | Secondary text, muted UI, divider rules      |
| `--lee-charcoal`     | `#303C42` | PMS 425   | Body text (default)                          |
| `--lee-white`        | `#FFFFFF` | —         | Cards, surfaces                              |

### Secondary

| Role                 | Hex       | PMS       |
| -------------------- | --------- | --------- |
| `--lee-navy`         | `#003146` | PMS 3035  |
| `--lee-sky`          | `#009AD9` | PMS 2925  |
| `--lee-frost`        | `#A9C3CB` | PMS 7542  |

### Accent (used sparingly, infographics + status)

| Role                 | Hex       | PMS       | Note                                |
| -------------------- | --------- | --------- | ----------------------------------- |
| `--lee-merlot`       | `#4E131E` | PMS 1817  | Pair with bright red                |
| `--lee-bright-red`   | `#CD1442` | PMS 200   | Refined error pill (with label)     |
| `--lee-green`        | `#8A941E` | PMS 384   | Completed status, success           |
| `--lee-mint`         | `#6FC9C4` | PMS 7472  |                                     |

### App surface mapping

| Layer            | Value         |
| ---------------- | ------------- |
| Page background  | `#F8F7F4`     |
| Card / surface   | `#FFFFFF`     |
| Border (default) | `#D4D1CA`     |
| Border (soft)    | `#E2E1DD`     |
| Body text        | `#303C42`     |
| Muted text       | `#7E8083`     |
| Faint text       | `#A8AAAD`     |
| Selection fill   | `rgba(152, 0, 46, 0.18)` |

### Approved gradient

A single allowable brand gradient — `linear-gradient(135deg, #98002E 0%, #4E131E 100%)`
— is exposed as `--lee-approved-gradient`. Use only on a single hero strip or
the auth/landing splash, not pervasively.

## Status tone mapping

| Status                            | Background tone                          | Foreground       |
| --------------------------------- | ---------------------------------------- | ---------------- |
| `in_review`, `pending`            | Slate `rgba(126, 128, 131, 0.10)`        | `#303C42` (charcoal) |
| `approved`                        | Navy `rgba(0, 49, 70, 0.10)`             | `#003146` (navy) |
| `closed` / completed              | Green `rgba(138, 148, 30, 0.12)`         | `#6B7517`        |
| `rejected`, `cancelled`           | Bright red `rgba(205, 20, 66, 0.10)`     | `#A1102F`        |
| `waiting_on_*`                    | Amber `#FAEFDC`                          | `#6F4514`        |
| `triaged` (broker-admin)          | Purple `#ECE6F3`                         | `#4B3A75`        |
| `new`, default                    | Neutral `--ink-100 / --ink-700`          |                  |

All pills retain a text label — there are no bare red dots scattered across
the UI. Red is reserved for the brand mark, primary CTAs, sidebar active tint,
and rejected/cancelled status pills (with refined fill + text label).

## Typography

The brand book specifies Avenir Next (paid) with Nunito Sans as the brand-
approved free web alternative for "web-based / Microsoft products". The app
now loads Nunito Sans from Google Fonts (weights 400 / 600 / 700 / 800).

| Layer                  | Treatment                                                  |
| ---------------------- | ---------------------------------------------------------- |
| Body / UI              | Nunito Sans 400, 14–15px, `#303C42`, line-height 1.5       |
| Section headings       | Nunito Sans 700, 16–18px, charcoal                         |
| Page titles            | Nunito Sans 700, 24–28px, charcoal, letter-spacing -0.01em |
| Hero / eyebrow labels  | Nunito Sans 700, uppercase, tracking 0.04–0.16em           |
| Numeric columns        | `font-variant-numeric: tabular-nums lining-nums`           |
| Serif accent (rare)    | Source Serif 4 / Minion Pro fallback                       |

Font stack: `'Nunito Sans', 'Avenir Next', Inter, system-ui, sans-serif`.

## Logo placement

Brand book mandates that the Newport Beach logo appear in every communication.

- **Portal shell sidebar**: Newport Beach full-color logo at 32px height, with
  a thin slate horizontal rule below it and a "BROKER TOOL" subtitle (Nunito
  Sans 700, uppercase, tracking-wide, slate). Alt text:
  "Lee & Associates Newport Beach".
- **Public landing page**: Logo at 64px height, centered above the page hero.
- **Legacy `broker_tool.html`**: Header retains the existing
  `<img src="lee-newport-beach-fullcolor.png">` element at the top of the
  workspace — no script changes.

Logo handling complies with brand rules: never recolored, redrawn, stretched,
skewed, distorted; always shown with the full wordmark, never the icon alone;
breathing room preserved around the mark.

## Per-page help button

A new ghost-icon Help button appears in the portal shell header (next to the
session menu) on every portal route. 32px square, 1px slate border, hover
background `#F8F7F4`, `aria-label="Help for this page"`.

Clicking opens a right-side slide-over panel (`HelpPanel`):

- 400px wide on desktop, full-width on mobile
- Title is dynamic per route; body content lives in `client/src/lib/helpContent.tsx`
  keyed by route regex
- Close on Esc, backdrop click, and × button
- Focus is moved into the panel on open, restored to the trigger on close
- Background scroll locked while open
- Tab/Shift-Tab traps focus inside the panel
- Respects `prefers-reduced-motion` (animations disabled for those users)

Content is authored for: Dashboard, My submissions, Submission detail, Admin
queue, Broker Admin (inbox), Outlook ingest, Dealius settings, Sign Request,
Commission Voucher, Users, Settings, Audit log, Listing import, Dealius
tools, Account. A generic "About the Lee Broker Tool" entry serves as the
fallback.

## Files touched

**Tokens / global CSS**

- `client/src/design/tokens.css` — full Lee palette, font stack, type scale,
  shadows retuned to charcoal-based rgba.
- `client/src/index.css` — Nunito Sans `@import`, root variable retargeting,
  `::selection`, card-flow hover shadow, help-panel + help-trigger styles,
  sidebar brand layout (logo + slate rule + BROKER TOOL subtitle).
- `client/src/lib/format.ts` — status tone mapping (slate/navy/green/red).

**Shared primitives & app shell**

- `client/src/components/AdminPortalShell.tsx` — sidebar brand block restyled
  around the logo, help button + HelpPanel wired into the header.
- `client/src/App.tsx` — `PublicHome` updated to Nunito Sans, brand red CTA,
  updated logo alt text.

**New components**

- `client/src/components/HelpPanel.tsx` — slide-over with focus trap, Esc to
  close, backdrop click, prefers-reduced-motion support.
- `client/src/lib/helpContent.tsx` — per-route help map.

**Legacy tool**

- `client/public/broker_tool.css` — `:root` palette restored to brand red,
  Nunito Sans font stack, all teal-rgba values mapped to red.
- `client/public/broker_tool.html` — Google Fonts link swapped to Nunito Sans +
  Source Serif 4, inline `Manrope` references updated, inline rgba teal swapped
  to brand red. **No script changes.**

## Verification

- `npm run check` (tsc --noEmit): clean
- `npm test` (vitest): 225 / 225 passing
- `npm run build`: clean (no warnings; CSS `@import` ordered to satisfy
  PostCSS/Lightning rules)

## What changed from the previous (Nexus teal) pass

- `--lee-red`, `--lee-crimson`, `--red` reverted from teal to brand red.
- `TONE_RED` re-aimed at refined Lee bright-red `#CD1442` (with text label),
  not muted plum.
- `TONE_BLUE` now Lee navy `#003146` (for approved).
- `TONE_SLATE` added as the default tone for pending / in-review.
- Body radial-gradient wash stays removed (brand uses gradients only on hero
  strips, not page washes).
- Card hover shadow stays soft (`0 4px 12px` charcoal rgba).
- Confidential / destructive tones re-evaluated:
  - "Confidential" → navy/charcoal.
  - Errors / destructive → bright-red pill `#CD1442` with text label, never a
    naked red dot.
