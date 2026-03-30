# Spendly Design System (Lime Card Dark)

> Use this file as the global source of truth for UI decisions.
> If a page file exists in `design-system/spendly/pages/<page>.md`, that page file overrides this master for that page only.

## Product Fit

- Product: Expense tracker / personal finance
- Design intent: trustworthy, calm, data-dense, touch-friendly
- Primary experience: dark mode first
- Secondary experience: light mode fallback

## Brand Style

- Style family: Fintech Lime Cards + Dark Glass Surfaces
- Visual language: chartreuse/lime highlights, deep navy surfaces, white pill controls, soft floating shadows, premium mobile-card composition
- Corner radius: `12px` base (`--radius`), large cards `16px-28px`, pill controls fully rounded
- Icon set: Lucide only, single stroke style

## Typography

- Heading/UI font: IBM Plex Sans (`400/500/600/700`)
- Numeric/data font: JetBrains Mono (`400/500/600`)
- Body size baseline: `16px`
- Body line-height target: `1.5`
- Number-heavy UI should use tabular figures (`font-variant-numeric: tabular-nums`)
- Emphasis should come from weight and contrast, not extra decoration

## Semantic Color Tokens

### Dark (primary)

| Token                | Value                   |
| -------------------- | ----------------------- |
| `--background`       | `#07111D`               |
| `--foreground`       | `#F4F8FF`               |
| `--card`             | `#0F172A`               |
| `--primary`          | `#D7FF5A`               |
| `--secondary`        | `#26374F`               |
| `--accent`           | `#D7FF5A`               |
| `--muted`            | `#172335`               |
| `--muted-foreground` | `#B2BFD3`               |
| `--destructive`      | `#FB7185`               |
| `--border`           | `color-mix(lime/white)` |
| `--ring`             | `#D7FF5A`               |

### Status

| Token           | Value     | Usage                       |
| --------------- | --------- | --------------------------- |
| `--success`     | `#22C55E` | positive delta, on-budget   |
| `--warning`     | `#FBBF24` | near-limit budgets          |
| `--info`        | `#7DD3FC` | neutral highlights          |
| `--destructive` | `#DC2626` | over-budget, failed actions |

## Elevation

| Layer   | Token         | Intended Use             |
| ------- | ------------- | ------------------------ |
| Base    | `--surface-1` | app background           |
| Raised  | `--surface-2` | cards, inputs, list rows |
| Overlay | `--surface-3` | sheets, sticky controls  |

Shadow scale:

- `--shadow-sm` for default cards
- `--shadow-md` for hover/active elevation
- `--shadow-lg+` only for modal/sheet layers

## Motion

- Micro interactions: `150–220ms`
- Enter transitions: `220–300ms` (`ease-out`)
- Exit transitions: `140–180ms`
- Press feedback: subtle scale down with shadow lift, no layout shift
- Floating accents may drift slowly, but must stay decorative and sparse
- Always respect `prefers-reduced-motion`

## Layout + Spacing

- Spacing system: `4 / 8 / 12 / 16 / 24 / 32 / 48`
- Minimum touch target: `44x44`
- Minimum gap between adjacent touch controls: `8px`
- Mobile-first breakpoints: `375`, `768`, `1024`, `1440`
- Avoid horizontal scroll on mobile

## Components Baseline

- Buttons: pill or rounded-lg, min height `44px`, visible focus ring, disabled opacity + semantic disabled state
- Inputs: high contrast border, clear focus ring, helper/error text close to field
- Cards: use `ds-interactive-card` for press/hover consistency, keep large radii on featured surfaces
- Charts: avoid color-only meaning; include legend/labels and stable category colors

## Accessibility Guardrails

- Text contrast target: `4.5:1` for normal text
- Focus visibility required for keyboard users
- Icon-only controls require `aria-label`
- Color must not be the only status indicator

## Avoid

- Pure black + neon-heavy cyberpunk styling for core finance flows
- Mixed icon families
- Tiny icon-only actions below touch target size
- Removing zoom or disabling user scaling
- Flat card stacks with no depth separation

## File Mapping

- Global tokens and utility classes: `src/app/globals.css`
- Global fonts + theme setup: `src/app/layout.tsx`
- Shared action primitive: `src/components/ui/button.tsx`
