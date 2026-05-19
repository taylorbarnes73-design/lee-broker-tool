# Design Refresh Audit — Red Dots & Visual Refactor

This document records every place a "red dot", red badge, red status indicator,
or saturated red surface was identified in the codebase, and how it was treated
in the refresh. Taylor's feedback was:

> "i dont like the red dots, and overall it seems really dated, take your time
> and really work on the design elements and the formatting, without actually
> breaking the tool"

## Strategy

Instead of churning every component, I held the existing CSS variable surface
stable and **retargeted the brand variables themselves** to the Nexus palette:

| Old token                     | Old value (saturated red) | New value (refined)        | Used as          |
| ----------------------------- | ------------------------- | -------------------------- | ---------------- |
| `--lee-red` / `--lee-crimson` | `#C32033` / `#9B0D2A`     | `#01696F` (deep teal)      | Primary CTA      |
| `--lee-red-deep` / `-ink`     | `#9F1828` / `#7A0A20`     | `#0C4E54` (teal hover)     | Hover/pressed    |
| `--lee-crimson-wash`          | `#FBEAEE`                 | `#E5EEEE` (muted teal tint)| Active tints     |
| `--lee-crimson-glow`          | `rgba(155,13,42,.12)`     | `rgba(1,105,111,.14)`      | Focus rings      |
| `--err-700`                   | `#8A1F17` (red)           | `#A12C7B` (muted plum)     | Errors, "rejected"|
| TONE_RED (status badge)       | `#FDECEC / #9A1A10`       | `#F6E8EE / #7C2257` (plum) | Rejected/cancelled|

The brand still has a single accent color, but it's now a deep teal that reads
as confident and editorial rather than alarming.

Body backgrounds moved from `#F2F2EF` with a pink radial-gradient wash to a
flat `#F7F6F2` (Nexus background). Cards use `#F9F8F5`. Borders dropped from
`#D8D7D2` to the slightly cooler `#D4D1CA`.

## Red-dot sites and their treatment

### Pulse / notification dots in `client/src/design/index.jsx`

| Line  | Description                                  | Treatment                                                |
| ----- | -------------------------------------------- | -------------------------------------------------------- |
| ~467  | Red "unread" dot pinned to bell icon         | Now inherits the new teal via `--lee-crimson`           |
| ~528  | Warning-state pulse next to status text      | Kept as amber `--warn-500` (intentional warning signal)  |
| ~641  | Animated red beacon next to "Live" label     | Re-toned to amber pulse (`--warn-500`) — same affordance |
| ~702  | Current-step dot in inline stepper           | Now teal (via retargeted `--lee-crimson`)               |
| ~732  | "In progress" inline marker                  | Kept amber                                               |
| ~988  | Active radio-style dot in horizontal stepper | Now teal                                                 |
| ~1069 | "Selected" checkmark badge on tile           | Now teal                                                 |

### Status badge tones (`client/src/lib/format.ts`)

| Status                             | Before                  | After                                       |
| ---------------------------------- | ----------------------- | ------------------------------------------- |
| `rejected`, `cancelled` (TONE_RED) | `#FDECEC / #9A1A10`     | Muted plum `#F6E8EE / #7C2257 / #E6CFDC`    |
| `approved`, `closed` (TONE_GREEN)  | `#E8F5EC / #1F6E3C`     | Muted teal `#E5EEEE / #2C5C5F / #BFD5D7`    |
| `in_review` (TONE_BLUE)            | `#E6F0FA / #1F4F8B`     | Unchanged tone; still blue (information)    |
| `waiting_on_*` (TONE_AMBER)        | `#FFF4E0 / #8A5300`     | Muted amber `#FAEFDC / #6F4514 / #E8D9B6`   |
| `triaged` (TONE_PURPLE)            | `#F1E9FB / #5A2EA6`     | Unchanged                                   |
| `pending`, default (TONE_GRAY)     | `--ink-100 / --ink-700` | Now uses neutral `#EFEDE6 / #4A4744`        |

### Heavy "red on white" surfaces in `client/src/index.css`

- Body radial gradient wash removed (was a pink/red blob top-left) — replaced
  with a single quiet Nexus background.
- `dealius-flow-panel` linear gradient (white → crimson-wash) → now a flat
  surface in `--ink-50`.
- All `var(--lee-crimson)` usages inherit the new teal automatically.

### `client/public/broker_tool.css` (legacy tool)

- `:root { --red: #C32033 }` retargeted to `#01696F` (deep teal).
- `:root { --red-dark: #9F1828 }` retargeted to `#0C4E54`.
- `:root { --red-light: #FDF0F2 }` retargeted to `#E5EEEE`.
- `.required-section h2::before` dot — kept as a refined 6×6 muted plum dot
  (`#A12C7B`) instead of bright red, so the "required" affordance is still
  visible but no longer alarming.
- `.required-badge` background color now `#A12C7B` (plum).
- `body` background gradient simplified to flat Nexus background.
- Heavy `box-shadow` recipes softened.

### `client/public/broker_tool.html`

- No script changes. Only CSS-variable-driven tokens recolored.
- `.deal-step-dot` indicators remain (they're functional step markers) but
  inherit the new teal.
- Inline `<style>` blocks that referenced `var(--red)` automatically pick up
  the new teal.

## Typography & layout polish

- Body font: kept Manrope (already loaded from Google Fonts) — it's a clean
  geometric humanist sans in the same family of feel as Inter. Adding Inter
  would have meant double-loading.
- Tabular numerals applied via `.lee-tabular` and on any KPI value rendering.
- Card borders reduced to 1px (already mostly true); shadows softened.
- Sidebar active state changed from a hard red-tinted background to a subtle
  teal-tinted background.

## Files touched

Tokens / global CSS:

- `client/src/design/tokens.css`
- `client/src/index.css`
- `client/src/lib/format.ts` (status tones)

Shared primitives:

- `client/src/components/ui/StatusBadge.tsx` (no logic change; tone definitions
  now pull from the muted Nexus palette)
- `client/src/components/ui/LinkButton.tsx` (refined hover/focus)

Legacy tool:

- `client/public/broker_tool.css` (root variable retarget + required-dot retone)

No `.tsx` page logic was changed; the visual change comes entirely from token
retargeting at the root. This keeps the test surface stable.
