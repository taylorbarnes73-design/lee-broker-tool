# Lee & Associates Newport Beach Brand Guidelines v1.0

> Last updated: 2026-06-03
> Status: Active

## Quick Reference

| Element | Value |
|---------|-------|
| Brand Name | Lee & Associates Newport Beach |
| Primary Color | #98002E (Lee Red PMS 202) |
| Secondary Color | #003146 (Navy PMS 3035) |
| Accent Color | #009AD9 (Sky PMS 2925) |
| Primary Font | Manrope |
| Heading Font | Cormorant Garamond |
| Voice | Professional, Precise, Client-First |

---

## 1. Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Lee Red | #98002E | rgb(152,0,46) | CTAs, headers, primary brand |
| Primary Dark | #7A0024 | rgb(122,0,36) | Hover states, pressed |
| Primary Light | #F4E3E8 | rgb(244,227,232) | Subtle tint, backgrounds |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Navy | #003146 | rgb(0,49,70) | Supporting headers, sidebar |
| Navy Dark | #002438 | rgb(0,36,56) | Hover on navy elements |
| Frost | #A9C3CB | rgb(169,195,203) | Secondary tint, light fills |

### Accent Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Sky | #009AD9 | rgb(0,154,217) | Links, highlights, info |
| Sky Light | #D0EEF9 | rgb(208,238,249) | Info backgrounds |

### Neutral Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Charcoal | #303C42 | rgb(48,60,66) | Primary body text |
| Slate | #7E8083 | rgb(126,128,131) | Muted text, captions |
| Faint | #A8AAAD | rgb(168,170,173) | Placeholder, disabled |
| Border | #D1D5DB | rgb(209,213,219) | Dividers, input borders |
| Subtle | #F0F2F4 | rgb(240,242,244) | Soft borders, fills |
| Surface | #F9FAFB | rgb(249,250,251) | Page background |
| White | #FFFFFF | rgb(255,255,255) | Cards, surfaces |

### Semantic Colors

| State | Hex | Usage |
|-------|-----|-------|
| Success | #8A941E | Positive actions, confirmations |
| Warning | #B5651D | Cautions, pending states |
| Error | #CD1442 | Errors, destructive actions |
| Info | #009AD9 | Informational messages |

### Accessibility

- Lee Red on white: meets WCAG AA for large text (3.5:1+)
- Navy on white: exceeds WCAG AAA (10:1+)
- All interactive elements should meet WCAG 2.1 AA minimum

---

## 2. Typography

### Font Stack

```css
--font-heading: 'Cormorant Garamond', 'Minion Pro', Georgia, serif;
--font-body: 'Manrope', 'Avenir Next', Inter, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
```

### Type Scale

| Element | Size (Desktop) | Size (Mobile) | Weight | Line Height |
|---------|----------------|---------------|--------|-------------|
| H1 | 56px | 40px | 600 | 1.2 |
| H2 | 40px | 32px | 600 | 1.25 |
| H3 | 32px | 28px | 600 | 1.3 |
| H4 | 24px | 20px | 600 | 1.35 |
| Body Large | 18px | 18px | 400 | 1.6 |
| Body | 16px | 16px | 400 | 1.5 |
| Small | 14px | 14px | 400 | 1.5 |
| Caption / Eyebrow | 11px | 11px | 700 | 1.4 |

### Font Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

---

## 3. Logo Usage

### Variants

| Variant | File | Use Case |
|---------|------|----------|
| Full Color | lee-newport-beach-fullcolor.png | Light backgrounds, documents |
| White | lee-newport-beach-white.png | Dark/red backgrounds |
| Favicon | favicon | Browser tabs, small spaces |

### Clear Space

Minimum clear space = height of the "L" in the wordmark

### Minimum Size

| Context | Minimum Width |
|---------|---------------|
| Digital - Full Logo | 120px |
| Print - Full Logo | 35mm |

### Don'ts

- Don't rotate or skew the logo
- Don't place on busy backgrounds without sufficient contrast
- Don't use the full-color logo on a red background — use white variant instead
- Don't add drop shadows or glow effects
- Don't crop or alter proportions

---

## 4. Voice & Tone

### Brand Personality

| Trait | Description |
|-------|-------------|
| **Professional** | Expert market knowledge, authoritative yet approachable |
| **Precise** | Data-driven, specific — avoid vague superlatives |
| **Client-First** | Every communication centers on broker/client outcomes |
| **Local** | Deep Newport Beach and Southern California expertise |

### Voice Chart

| Trait | We Are | We Are Not |
|-------|--------|------------|
| Professional | Expert, knowledgeable | Stuffy, bureaucratic |
| Precise | Specific, factual | Vague, marketing-speak |
| Client-First | Outcome-focused | Self-promotional |
| Local | Community-rooted | Generic national brand |

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| Portal UI | Clear, instructional | "Upload your listing form to begin." |
| Error messages | Calm, specific | "Check the address format and try again." |
| Success | Brief, confident | "Submission sent to Dealius." |
| Admin | Direct, efficient | "3 submissions pending review." |

### Prohibited Terms

| Avoid | Reason |
|-------|--------|
| Best-in-class | Vague, unverifiable |
| Seamless | Overused in commercial real estate |
| Revolutionary | Hyperbolic |
| Synergy | Corporate jargon |
| Leverage | Use "use" instead |

---

## 5. Imagery Guidelines

### Photography Style

- **Subjects:** Commercial properties, Newport Beach skyline, professional broker interactions
- **Lighting:** Bright, natural; avoid moody/dark treatment
- **Color:** Neutral backgrounds let the brand palette carry the accent
- **Composition:** Clean, architectural framing

### Icons

- Style: Outlined, lucide-react library (24px base grid)
- Stroke: 1.5px consistent
- Color: Charcoal (`#303C42`) for UI, Lee Red (`#98002E`) for emphasis

---

## 6. Design Components

### Buttons

| Type | Background | Text | Border Radius |
|------|------------|------|---------------|
| Primary | #98002E | #FFFFFF | 6px |
| Secondary | Transparent | #98002E | 6px |
| Ghost | Transparent | #7E8083 | 6px |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| s-1 | 4px | Tight spacing |
| s-2 | 8px | Compact elements |
| s-3 | 12px | Inline gaps |
| s-4 | 16px | Standard spacing |
| s-6 | 24px | Section spacing |
| s-8 | 32px | Large gaps |
| s-12 | 48px | Section dividers |
| s-16 | 64px | Page sections |

### Border Radius

| Element | Radius |
|---------|--------|
| Buttons | 6px |
| Cards | 8px |
| Inputs | 6px |
| Modals | 12px |
| Badges/Pills | 9999px |

---

## AI Image Generation

### Base Prompt Template

Always prepend to image generation prompts:

```
Professional commercial real estate photography, Newport Beach California, clean architectural composition, neutral backgrounds with warm natural lighting, brand-aligned color accents in deep red #98002E and navy #003146, sharp detail, modern minimal aesthetic, no text overlays
```

### Style Keywords

| Category | Keywords |
|----------|----------|
| **Lighting** | natural light, bright, architectural, soft shadows |
| **Mood** | professional, confident, trustworthy, local |
| **Composition** | clean lines, rule of thirds, wide angle |
| **Treatment** | high clarity, neutral tone, brand-accented |
| **Aesthetic** | modern, minimal, commercial real estate |

### Visual Mood Descriptors

- Clean and professional — no clutter or noise
- Warm California natural light
- Subtle brand red or navy as accent, never dominant

### Visual Don'ts

| Avoid | Reason |
|-------|--------|
| Dark/moody treatment | Conflicts with the brand's confident, clear voice |
| Oversaturated colors | Clashes with the restrained Lee palette |
| Stock photo clichés (handshakes, suits only) | Feels generic, not Lee |
| Text baked into images | Always layer type separately |

### Example Prompts

**Hero Banner:**
```
Aerial view of Newport Beach commercial district, golden hour, clean minimal composition, deep navy sky, professional real estate photography, sharp architectural detail, no people, ultra wide angle
```

**Social Media Post:**
```
Modern commercial office interior, Newport Beach, warm natural light through floor-to-ceiling windows, neutral tones with subtle red accent, clean minimal aesthetic, professional real estate photography
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-03 | Initial guidelines — aligned with Lee & Associates Brand Standards Feb 2021 |
