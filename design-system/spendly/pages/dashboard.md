# Dashboard Override

This file overrides `design-system/spendly/MASTER.md` only for dashboard/report screens.

## Intent

- Prioritize scanability of balances, trends, and budget status
- Keep actions one-thumb reachable on mobile
- Make positive/negative financial deltas obvious without relying on color only
- Match the reference layout language: lime hero card, dark stacked surfaces, white control pills, soft floating depth

## Dashboard-Specific Tokens

- KPI value: use `font-mono font-semibold tabular-nums`
- Positive delta: `text-success` + icon (`TrendingUp`)
- Negative delta: `text-destructive` + icon (`TrendingDown`)
- Neutral delta: `text-muted-foreground` + icon (`Minus`)
- Featured balance cards should lean on `--accent` lime, while supporting cards stay deep navy with restrained borders

## Card Behavior

- KPI cards use `ds-interactive-card` + `ds-surface-2`
- Hover/press animation stays transform-only
- Card title weight `500`, numeric value weight `600-700`
- Primary balance cards may use larger radii (`20px-28px`) and softer shadow contrast than secondary cards

## Charts

- Recommended order: spend trend (line) -> category split (pie/donut) -> budget variance (bar)
- Chart palette order: `chart-1`, `chart-2`, `chart-3`, `chart-4`, `chart-5`
- Always pair chart color with visible labels/legend
- Empty data state must include action text (e.g. "Add expense to see trend")
- Use lime only for emphasis or the active state; keep chart bodies readable on navy surfaces

## Layout

- Mobile: single column, sticky key actions near bottom
- Tablet/Desktop: KPI summary row (2-4 cards) + charts below
- Keep min 16px side padding on 375px width
- Preserve generous card spacing so the UI feels stacked rather than crowded

## Accessibility

- Every chart needs text summary of key insight
- KPI cards should preserve semantic heading order
- Interactive chart segments require keyboard focus styles
- Lime accents must never be the only carrier of meaning; pair with icon, label, or state text
